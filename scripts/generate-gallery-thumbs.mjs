/**
 * Gallery thumbnail + EXIF generator.
 *
 * Scans posts with `gallery: true`, collects their whitelisted image-host URLs,
 * downloads each once, extracts a privacy-safe EXIF subset (never GPS), and
 * writes an 800px AVIF thumbnail plus a manifest. The Astro build reads only the
 * manifest — it never downloads or transcodes.
 *
 * Per image:
 *   - HDR (PQ/HLG) AVIF/HEIC → ffmpeg (SVT-AV1) downscales it KEEPING the HDR
 *     signalling (10-bit, browser handles SDR/HDR display). sharp can't touch
 *     10-bit AVIF, and a naive SDR decode of PQ looks washed-out.
 *   - Everything else (SDR JPEG/PNG/WebP/AVIF/HEIC) → sharp, with ffmpeg /
 *     avifdec / ImageMagick as a fallback for AVIF & HEIC sharp can't read
 *     (for gain-map JPEG/HEIC the primary SDR base is used).
 *
 * Usage:
 *   node scripts/generate-gallery-thumbs.mjs [--prune]
 *
 * Requires Node >= 22 (native fetch) and ffmpeg (HDR passthrough + HEIC decode).
 * avifdec (libavif-bin) / ImageMagick are optional extra decoder fallbacks.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import sharp from "sharp";
import exifr from "exifr";

const ROOT = process.cwd();
const CONFIG_FILE = path.join(ROOT, "astro-paper.config.ts");
const POSTS_DIR = path.join(ROOT, "src/content/posts");
const MANIFEST_FILE = path.join(ROOT, "src/data/gallery-manifest.json");
const THUMBS_DIR = path.join(ROOT, "public/gallery/thumbs");

const CONCURRENCY = Number(process.env.GALLERY_CONCURRENCY) || 4;
const THUMB_SIZE = 800;
const THUMB_QUALITY = 60;
// SVT-AV1 CRF for HDR (PQ/HLG) passthrough thumbnails — kept 10-bit + HDR-tagged.
const THUMB_HDR_CRF = 32;
// ffprobe color_transfer values that mean the image is HDR.
const HDR_TRANSFERS = new Set(["smpte2084", "arib-std-b67"]);
// Present as a real browser: self-hosted image hosts (e.g. Cloudflare-fronted
// ones) often reject non-browser User-Agents or missing Referer with a 403.
const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Browser-like request headers, with a same-origin Referer for the image host. */
function fetchHeaders(url) {
  return {
    "User-Agent": USER_AGENT,
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: new URL(url).origin + "/",
  };
}

// Keep in sync with the regex in src/utils/getGalleryAlbums.ts.
const IMAGE_RE = /!\[(.*?)\]\(\s*([^)\s]+?)(?:\s+["'][^"']*["'])?\s*\)/g;

const shouldPrune = process.argv.includes("--prune");

/* --------------------------------- config --------------------------------- */

