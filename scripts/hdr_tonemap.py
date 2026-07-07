#!/usr/bin/env python3
"""
hdr_tonemap.py -- HDR (PQ / HLG) image -> SDR sRGB 16-bit PNG.

Self-contained: needs only python3 + numpy + ffmpeg/ffprobe on PATH.
Decode is done by ffmpeg (no RGB conversion requested -- we take raw
YCbCr planes and do ALL color science ourselves in float32):

    YCbCr (tagged matrix/range) -> R'G'B' (PQ-encoded)
    -> PQ EOTF (ST 2084) -> absolute linear light in nits (tagged primaries)
    -> tone map luminance (BT.2390 EETF by default; BT.2446A / Hable options)
      with hue-preserving per-pixel ratio scaling + highlight desaturation
    -> gamut map primaries -> BT.709/sRGB (linear 3x3 matrix, clip)
    -> sRGB OETF -> 16-bit PNG (written by ffmpeg from raw RGB48)

Usage:  python3 hdr_tonemap.py in.avif out.png [--op bt2390|bt2446a|hable]
                 [--ref-white 203] [--target-nits 203] [--peak-percentile 99.9]
Exit code 3 means "input is not HDR (no PQ/HLG transfer)" -- caller should
use its normal SDR path instead.
"""
import argparse, json, subprocess, sys
import numpy as np

# ---------------- ffprobe / ffmpeg helpers ----------------

def probe(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries",
         "stream=width,height,pix_fmt,color_range,color_space,color_transfer,color_primaries",
         "-of", "json", path],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)["streams"][0]

