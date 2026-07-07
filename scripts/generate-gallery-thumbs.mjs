/**
 * Gallery thumbnail + EXIF generator.
 *
 * Scans posts with `gallery: true`, collects their whitelisted image-host URLs,
 * downloads each once, extracts a privacy-safe EXIF subset (never GPS), and
 * writes an 800px AVIF thumbnail plus a manifest. The Astro build reads only the
 * manifest — it never downloads or transcodes.
 *
 * Decode chain (some image hosts serve 10-bit AVIF that sharp's prebuilt libaom
 * cannot decode): try sharp directly, then fall back to `avifdec` / ImageMagick
 * to rasterize to PNG before sharp re-encodes the thumbnail.
 *
 * Usage:
 *   node scripts/generate-gallery-thumbs.mjs [--prune]
 *
 * Requires Node >= 22 (native fetch). `avifdec` (libavif-bin) and/or ImageMagick
 * are only needed when a source image is an AVIF that sharp cannot decode.
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
const HDR_SCRIPT = path.join(ROOT, "scripts/hdr_tonemap.py");

const CONCURRENCY = Number(process.env.GALLERY_CONCURRENCY) || 4;
const THUMB_SIZE = 800;
const THUMB_QUALITY = 60;
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

/** Sniff an ISOBMFF/AVIF container. */
function isAvif(buf) {
  if (buf.length < 12 || buf.toString("latin1", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("latin1", 8, 12);
  if (["avif", "avis", "mif1", "miaf"].includes(brand)) return true;
  return buf.toString("latin1", 0, 64).includes("avif");
}

/** Run a command, resolving true on exit 0 and false on error / non-zero. */
function tryExec(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", code => resolve(code === 0));
  });
}

/** Run a command, resolving its exit code (-1 if it couldn't be spawned). */
function execCode(cmd, args) {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: "ignore" });
    child.on("error", () => resolve(-1));
    child.on("close", code => resolve(code ?? -1));
  });
}

/**
 * Tone-map an HDR (PQ/HLG) image file to an sRGB PNG buffer via hdr_tonemap.py
 * (color-science-correct: PQ EOTF → BT.2390 → P3/2020→709 → sRGB OETF).
 * Returns null when the input is not HDR (script exit 3) or the tool chain
 * (python3 / numpy / ffmpeg) is unavailable — the caller then uses the SDR path.
 */
async function hdrTonemapToPng(file) {
  const out = `${file}.tm.png`;
  try {
    const code = await execCode("python3", [HDR_SCRIPT, file, out]);
    return code === 0 ? await fs.readFile(out) : null;
  } finally {
    await fs.rm(out, { force: true });
  }
}

/** Rasterize an AVIF buffer to PNG via avifdec or ImageMagick; null if none work. */
async function externalDecodeAvif(buf) {
  const tmpIn = path.join(os.tmpdir(), `gallery-${crypto.randomUUID()}.avif`);
  const tmpOut = `${tmpIn}.png`;
  try {
    await fs.writeFile(tmpIn, buf);
    const attempts = [
      ["avifdec", ["--jobs", "all", tmpIn, tmpOut]],
      ["magick", [tmpIn, tmpOut]],
      ["convert", [tmpIn, tmpOut]],
    ];
    for (const [cmd, args] of attempts) {
      if (await tryExec(cmd, args)) {
        return await fs.readFile(tmpOut);
      }
    }
    return null;
  } finally {
    await fs.rm(tmpIn, { force: true });
    await fs.rm(tmpOut, { force: true });
  }
}

/** Oriented (display) dimensions, accounting for EXIF orientation. */
function orientedDims(meta) {
  const o = meta.orientation ?? 1;
  return o >= 5
    ? { width: meta.height ?? 0, height: meta.width ?? 0 }
    : { width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** Resize an already-decoded (oriented) PNG/sharp input to the AVIF thumbnail. */
function encodeThumb(input) {
  return sharp(input)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "inside", withoutEnlargement: true })
    .avif({ quality: THUMB_QUALITY })
    .toBuffer();
}

/**
 * Produce a thumbnail buffer + original oriented dimensions.
 *
 * 1. HDR (PQ/HLG) inputs are tone-mapped to sRGB by hdr_tonemap.py — sharp's
 *    prebuilt libaom can't decode 10-bit AVIF anyway, and a naive decode of PQ
 *    looks washed-out/gray without tone mapping.
 * 2. Otherwise (SDR JPEG/PNG/WebP/8-bit AVIF): sharp directly, with avifdec /
 *    ImageMagick as a fallback for AVIF sharp can't read.
 */
async function makeThumb(buf) {
  const tmpIn = path.join(os.tmpdir(), `gallery-src-${crypto.randomUUID()}`);
  try {
    await fs.writeFile(tmpIn, buf);

    const hdrPng = await hdrTonemapToPng(tmpIn);
    if (hdrPng) {
      // The tone-mapped PNG is already display-oriented sRGB.
      const meta = await sharp(hdrPng).metadata();
      return {
        thumb: await encodeThumb(hdrPng),
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      };
    }

    // SDR path.
    try {
      const meta = await sharp(buf, { failOn: "none" }).rotate().metadata();
      const thumb = await sharp(buf, { failOn: "none" })
        .rotate()
        .resize(THUMB_SIZE, THUMB_SIZE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .avif({ quality: THUMB_QUALITY })
        .toBuffer();
      return { thumb, ...orientedDims(meta) };
    } catch (err) {
      if (!isAvif(buf)) throw err;
      const png = await externalDecodeAvif(buf);
      if (!png) {
        throw new Error(
          "sharp could not decode this AVIF and no external decoder " +
            "(avifdec / ImageMagick) is available"
        );
      }
      const meta = await sharp(png).metadata();
      return {
        thumb: await encodeThumb(png),
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

/** Extract a privacy-safe EXIF subset (GPS is never requested). */
async function extractExif(buf) {
  let raw;
  try {
    raw = await exifr.parse(buf, {
      pick: [
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
      ],
    });
  } catch {
    return undefined;
  }
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