/** Evaluate astro-paper.config.ts as a plain object literal (no TS/imports). */
async function loadConfig() {
  let src;
  try {
    src = await fs.readFile(CONFIG_FILE, "utf8");
  } catch {
    throw new Error(`Cannot read config at ${CONFIG_FILE}`);
  }
  let body = src.replace(/^\s*import\s.*$/gm, "");
  if (/export\s+default\s+defineAstroPaperConfig\s*\(/.test(body)) {
    body = body.replace(
      /export\s+default\s+defineAstroPaperConfig\s*\(/,
      "return ("
    );
  } else if (/export\s+default\s+/.test(body)) {
    body = body.replace(/export\s+default\s+/, "return ");
  } else {
    throw new Error("Could not find `export default` in astro-paper.config.ts");
  }
  try {
    return new Function(`"use strict";\n${body}`)();
  } catch (err) {
    throw new Error(
      "Failed to evaluate astro-paper.config.ts. The config must stay a plain " +
        `object literal (no \`satisfies\`/\`as const\`). Original error: ${
          err instanceof Error ? err.message : err
        }`
    );
  }
}

/* ------------------------------- discovery -------------------------------- */

/** Recursively list markdown files, skipping `_`-prefixed files/dirs. */
async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (/\.(md|mdx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** Split a markdown file into its frontmatter block and body. */
function splitFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: text };
  return { frontmatter: match[1], body: match[2] };
}

/** Collect unique whitelisted image URLs across all `gallery: true` posts. */
async function collectUrls(domains) {
  const files = await walk(POSTS_DIR);
  const urls = new Set();
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const { frontmatter, body } = splitFrontmatter(text);
    if (!/^gallery:\s*true\s*$/m.test(frontmatter)) continue;
    for (const match of body.matchAll(IMAGE_RE)) {
      let url = match[2]?.trim() ?? "";
      if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
      if (!url) continue;
      let hostname;
      try {
        hostname = new URL(url).hostname;
      } catch {
        continue;
      }
      if (domains.has(hostname)) urls.add(url);
    }
  }
  return urls;
}

/* --------------------------------- decode --------------------------------- */

/** Sniff an ISOBMFF/HEIF-family container (AVIF or HEIC/HEIF) by its brands. */
function isHeifFamily(buf) {
  if (buf.length < 12 || buf.toString("latin1", 4, 8) !== "ftyp") return false;
  const head = buf.toString("latin1", 0, 64);
  return /avif|avis|heic|heix|hevc|hevx|mif1|msf1|miaf/.test(head);
}

/**
 * Read the HEIF `irot` rotation + `ispe` coded size from an AVIF/HEIC buffer.
 *
 * Browsers orient AVIF/HEIC by the container's irot/imir properties (EXIF
 * Orientation is ignored for these formats), so thumbnails must apply the same
 * rotation. Decoders disagree here — libheif bakes irot in, ffmpeg/avifdec
 * leave it to the caller — which is exactly how landscape thumbnails of
 * portrait shots slipped through. Returns `rotationCw` (degrees clockwise a
 * renderer must apply) and the coded (pre-rotation) dimensions, or null when
 * the boxes can't be found. Heuristic on multi-image files: any irot in ipco
 * counts, and the largest ispe is taken as the primary image's size.
 */
function heifDisplayProps(buf) {
  function* boxes(start, end) {
    let off = start;
    while (off + 8 <= end) {
      let size = buf.readUInt32BE(off);
      const type = buf.toString("latin1", off + 4, off + 8);
      let header = 8;
      if (size === 1) {
        if (off + 16 > end) return;
        size = Number(buf.readBigUInt64BE(off + 8));
        header = 16;
      } else if (size === 0) {
        size = end - off;
      }
      if (size < header || off + size > end) return;
      yield { type, start: off + header, end: off + size };
      off += size;
    }
  }
  const find = (type, start, end) => {
    for (const box of boxes(start, end)) if (box.type === type) return box;
    return null;
  };
  const meta = find("meta", 0, buf.length);
  if (!meta) return null;
  // `meta` is a FullBox: 4 bytes of version/flags before its children.
  const iprp = find("iprp", meta.start + 4, meta.end);
  const ipco = iprp && find("ipco", iprp.start, iprp.end);
  if (!ipco) return null;
  let rotationCcw = 0;
  let codedWidth = 0;
  let codedHeight = 0;
  for (const box of boxes(ipco.start, ipco.end)) {
    if (box.type === "irot" && box.end - box.start >= 1) {
      rotationCcw = buf[box.start] & 3; // 90° anti-clockwise units
    } else if (box.type === "ispe" && box.end - box.start >= 12) {
      const width = buf.readUInt32BE(box.start + 4);
      const height = buf.readUInt32BE(box.start + 8);
      if (width * height > codedWidth * codedHeight) {
        codedWidth = width;
        codedHeight = height;
      }
    }
  }
  return {
    rotationCw: (360 - rotationCcw * 90) % 360,
    codedWidth,
    codedHeight,
  };
}

/** Run a command, resolving true on exit 0 and false on error / non-zero. */
function tryExec(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", code => resolve(code === 0));
  });
}

/** Run a command capturing stdout; resolves "" on any failure. */
function execOut(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", d => (out += d));
    child.on("error", () => resolve(""));
    child.on("close", code => resolve(code === 0 ? out : ""));
  });
}

