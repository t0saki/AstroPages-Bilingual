/**
 * Types for the photo gallery feature.
 *
 * The gallery collects images and videos from posts that set `gallery: true`
 * in their frontmatter. Thumbnails (video posters included) and EXIF are
 * pre-generated into the repo by
 * `scripts/generate-gallery-thumbs.mjs` (see `src/data/gallery-manifest.json`).
 * The site build reads only the manifest — it never downloads or transcodes.
 */

/**
 * EXIF fields surfaced in the UI. All optional — a photo may carry any subset.
 * GPS is never extracted or stored (privacy): it is intentionally absent here.
 */
export interface GalleryExif {
  /** Camera manufacturer, e.g. "Apple", "NIKON CORPORATION" */
  make?: string;
  /** Camera model, e.g. "iPhone 15 Pro", "NIKON D3300" */
  model?: string;
  /** Lens model, stored verbatim; normalized for display */
  lens?: string;
  /** Aperture f-number, one decimal, e.g. 1.8 */
  f?: number;
  /** Shutter speed as a display string, e.g. "1/333" */
  shutter?: string;
  /** ISO sensitivity, e.g. 64 */
  iso?: number;
  /** Focal length in mm (actual), rounded */
  focal?: number;
  /** 35mm-equivalent focal length in mm, rounded */
  focal35?: number;
  /** Capture time as an ISO date string */
  taken?: string;
}

/** One manifest record, keyed by the original media URL. */
export interface GalleryManifestEntry {
  /** Intrinsic width of the source (after orientation) */
  width: number;
  /** Intrinsic height of the source (after orientation) */
  height: number;
  /**
   * Thumbnail filename under `public/gallery/thumbs/`. For a video this is the
   * poster frame, generated from the clip itself.
   */
  thumb: string;
  /** Extracted EXIF, when present */
  exif?: GalleryExif;
  /** Media kind. Absent means an image — the overwhelming majority. */
  type?: "video";
  /** Video duration in seconds, one decimal. Absent for images. */
  duration?: number;
}

/** The whole manifest: original URL → entry. */
export type GalleryManifest = Record<string, GalleryManifestEntry>;

/** A single photo or video prepared for rendering. */
export interface GalleryPhoto {
  /** Original (full-resolution) media URL — used for the lightbox */
  src: string;
  /**
   * Thumbnail URL (repo asset), or the original URL as a fallback. Undefined
   * only for a video whose poster has not been generated yet — there is no
   * cheap stand-in for a clip the way the original file is for an image.
   */
  thumbSrc?: string;
  /** Intrinsic width used for layout aspect-ratio and PhotoSwipe */
  width: number;
  /** Intrinsic height used for layout aspect-ratio and PhotoSwipe */
  height: number;
  /** Caption (the image's markdown alt text) */
  alt: string;
  /** Display line 2: camera model + lens, if available */
  camera?: string;
  /** Display line 3: shooting parameters, e.g. "24mm · ƒ/1.8 · 1/333s · ISO 64" */
  settings?: string;
  /** Media kind. Absent means an image. */
  type?: "video";
  /** Video duration in seconds, shown as a badge on the grid item. */
  duration?: number;
  /** Filter slugs for the /gallery facets; absent when it has none of them. */
  facets?: GalleryPhotoFacets;
}

/**
 * URL-safe slugs placing a photo in each filter dimension (see
 * `src/utils/galleryFacets.ts`). A key is omitted when the photo lacks that
 * dimension, so the client can offer an "unknown" choice for it.
 */
export interface GalleryPhotoFacets {
  /** Normalized camera name, slugified */
  camera?: string;
  /** Raw lens string, slugified */
  lens?: string;
  /** 35mm-equivalent focal bucket, e.g. "24-35" */
  focal?: string;
}

/** A group of photos belonging to one post, linked back to the post. */
export interface GalleryAlbum {
  post: {
    title: string;
    url: string;
    date: Date;
    /** The post's `timezone`; unset means the site timezone */
    timezone: string | undefined;
    /** Locale-independent post slug, e.g. "japan-travel" — the album's anchor */
    slug: string;
  };
  photos: GalleryPhoto[];
}
