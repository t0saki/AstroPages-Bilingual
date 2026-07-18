/**
 * Shared PhotoSwipe wrapper for every photo-viewing surface (the gallery grid
 * and post articles): one look (blurred translucent backdrop, see `.pswp__bg`
 * in global.css), one caption UI (title + camera + shooting settings, see
 * `.pswp-caption`), localized button titles. Surfaces differ only in their
 * data source — keep viewer behavior here so they can't drift apart.
 */
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

type LightboxOptions = ConstructorParameters<typeof PhotoSwipeLightbox>[0];

export interface CaptionLines {
  title?: string;
  camera?: string;
  settings?: string;
}

export interface ViewerStrings {
  close?: string;
  zoom?: string;
  prev?: string;
  next?: string;
  error?: string;
}

/** Parse the localized button titles off a `data-pswp-strings` element. */
export function parseViewerStrings(el: HTMLElement | null): ViewerStrings {
  try {
    return JSON.parse(el?.dataset.pswpStrings ?? "{}");
  } catch {
    return {};
  }
}

/**
 * Caption lines from a slide's source element (a gallery `<a>` wrapping an
 * `<img>`, or an article `<img>` itself) decorated with `data-exif-*`.
 */
export function captionFromElement(el: HTMLElement | undefined): CaptionLines {
  if (!el) return {};
  const img = el instanceof HTMLImageElement ? el : el.querySelector("img");
  return {
    title: img?.getAttribute("alt") ?? undefined,
    camera: el.dataset.exifCamera,
    settings: el.dataset.exifSettings,
  };
}

export function createViewer(
  options: LightboxOptions,
  strings: ViewerStrings = {},
  captionFor?: (element: HTMLElement | undefined) => CaptionLines
): PhotoSwipeLightbox {
  const lightbox = new PhotoSwipeLightbox({
    pswpModule: () => import("photoswipe"),
    // Translucent near-black over a backdrop blur (`.pswp__bg` in global.css):
    // immersive, but the page glows through faintly at the edges.
    bgOpacity: 0.8,
    closeTitle: strings.close,
    zoomTitle: strings.zoom,
    arrowPrevTitle: strings.prev,
    arrowNextTitle: strings.next,
    errorMsg: strings.error,
    ...options,
  });

  lightbox.on("uiRegister", () => {
    lightbox.pswp?.ui?.registerElement({
      name: "viewer-caption",
      order: 9,
      isButton: false,
      appendTo: "root",
      onInit: (el, pswp) => {
        el.className = "pswp-caption";
        const update = () => {
          const element = pswp.currSlide?.data?.element as
            | HTMLElement
            | undefined;
          const cap = (captionFor ?? captionFromElement)(element);
          el.replaceChildren();
          const lines: Array<[string | undefined, string]> = [
            [cap.title, "cap-title"],
            [cap.camera, "cap-meta"],
            [cap.settings, "cap-meta"],
          ];
          for (const [text, cls] of lines) {
            if (!text) continue;
            const span = document.createElement("span");
            span.className = cls;
            span.textContent = text; // textContent → XSS-safe
            el.appendChild(span);
          }
        };
        pswp.on("change", update);
        update();
      },
    });
  });

  return lightbox;
}