/** Probe an image's pixel dimensions and color tags via ffprobe. */
async function ffprobeInfo(file) {
  const out = await execOut("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,color_transfer,color_primaries,color_space",
    "-of",
    "json",
    file,
  ]);
  try {
    return JSON.parse(out).streams?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * HDR (PQ/HLG) passthrough: downscale to an 800px 10-bit AVIF that KEEPS the
 * HDR transfer/primaries, so the browser tone-maps it for SDR displays and
 * shows HDR on HDR displays — exactly how the original images already render in
 * the lightbox. sharp can't touch 10-bit AVIF; ffmpeg (SVT-AV1) does the work.
 *
 * Returns { thumb, width, height } for HDR input, or null otherwise (not HDR,
 * or ffmpeg/ffprobe unavailable) so the caller falls back to the SDR path.
 */
async function hdrPassthrough(file, rotationCw = 0) {
  const info = await ffprobeInfo(file);
  if (!info || !HDR_TRANSFERS.has(info.color_transfer)) return null;

  // Bake the irot display rotation into the pixels ourselves. -noautorotate
  // keeps ffmpeg from also applying it (newer ffmpeg auto-rotates from the
  // demuxer's display matrix, older versions don't — pin the behavior).
  const transpose =
    { 90: "transpose=1,", 180: "hflip,vflip,", 270: "transpose=2," }[
      rotationCw
    ] ?? "";
  const swap = rotationCw % 180 === 90;

  const out = `${file}.pq.avif`;
  try {
    const ok = await tryExec("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-noautorotate",
      "-i",
      file,
      "-vf",
      `${transpose}scale=${THUMB_SIZE}:${THUMB_SIZE}:force_original_aspect_ratio=decrease,format=yuv420p10le`,
      "-frames:v",
      "1",
      "-c:v",
      "libsvtav1",
      "-crf",
      String(THUMB_HDR_CRF),
      "-preset",
      "6",
      // Preserve the source's HDR signalling so browsers render it correctly.
      "-color_primaries",
      info.color_primaries || "bt2020",
      "-color_trc",
      info.color_transfer,
      "-colorspace",
      info.color_space || "bt2020nc",
      out,
    ]);
    if (!ok) return null;
    return {
      thumb: await fs.readFile(out),
      width: Number(swap ? info.height : info.width) || 0,
      height: Number(swap ? info.width : info.height) || 0,
    };
  } finally {
    await fs.rm(out, { force: true });
  }
}

/**
 * Decode a HEIF-family image FILE (8-bit AVIF or HEIC/HEIF sharp can't read) to
 * a PNG buffer. ffmpeg first (robust, decodes HEIC's HEVC + AVIF), then
 * avifdec / ImageMagick. Returns { png, decoder } or null if none succeed.
 *
 * None of these are trusted to apply the container's irot rotation: ffmpeg is
 * pinned with -noautorotate (its default varies by version), and the caller
 * re-applies rotation itself based on the decoded dimensions.
 */
async function externalDecodePng(file) {
  const out = `${file}.png`;
  try {
    const attempts = [
      [
        "ffmpeg",
        [
          "-y",
          "-loglevel",
          "error",
          "-noautorotate",
          "-i",
          file,
          "-frames:v",
          "1",
          out,
        ],
      ],
      ["avifdec", ["--jobs", "all", file, out]],
      ["magick", [file, out]],
      ["convert", [file, out]],
    ];
    for (const [cmd, args] of attempts) {
      if (await tryExec(cmd, args)) {
        return { png: await fs.readFile(out), decoder: cmd };
      }
    }
    return null;
  } finally {
    await fs.rm(out, { force: true });
  }
}

/** Resize an already-oriented raster to the AVIF thumbnail. The input must
 *  carry no rotation state: sharp materializes a pending .rotate() into BOTH
 *  rotated pixels and an irot property when saving AVIF (double rotation in
 *  browsers), so rotation is always baked into a clean PNG first. */
function encodeThumb(input) {
  return sharp(input)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .avif({ quality: THUMB_QUALITY })
    .toBuffer();
}

/** Bake a rotation into clean pixels: returns { png, width, height } with the
 *  rotation applied and no orientation/irot metadata left behind (PNG output
 *  materializes the rotation and can carry no orientation state). Pass
 *  rotateCw = null to auto-orient by EXIF instead of an explicit angle. */
