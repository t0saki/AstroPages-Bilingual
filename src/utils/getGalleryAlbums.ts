import type { CollectionEntry } from "astro:content";
import type {
  GalleryAlbum,
  GalleryExif,
  GalleryManifest,
  GalleryPhoto,
} from "@/types/gallery";
import type { UIStrings } from "@/i18n/types";
import { postFilter } from "./postFilter";
import { getPostSlug, getPostUrl } from "./getPostPaths";
import { getAssetPath } from "./withBase";
import { isVideoUrl, parseGalleryMarker, stripMarkdownCode } from "./media";
import {
  buildFacetGroups,
  resolveFacets,
  type FacetGroup,
  type FacetSource,
} from "./galleryFacets";
import config from "@/config";

/**
 * Markdown media matcher: `![alt](url "optional title")` — group 1 is the alt
 * text, group 2 the URL, group 3 the title (which may carry a gallery marker,
 * see `parseGalleryMarker`).
 * URLs may not contain spaces or a closing paren (image-host URLs never do).
 * Videos use this same syntax and are told apart by their extension, so one
 * pattern collects both. It is always run over a `stripMarkdownCode`-ed body,
 * so an image quoted inside a code fence isn't mistaken for a real one. This
 * MUST stay in sync with the regex in `scripts/generate-gallery-thumbs.mjs` so
 * the site and the thumbnail generator collect exactly the same set of media.
 */
const MEDIA_RE = /!\[(.*?)\]\(\s*([^)\s]+?)(?:\s+["']([^"']*)["'])?\s*\)/g;

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

/** Ditto for videos (16:9), whose posters are only produced by the generator. */
const FALLBACK_VIDEO_WIDTH = 1920;
const FALLBACK_VIDEO_HEIGHT = 1080;

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

/** The EXIF a manifest entry contributes to the /gallery filter facets. */
function getFacetSource(url: string): FacetSource {
  const exif = manifest[url]?.exif;
  if (!exif) return {};
  return {
    camera: normalizeCamera(exif),
    lens: exif.lens?.trim() || undefined,
    model: exif.model?.trim() || undefined,
    focal35: exif.focal35,
  };
}

/** Resolve facets over every item of the given albums, in album order. */
function resolveAlbumFacets(albums: GalleryAlbum[]) {
  return resolveFacets(
    albums.flatMap(album => album.photos.map(p => getFacetSource(p.src)))
  );
}

/** Build one item, joining the manifest entry (or falling back to the original). */
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
      type: entry.type,
      duration: entry.duration,
    };
  }
  // Fallback: the generator hasn't run yet. An image can stand in for its own
  // thumbnail; a video can't, so it renders as a poster-less 16:9 tile.
  if (isVideoUrl(url)) {
    return {
      src: url,
      width: FALLBACK_VIDEO_WIDTH,
      height: FALLBACK_VIDEO_HEIGHT,
      alt,
      type: "video",
    };
  }
  return {
    src: url,
    thumbSrc: url,
    width: FALLBACK_WIDTH,
    height: FALLBACK_HEIGHT,
    alt,
  };
}

/** Per-photo data the post pages ship to their client script. */
export interface ArticleImageInfo {
  camera?: string;
  settings?: string;
  /** Intrinsic dimensions from the manifest — sizes the PhotoSwipe slide. */
  width?: number;
  height?: number;
}

/**
 * Hover-info map for one post body: image URL → formatted EXIF display lines
 * plus intrinsic dimensions. Only images present in the gallery manifest get
 * an entry (a dimensions-only one when the photo carries no EXIF) — post
 * pages use entry presence to decide which article images receive the
 * gallery-style hover overlay. Videos are excluded: in an article they play
 * inline with native controls rather than opening the viewer.
 */
export function getArticleImageInfo(
  body: string
): Record<string, ArticleImageInfo> {
  if (!config.features.gallery.enabled) return {};
  const info: Record<string, ArticleImageInfo> = {};
  for (const match of stripMarkdownCode(body).matchAll(MEDIA_RE)) {
    let url = match[2]?.trim() ?? "";
    if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
    const entry = manifest[url];
    if (!entry || entry.type === "video" || url in info) continue;
    info[url] = {
      camera: entry.exif ? formatCameraLine(entry.exif) : undefined,
      settings: entry.exif ? formatSettingsLine(entry.exif) : undefined,
      width: entry.width,
      height: entry.height,
    };
  }
  return info;
}

