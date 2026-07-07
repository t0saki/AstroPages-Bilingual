import type { CollectionEntry } from "astro:content";
import type {
  GalleryAlbum,
  GalleryExif,
  GalleryManifest,
  GalleryPhoto,
} from "@/types/gallery";
import { postFilter } from "./postFilter";
import { getPostUrl } from "./getPostPaths";
import { getAssetPath } from "./withBase";
import config from "@/config";

/**
 * Markdown image matcher: `![alt](url "optional title")`.
 * URLs may not contain spaces or a closing paren (image-host URLs never do).
 * This MUST stay in sync with the regex in
 * `scripts/generate-gallery-thumbs.mjs` so the site and the thumbnail
 * generator collect exactly the same set of images.
 */
const IMAGE_RE = /!\[([^\]]*)\]\(\s*([^)\s]+?)(?:\s+["'][^"']*["'])?\s*\)/g;

// Optionally import the generated manifest. `import.meta.glob` degrades to an
// empty object when the file is absent, so the build never breaks before the
// thumbnail generator has run (fresh clones, forks that haven't run it yet).
const manifestModules = import.meta.glob("../data/gallery-manifest.json", {
  eager: true,
  import: "default",
}) as Record<string, GalleryManifest>;
const manifest: GalleryManifest = Object.values(manifestModules)[0] ?? {};

/** Default fallback dimensions (3:2) for photos not yet in the manifest. */
const FALLBACK_WIDTH = 1600;
const FALLBACK_HEIGHT = 1067;

/**
 * Normalize the camera name: prefix the make's brand token only when the model
 * doesn't already contain it. This keeps "NIKON CORPORATION" + "NIKON D3300"
 * as "NIKON D3300", turns "OLYMPUS IMAGING CORP." + "E-M1" into "OLYMPUS E-M1"
 * (dropping the corporate noise), and "Apple" + "iPhone 15 Pro" into
 * "Apple iPhone 15 Pro".
 */
function normalizeCamera(exif: GalleryExif): string | undefined {
  const make = exif.make?.trim();
  const model = exif.model?.trim();
  if (!model) return make || undefined;
  if (!make) return model;
  const brand = make.split(/\s+/)[0];
  return model.toLowerCase().includes(brand.toLowerCase())
    ? model
    : `${brand} ${model}`;
}

/**
 * Normalize the lens string: drop a leading duplicate of the model, and render
 * apertures with the italic ƒ glyph. Stored verbatim, cleaned only for display.
 */
function normalizeLens(exif: GalleryExif): string | undefined {
  let lens = exif.lens?.trim();
  if (!lens) return undefined;
  const model = exif.model?.trim();
  if (model && lens.startsWith(model)) {
    lens = lens.slice(model.length).trim();
  }
  lens = lens.replace(/\bf\//gi, "ƒ/");
  return lens || undefined;
}

/** Display line 2: "camera · lens" (either part omitted when missing). */
export function formatCameraLine(exif: GalleryExif): string | undefined {
  const camera = normalizeCamera(exif);
  const lens = normalizeLens(exif);
  if (camera && lens) return `${camera} · ${lens}`;
  return camera ?? lens;
}

/** Display line 3: "24mm · ƒ/1.8 · 1/333s · ISO 64" (35mm-equiv focal preferred). */
export function formatSettingsLine(exif: GalleryExif): string | undefined {
  const parts: string[] = [];
  const focal = exif.focal35 ?? exif.focal;
  if (focal) parts.push(`${Math.round(focal)}mm`);
  if (exif.f) parts.push(`ƒ/${exif.f}`);
  if (exif.shutter) parts.push(`${exif.shutter}s`);
  if (exif.iso) parts.push(`ISO ${exif.iso}`);
  return parts.length ? parts.join(" · ") : undefined;
}

/** Build one photo, joining the manifest entry (or falling back to the original). */
function buildPhoto(url: string, alt: string): GalleryPhoto {
  const entry = manifest[url];
  if (entry) {
    return {
      src: url,
      thumbSrc: getAssetPath(`gallery/thumbs/${entry.thumb}`),
      width: entry.width,
      height: entry.height,
      alt,
      camera: entry.exif ? formatCameraLine(entry.exif) : undefined,
      settings: entry.exif ? formatSettingsLine(entry.exif) : undefined,
    };
  }
  // Fallback: thumbnail not generated yet — load the original at 3:2.
  return {
    src: url,
    thumbSrc: url,
    width: FALLBACK_WIDTH,
    height: FALLBACK_HEIGHT,
    alt,
  };
}

/** Extract whitelisted images from a post body, de-duplicated, in document order. */
function extractPhotos(body: string, domains: Set<string>): GalleryPhoto[] {
  const photos: GalleryPhoto[] = [];
  const seen = new Set<string>();
  for (const match of body.matchAll(IMAGE_RE)) {
    const alt = match[1]?.trim() ?? "";
    let url = match[2]?.trim() ?? "";
    if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
    if (!url || seen.has(url)) continue;
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue; // relative paths / non-absolute URLs are ignored
    }
    if (!domains.has(hostname)) continue;
    seen.add(url);
    photos.push(buildPhoto(url, alt));
  }
  return photos;
}

/**
 * Collect gallery albums from a locale's posts.
 *
 * Pages pass their own locale-filtered collection (matching the existing util
 * convention). Only posts with `gallery: true` whose images are hosted on a
 * configured `imageDomains` host contribute. Albums are ordered newest-first.
 */
export function getGalleryAlbums(
  posts: CollectionEntry<"posts">[]
): GalleryAlbum[] {
  const gallery = config.features.gallery;
  if (!gallery.enabled) return [];
  const domains = new Set(gallery.imageDomains);

  return posts
    .filter(postFilter)
    .filter(post => post.data.gallery === true)
    .sort(
      (a, b) =>
        new Date(b.data.pubDatetime).getTime() -
        new Date(a.data.pubDatetime).getTime()
    )
    .map(post => {
      const photos = extractPhotos(post.body ?? "", domains);
      if (!photos.length) return null;
      return {
        post: {
          title: post.data.title,
          url: getPostUrl(post.id, post.filePath),
          date: new Date(post.data.pubDatetime),
        },
        photos,
      } satisfies GalleryAlbum;
    })
    .filter((album): album is GalleryAlbum => album !== null);
}