async function bakeRotation(input, rotateCw) {
  const pipeline = sharp(input, { failOn: "none" });
  const { data, info } = await (
    rotateCw === null ? pipeline.rotate() : pipeline.rotate(rotateCw)
  )
    .png()
    .toBuffer({ resolveWithObject: true });
  return { png: data, width: info.width, height: info.height };
}

/**
 * Produce a thumbnail buffer + original oriented dimensions.
 *
 * 1. HDR (PQ/HLG) inputs pass through as downscaled 10-bit HDR AVIF (the
 *    browser handles tone-mapping for SDR displays) — sharp can't touch 10-bit
 *    AVIF, and a naive SDR decode of PQ looks washed-out/gray.
 * 2. Otherwise (SDR JPEG/PNG/WebP/8-bit AVIF/HEIC): sharp directly, with
 *    ffmpeg / avifdec / ImageMagick as a fallback for AVIF & HEIC sharp can't
 *    read. For gain-map JPEG/HEIC this uses the SDR base (the primary image).
 */
async function makeThumb(buf) {
  const tmpIn = path.join(os.tmpdir(), `gallery-src-${crypto.randomUUID()}`);
  try {
    await fs.writeFile(tmpIn, buf);

    // Browsers orient AVIF/HEIC by the container's irot (EXIF Orientation is
    // ignored there) — every decode path below must end up matching that.
    const heif = isHeifFamily(buf) ? heifDisplayProps(buf) : null;
    const rotationCw = heif?.rotationCw ?? 0;

    const hdr = await hdrPassthrough(tmpIn, rotationCw);
    if (hdr) return hdr;

    // SDR path.
    try {
      const meta = await sharp(buf, { failOn: "none" }).metadata();
      const exifOriented = !heif && (meta.orientation ?? 1) !== 1;

      if (!rotationCw && !exifOriented) {
        // No rotation in play — single pass. (metadata() alone doesn't prove
        // the pixels are decodable; toBuffer() below is what throws for AVIFs
        // sharp can't read, falling through to the external decoders.)
        const thumb = await encodeThumb(buf);
        return {
          thumb,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
        };
      }

      // Rotation involved: bake it into a clean PNG first, then encode.
      // Never in one pipeline — see encodeThumb. For HEIF the pixel decode
      // may or may not have irot applied (sharp's metadata reports display
      // dims either way and can't be trusted); probe the real pixel
      // orientation with a tiny decode and bake only what's missing.
      let bake = null; // null → auto-orient by EXIF (the non-HEIF case)
      if (heif) {
        const probe = await sharp(buf, { failOn: "none" })
          .resize(16, 16, { fit: "inside" })
          .toBuffer({ resolveWithObject: true });
        const pixelsAreCoded =
          probe.info.width > probe.info.height ===
          heif.codedWidth > heif.codedHeight;
        // Squares and 180° are dimension-ambiguous; sharp 0.34.5 is observed
        // NOT to apply irot to pixels, so treat "ambiguous" as unapplied.
        bake = pixelsAreCoded ? rotationCw : 0;
      }
      const oriented = await bakeRotation(buf, bake);
      return {
        thumb: await encodeThumb(oriented.png),
        width: oriented.width,
        height: oriented.height,
      };
    } catch (err) {
      // sharp can't read some AVIF (10-bit) and no HEIC at all — decode those
      // externally. Non-HEIF formats sharp already rejected for a real reason.
      if (!isHeifFamily(buf)) throw err;
      const decoded = await externalDecodePng(tmpIn);
      if (!decoded) {
        throw new Error(
          "sharp could not decode this image and no external decoder " +
            "(ffmpeg / avifdec / ImageMagick) is available"
        );
      }
      const meta = await sharp(decoded.png).metadata();
      // Re-apply the irot rotation the decoder didn't: ffmpeg never does (we
      // pin -noautorotate); for avifdec/magick detect it from whether the
      // decoded dims are already swapped. 180° from a non-ffmpeg decoder is
      // undetectable by dims — assume applied (libheif-backed magick does).
      let rotateCw = 0;
      if (rotationCw && decoded.decoder === "ffmpeg") {
        rotateCw = rotationCw;
      } else if (rotationCw % 180 === 90) {
        const alreadySwapped =
          heif.codedWidth !== heif.codedHeight &&
          meta.width === heif.codedHeight;
        rotateCw = alreadySwapped ? 0 : rotationCw;
      }
      if (rotateCw) {
        const oriented = await bakeRotation(decoded.png, rotateCw);
        return {
          thumb: await encodeThumb(oriented.png),
          width: oriented.width,
          height: oriented.height,
        };
      }
      return {
        thumb: await encodeThumb(decoded.png),
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      };
    }
  } finally {
    await fs.rm(tmpIn, { force: true });
  }
}