def decode_yuv444p10(path, w, h):
    """Decode to raw planar YCbCr 4:4:4 10-bit. ffmpeg only up/down-samples
    chroma here (no matrix conversion), which is colorimetry-agnostic."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path,
         "-pix_fmt", "yuv444p10le", "-f", "rawvideo", "-"],
        capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype=np.uint16)
    if a.size != w * h * 3:
        raise SystemExit(f"decoded size mismatch: got {a.size}, want {w*h*3}")
    return a.reshape(3, h, w).astype(np.float32)

def write_png16(path, rgb, w, h):
    """rgb: float in [0,1], shape (h,w,3) -> 16-bit PNG via ffmpeg."""
    buf = np.round(np.clip(rgb, 0.0, 1.0) * 65535.0).astype("<u2").tobytes()
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error",
         "-f", "rawvideo", "-pix_fmt", "rgb48le", "-s", f"{w}x{h}", "-i", "-",
         "-frames:v", "1", path],
        input=buf, check=True)

# ---------------- YCbCr -> R'G'B' ----------------

KRKB = {  # color_space tag -> (Kr, Kb)
    "smpte170m": (0.299, 0.114), "bt470bg": (0.299, 0.114),
    "bt709": (0.2126, 0.0722),
    "bt2020nc": (0.2627, 0.0593), "bt2020c": (0.2627, 0.0593),
}

def ycbcr_to_rgb(Y, Cb, Cr, kr, kb, full_range):
    if full_range:                       # 10-bit full: Y 0..1023, C centered 512
        Ey  = Y / 1023.0
        Epb = (Cb - 512.0) / 1023.0
        Epr = (Cr - 512.0) / 1023.0
    else:                                # 10-bit limited: Y 64..940, C 64..960
        Ey  = (Y - 64.0) / 876.0
        Epb = (Cb - 512.0) / 896.0
        Epr = (Cr - 512.0) / 896.0
    kg = 1.0 - kr - kb
    R = Ey + 2.0 * (1.0 - kr) * Epr
    B = Ey + 2.0 * (1.0 - kb) * Epb
    G = (Ey - kr * R - kb * B) / kg
    return (np.clip(R, 0.0, 1.0), np.clip(G, 0.0, 1.0), np.clip(B, 0.0, 1.0))

# ---------------- transfer functions ----------------

M1, M2 = 2610.0 / 16384.0, 2523.0 / 4096.0 * 128.0
C1, C2, C3 = 3424.0 / 4096.0, 2413.0 / 4096.0 * 32.0, 2392.0 / 4096.0 * 32.0

def pq_eotf(E):        # signal [0,1] -> nits (SMPTE ST 2084)
    Ep = np.power(np.clip(E, 0.0, 1.0), 1.0 / M2)
    return 10000.0 * np.power(np.maximum(Ep - C1, 0.0) / (C2 - C3 * Ep), 1.0 / M1)

def pq_inv_eotf(L):    # nits -> signal [0,1]
    Y = np.power(np.clip(L, 0.0, 10000.0) / 10000.0, M1)
    return np.power((C1 + C2 * Y) / (1.0 + C3 * Y), M2)

def hlg_to_nits(E, peak=1000.0):
    """HLG signal -> display nits (BT.2100 EOTF: inv-OETF + OOTF, gamma 1.2)."""
    a, b, c = 0.17883277, 0.28466892, 0.55991073
    E = np.clip(E, 0.0, 1.0)
    sc = np.where(E <= 0.5, (E * E) / 3.0, (np.exp((E - c) / a) + b) / 12.0)
    return sc, peak  # returns scene-linear (0..1); OOTF applied on luminance later

def srgb_oetf(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, 12.92 * x,
                    1.055 * np.power(x, 1.0 / 2.4) - 0.055)

# ---------------- primaries / gamut matrices ----------------

PRIMARIES = {
    "smpte432": ((0.680, 0.320), (0.265, 0.690), (0.150, 0.060)),  # Display-P3 D65
    "bt2020":   ((0.708, 0.292), (0.170, 0.797), (0.131, 0.046)),
    "bt709":    ((0.640, 0.330), (0.300, 0.600), (0.150, 0.060)),
}
D65 = (0.3127, 0.3290)

def rgb2xyz_matrix(prim):
    M = np.array([[x / y, 1.0, (1.0 - x - y) / y] for (x, y) in prim]).T
    W = np.array([D65[0] / D65[1], 1.0, (1.0 - D65[0] - D65[1]) / D65[1]])
    return M * np.linalg.solve(M, W)

def gamut_matrix(src_prim, dst_prim):   # linear RGB src -> linear RGB dst
    return np.linalg.inv(rgb2xyz_matrix(dst_prim)) @ rgb2xyz_matrix(src_prim)

# ---------------- tone-mapping operators (on absolute luminance, nits) ------

def tm_bt2390(L, peak_nits, target_nits):
    """BT.2390 EETF: hermite-spline highlight rolloff in PQ space.
    Maps [0, peak] nits -> [0, target] nits; identity below the knee."""
    iw = pq_inv_eotf(np.float32(peak_nits))
    maxLum = pq_inv_eotf(np.float32(target_nits)) / iw
    E1 = pq_inv_eotf(L) / iw
    ks = 1.5 * maxLum - 0.5
    t = np.clip((E1 - ks) / (1.0 - ks), 0.0, 1.0)
    t2, t3 = t * t, t * t * t
    P = (2*t3 - 3*t2 + 1) * ks + (t3 - 2*t2 + t) * (1 - ks) + (-2*t3 + 3*t2) * maxLum
    E2 = np.where(E1 >= ks, P, E1)
    return pq_eotf(E2 * iw)             # nits, <= target_nits

def tm_bt2446a(L, peak_nits, target_nits):
    """ITU-R BT.2446-1 Method A tone curve (luminance form)."""
    Lhdr, Lsdr = float(peak_nits), float(target_nits)
    phdr = 1.0 + 32.0 * (Lhdr / 10000.0) ** (1.0 / 2.4)
    psdr = 1.0 + 32.0 * (Lsdr / 10000.0) ** (1.0 / 2.4)
    yp = np.power(np.clip(L / Lhdr, 0.0, 1.0), 1.0 / 2.4)
    yp = np.log1p((phdr - 1.0) * yp) / np.log(phdr)
    yc = np.where(yp <= 0.7399, 1.0770 * yp,
         np.where(yp < 0.9909, -1.1510 * yp * yp + 2.7811 * yp - 0.6302,
                  0.5 * yp + 0.5))
    ysdr = (np.power(psdr, yc) - 1.0) / (psdr - 1.0)
    return np.power(ysdr, 2.4) * Lsdr   # nits, <= target_nits

def tm_hable(L, peak_nits, target_nits, ref_white):
    """Hable/Uncharted-2 filmic on scene-relative x = nits/ref_white."""
    A, B, C, D, E, F = 0.15, 0.50, 0.10, 0.20, 0.02, 0.30
    def h(x):
        return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F
    x = L / ref_white
    W = peak_nits / ref_white
    return h(x) / h(W) * target_nits

OPS = {"bt2390": tm_bt2390, "bt2446a": tm_bt2446a, "hable": tm_hable}

# ---------------- main ----------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("input"); ap.add_argument("output")
    ap.add_argument("--op", choices=OPS, default="bt2390")
    ap.add_argument("--ref-white", type=float, default=203.0,
                    help="nits of diffuse/SDR white in the HDR signal (BT.2408)")
    ap.add_argument("--target-nits", type=float, default=203.0,
                    help="nits the SDR display white is assumed to emit")
    ap.add_argument("--peak-percentile", type=float, default=99.9)
    ap.add_argument("--peak-nits", type=float, default=0.0,
                    help="force content peak (0 = estimate from image)")
    args = ap.parse_args()

    st = probe(args.input)
    trc = st.get("color_transfer", "") or ""
    if trc not in ("smpte2084", "arib-std-b67"):
        print(f"not HDR (color_transfer={trc!r}); use the plain SDR path",
              file=sys.stderr)
        sys.exit(3)

    w, h = st["width"], st["height"]
    kr, kb = KRKB.get(st.get("color_space", ""), (0.2627, 0.0593))  # default BT.2020
    full = st.get("color_range", "") in ("pc", "jpeg", "full")
    prim_tag = st.get("color_primaries", "") or "bt2020"
    prim = PRIMARIES.get(prim_tag, PRIMARIES["bt2020"])

    Yp, Cbp, Crp = decode_yuv444p10(args.input, w, h)
    Rp, Gp, Bp = ycbcr_to_rgb(Yp, Cbp, Crp, kr, kb, full)
    del Yp, Cbp, Crp

    if trc == "smpte2084":
        R, G, B = pq_eotf(Rp), pq_eotf(Gp), pq_eotf(Bp)          # nits
    else:  # HLG: scene-linear then OOTF (gamma 1.2 on luminance, peak 1000)
        (R, _), (G, _), (B, _) = hlg_to_nits(Rp), hlg_to_nits(Gp), hlg_to_nits(Bp)
        lum_coef = rgb2xyz_matrix(prim)[1]
        Ys = lum_coef[0] * R + lum_coef[1] * G + lum_coef[2] * B
        gain = 1000.0 * np.power(np.maximum(Ys, 1e-6), 0.2)
        R, G, B = R * gain, G * gain, B * gain
    del Rp, Gp, Bp

    lum_coef = rgb2xyz_matrix(prim)[1]                            # Y row
    L = lum_coef[0] * R + lum_coef[1] * G + lum_coef[2] * B       # nits

    peak = args.peak_nits or float(np.percentile(L, args.peak_percentile))
    peak = min(max(peak, args.target_nits * 1.05, 300.0), 10000.0)

    tm = OPS[args.op]
    Lout = (tm(L, peak, args.target_nits, args.ref_white) if args.op == "hable"
            else tm(L, peak, args.target_nits))

    ratio = Lout / np.maximum(L, 1e-4)          # hue-preserving scale
    R, G, B = R * ratio, G * ratio, B * ratio   # nits, luminance <= target
    del ratio, L

    # display-linear [0,1] relative to SDR white
    tn = args.target_nits
    R, G, B = R / tn, G / tn, B / tn
    Ld = Lout / tn
    del Lout

    # highlight desaturation: project onto [0,1]^3 toward luminance axis
    m = np.maximum(np.maximum(R, G), B)
    over = m > 1.0
    if np.any(over):
        s = np.ones_like(m)
        denom = np.maximum(m - Ld, 1e-6)
        s = np.where(over, np.clip((1.0 - Ld) / denom, 0.0, 1.0), s)
        R = Ld + (R - Ld) * s
        G = Ld + (G - Ld) * s
        B = Ld + (B - Ld) * s
    del m, over, Ld

    # gamut map src primaries -> BT.709/sRGB in linear light
    if prim_tag != "bt709":
        M = gamut_matrix(prim, PRIMARIES["bt709"]).astype(np.float32)
        R, G, B = (M[0,0]*R + M[0,1]*G + M[0,2]*B,
                   M[1,0]*R + M[1,1]*G + M[1,2]*B,
                   M[2,0]*R + M[2,1]*G + M[2,2]*B)

    out = np.stack([srgb_oetf(R), srgb_oetf(G), srgb_oetf(B)], axis=-1)
    write_png16(args.output, out, w, h)
    print(f"ok: {args.input} -> {args.output} op={args.op} "
          f"peak={peak:.0f}nits ref_white={args.ref_white} target={args.target_nits}")

if __name__ == "__main__":
    main()
