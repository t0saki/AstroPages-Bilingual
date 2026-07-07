/**
 * Types for the photo gallery feature.
 *
 * The gallery collects images from posts that set `gallery: true` in their
 * frontmatter. Thumbnails and EXIF are pre-generated into the repo by
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

/** One manifest record, keyed by the original image URL. */
export interface GalleryManifestEntry {
  /** Intrinsic width of the source image (after orientation) */
  width: number;
  /** Intrinsic height of the source image (after orientation) */
  height: number;
  /** Thumbnail filename under `public/gallery/thumbs/` */
  thumb: string;
  /** Extracted EXIF, when present */
  exif?: GalleryExif;
}

/** The whole manifest: original URL → entry. */
export type GalleryManifest = Record<string, GalleryManifestEntry>;

/** A single photo prepared for rendering. */
export interface GalleryPhoto {
  /** Original (full-resolution) image URL — used for the lightbox */
  src: string;
  /** Thumbnail URL (repo asset), or the original URL as a fallback */
  thumbSrc: string;
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
}

/** A group of photos belonging to one post, linked back to the post. */
export interface GalleryAlbum {
  post: {
    title: string;
    url: string;
    date: Date;
  };
  photos: GalleryPhoto[];
}