/* ---------------------------------- exif ---------------------------------- */

const round1 = n => Math.round(n * 10) / 10;

function formatShutter(seconds) {
  if (!(seconds > 0)) return undefined;
  if (seconds >= 1) return String(round1(seconds));
  return `1/${Math.round(1 / seconds)}`;
}

function toISODate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

const EXIF_FIELDS = [
  "Make",
  "Model",
  "LensModel",
  "LensInfo",
  "FNumber",
  "ExposureTime",
  "ISO",
  "ISOSpeedRatings",
  "FocalLength",
  "FocalLengthIn35mmFormat",
  "DateTimeOriginal",
];

/** Fallback reader for containers exifr can't parse (e.g. ImageMagick-written
 *  AVIF): same whitelist via the exiftool CLI. GPS is never requested. */
async function exiftoolExif(buf) {
  const tmp = path.join(
    os.tmpdir(),
    `gallery-exif-${process.pid}-${crypto.randomBytes(4).toString("hex")}`
  );
  try {
    await fs.writeFile(tmp, buf);
    const out = await execOut("exiftool", [
      "-json",
      "-n",
      ...EXIF_FIELDS.map(f => `-${f}`),
      tmp,
    ]);
    if (!out) return undefined;
    const row = JSON.parse(out)?.[0];
    if (!row) return undefined;
    if (typeof row.DateTimeOriginal === "string") {
      // Normalize the naive "YYYY:MM:DD HH:MM:SS" EXIF date the way exifr does.
      const m = row.DateTimeOriginal.match(
        /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
      );
      row.DateTimeOriginal = m
        ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
        : undefined;
    }
    return row;
  } catch {
    return undefined;
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

/** Extract a privacy-safe EXIF subset (GPS is never requested). */
async function extractExif(buf) {
  let raw;
  try {
    raw = await exifr.parse(buf, { pick: EXIF_FIELDS });
  } catch {
    raw = undefined;
  }
  const hasData = raw && EXIF_FIELDS.some(f => raw[f] != null);
  if (!hasData) raw = await exiftoolExif(buf);
  if (!raw) return undefined;

  const exif = {};
  if (raw.Make) exif.make = String(raw.Make).trim();
  if (raw.Model) exif.model = String(raw.Model).trim();
  const lens = raw.LensModel || raw.LensInfo;
  if (lens) {
    exif.lens = (Array.isArray(lens) ? lens.join(" ") : String(lens)).trim();
  }
  if (typeof raw.FNumber === "number") exif.f = round1(raw.FNumber);
  if (typeof raw.ExposureTime === "number") {
    const shutter = formatShutter(raw.ExposureTime);
    if (shutter) exif.shutter = shutter;
  }
  const iso = raw.ISO ?? raw.ISOSpeedRatings;
  const isoValue = Array.isArray(iso) ? iso[0] : iso;
  if (typeof isoValue === "number") exif.iso = Math.round(isoValue);
  if (typeof raw.FocalLength === "number") {
    exif.focal = Math.round(raw.FocalLength);
  }
  if (typeof raw.FocalLengthIn35mmFormat === "number") {
    exif.focal35 = Math.round(raw.FocalLengthIn35mmFormat);
  }
  if (raw.DateTimeOriginal) {
    const taken = toISODate(raw.DateTimeOriginal);
    if (taken) exif.taken = taken;
  }
  return Object.keys(exif).length ? exif : undefined;
}

/* -------------------------------- manifest -------------------------------- */

function thumbName(url) {
  return `${crypto.createHash("sha256").update(url).digest("hex").slice(0, 16)}.avif`;
}

/** Recursively sort object keys for stable, prettier-clean diffs. */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort())
      out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

async function readManifest() {
  try {
    return JSON.parse(await fs.readFile(MANIFEST_FILE, "utf8"));
  } catch {
    return {};
  }
}

async function writeManifest(manifest) {
  await fs.mkdir(path.dirname(MANIFEST_FILE), { recursive: true });
  const json = JSON.stringify(sortKeys(manifest), null, 2) + "\n";
  await fs.writeFile(MANIFEST_FILE, json);
}

// Serialize manifest writes so concurrent workers can flush progress mid-run
// (making a long run resumable) without ever racing on the file.
let manifestFlush = Promise.resolve();
function flushManifest(manifest) {
  manifestFlush = manifestFlush
    .then(() => writeManifest(manifest))
    .catch(() => {});
  return manifestFlush;
}

/* ---------------------------------- pool ---------------------------------- */

/** Run `worker` over `items` with a fixed concurrency. */
async function pool(items, size, worker) {
  const queue = [...items.entries()];
  const runners = Array.from(
    { length: Math.min(size, queue.length) },
    async () => {
      for (;;) {
        const next = queue.shift();
        if (!next) return;
        await worker(next[1], next[0]);
      }
    }
  );
  await Promise.all(runners);
}

/* ---------------------------------- main ---------------------------------- */

async function main() {
  const config = await loadConfig();
  const gallery = config?.features?.gallery;
  if (!gallery?.enabled) {
    console.log("Gallery feature disabled — nothing to generate.");
    return;
  }
  const domains = new Set(gallery.imageDomains ?? []);
  if (domains.size === 0) {
    console.log("No `imageDomains` configured — nothing to generate.");
    return;
  }

  const urls = await collectUrls(domains);
  console.log(
    `Found ${urls.size} whitelisted image(s) across gallery posts ` +
      `(domains: ${[...domains].join(", ")}).`
  );

  await fs.mkdir(THUMBS_DIR, { recursive: true });
  const manifest = await readManifest();

  const failures = [];
  let generated = 0;
  let skipped = 0;

  await pool([...urls], CONCURRENCY, async url => {
    const name = thumbName(url);
    const outPath = path.join(THUMBS_DIR, name);

    // Incremental: skip when the manifest entry and its thumbnail both exist.
    const existing = manifest[url];
    if (existing?.thumb === name) {
      try {
        await fs.access(outPath);
        skipped += 1;
        return;
      } catch {
        // Thumbnail missing — regenerate below.
      }
    }

    try {
      const res = await fetch(url, { headers: fetchHeaders(url) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());

      const [{ thumb, width, height }, exif] = await Promise.all([
        makeThumb(buf),
        extractExif(buf),
      ]);
      await fs.writeFile(outPath, thumb);

      manifest[url] = { width, height, thumb: name, ...(exif ? { exif } : {}) };
      generated += 1;
      await flushManifest(manifest); // durable progress for resumable runs
      console.log(`✓ ${name}  ${width}×${height}  ${url}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ url, message });
      console.error(`✗ ${url}\n    ${message}`);
    }
  });

  // Prune manifest entries + thumbnail files no longer referenced.
  if (shouldPrune) {
    for (const url of Object.keys(manifest)) {
      if (!urls.has(url)) {
        const stale = manifest[url]?.thumb;
        delete manifest[url];
        if (stale) await fs.rm(path.join(THUMBS_DIR, stale), { force: true });
      }
    }
    const referenced = new Set(Object.values(manifest).map(e => e.thumb));
    for (const file of await fs.readdir(THUMBS_DIR).catch(() => [])) {
      if (file.endsWith(".avif") && !referenced.has(file)) {
        await fs.rm(path.join(THUMBS_DIR, file), { force: true });
      }
    }
  }

  await manifestFlush; // let any in-flight periodic flush settle first
  await writeManifest(manifest);

  console.log(
    `\nDone: ${generated} generated, ${skipped} skipped, ${failures.length} failed.`
  );
  if (failures.length > 0) {
    console.error(
      `\n${failures.length} image(s) failed:\n` +
        failures.map(f => `  - ${f.url}: ${f.message}`).join("\n")
    );
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