/**
 * Extract whitelisted media from a post body, de-duplicated, in document order.
 *
 * `includeByDefault` is the post's frontmatter `gallery` flag: it decides the
 * unmarked items, while a `"gallery"` / `"nogallery"` title overrides it for a
 * single one. The `domains` whitelist is checked either way, so a marker can
 * never admit media from an unconfigured host.
 *
 * Code is stripped first, so a post that documents the markdown syntax doesn't
 * turn its own examples into an album.
 */
function extractPhotos(
  body: string,
  domains: Set<string>,
  includeByDefault: boolean
): GalleryPhoto[] {
  const photos: GalleryPhoto[] = [];
  const seen = new Set<string>();
  for (const match of stripMarkdownCode(body).matchAll(MEDIA_RE)) {
    const alt = match[1]?.trim() ?? "";
    let url = match[2]?.trim() ?? "";
    if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1);
    if (!url || seen.has(url)) continue;
    const marker = parseGalleryMarker(match[3]);
    if (marker === "exclude") continue;
    if (marker !== "include" && !includeByDefault) continue;
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
 * convention). Every post is scanned: `gallery: true` makes its whitelisted
 * media selected by default, and a per-image `"gallery"` / `"nogallery"` title
 * overrides that either way, so an ordinary post contributes an album as soon
 * as one of its photos opts in. Media must still sit on a configured
 * `imageDomains` host. Posts left with no selected media are dropped, and
 * albums are ordered newest-first.
 */
export function getGalleryAlbums(
  posts: CollectionEntry<"posts">[]
): GalleryAlbum[] {
  const gallery = config.features.gallery;
  if (!gallery.enabled) return [];
  const domains = new Set(gallery.imageDomains);

  const albums = posts
    .filter(postFilter)
    .sort(
      (a, b) =>
        new Date(b.data.pubDatetime).getTime() -
        new Date(a.data.pubDatetime).getTime()
    )
    .map(post => {
      const photos = extractPhotos(
        post.body ?? "",
        domains,
        post.data.gallery === true
      );
      if (!photos.length) return null;
      return {
        post: {
          title: post.data.title,
          url: getPostUrl(post.id, post.filePath),
          date: new Date(post.data.pubDatetime),
          timezone: post.data.timezone,
          slug: getPostSlug(post.id, post.filePath)
            .replace(/^\//, "")
            .replaceAll("/", "-"),
        },
        photos,
      } satisfies GalleryAlbum;
    })
    .filter((album): album is GalleryAlbum => album !== null);

  // Flattening nested paths can collide ("a/b-c" vs "a-b/c"); album slugs
  // become section ids, so suffix repeats in (date-sorted) album order.
  const usedSlugs = new Set<string>();
  for (const album of albums) {
    const base = album.post.slug;
    let slug = base;
    for (let n = 2; usedSlugs.has(slug); n++) slug = `${base}-${n}`;
    usedSlugs.add(slug);
    album.post.slug = slug;
  }

  // Facet slugs depend on the whole collection (collision suffixes, the lens
  // label's focal mode), so they are attached once every album exists.
  const { items } = resolveAlbumFacets(albums);
  let i = 0;
  for (const album of albums) {
    for (const photo of album.photos) {
      const facets = items[i++];
      if (facets) photo.facets = facets;
    }
  }
  return albums;
}

/**
 * The filter dimensions the /gallery page renders for these albums (as
 * returned by `getGalleryAlbums`): only those with at least two known values.
 * An empty result means the page shows no filter UI at all.
 */
export function getGalleryFacets(
  albums: GalleryAlbum[],
  t: UIStrings
): FacetGroup[] {
  const { labels } = resolveAlbumFacets(albums);
  return buildFacetGroups(
    albums.flatMap(album => album.photos.map(photo => photo.facets)),
    labels,
    t
  );
}
