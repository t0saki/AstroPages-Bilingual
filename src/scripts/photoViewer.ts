/**
 * Shared PhotoSwipe wrapper for every photo-viewing surface (the gallery grid
 * and post articles): one look (blurred translucent backdrop, see `.pswp__bg`
 * in global.css), one caption UI (title + camera + shooting settings, see
 * `.pswp-caption`), localized button titles. Surfaces differ only in their
 * data source — keep viewer behavior here so they can't drift apart.
 *
 * Video slides (gallery items marked `data-pswp-type="video"`) are handled here
 * too, as a custom content type. Article videos deliberately never reach the
 * viewer: they play inline with native controls.
 */
import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
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
  videoError?: string;
}

/**
 * How much of a video's bottom edge belongs to its native control bar. A
 * pointer landing in that strip must reach the controls rather than start a
 * PhotoSwipe swipe, or the scrubber is impossible to drag.
 */
const VIDEO_CONTROLS_ZONE_PX = 64;

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
 *
 * `data-caption` backs the alt text for a video tile whose poster hasn't been
 * generated yet — there is no `<img>` to read it off.
 */
export function captionFromElement(el: HTMLElement | undefined): CaptionLines {
  if (!el) return {};
  const img = el instanceof HTMLImageElement ? el : el.querySelector("img");
  return {
    title: img?.getAttribute("alt") || el.dataset.caption || undefined,
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
    // Bundled rather than `() => import("photoswipe")`. As a dynamic import the
    // ~15 KB (brotli) core was only requested on the first tap, where it queued
    // behind whatever images were still streaming — on a slow link that left the
    // lightbox unopenable for tens of seconds after the tap. It is smaller than
    // a single thumbnail, so paying for it up front on the script's priority
    // lane is the better trade.
    pswpModule: PhotoSwipe,
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

  registerVideoContent(lightbox, strings);

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
            HTMLElement | undefined;
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

/**
 * Teach a lightbox to show `type: "video"` slides.
 *
 * PhotoSwipe 5 has no video content type of its own: `Content.load()` builds an
 * `<img>` for image slides and an `innerHTML` div for everything else, and
 * returns early once `contentLoad` is default-prevented — so the handler owns
 * element creation from there.
 *
 * Every hook no-ops on surfaces that have no video slides (article pages), so
 * this stays a single code path rather than a per-surface option.
 */
function registerVideoContent(
  lightbox: PhotoSwipeLightbox,
  strings: ViewerStrings
): void {
  const videoOf = (content: { element?: HTMLElement }) =>
    content.element?.querySelector("video") ?? null;

  const play = (content?: { element?: HTMLElement }) => {
    // Autoplay may still be refused (data-saver, a user preference). The poster
    // and controls are already there, so a rejection needs no recovery.
    if (content)
      void videoOf(content)
        ?.play()
        .catch(() => {});
  };
  const pause = (content?: { element?: HTMLElement }) => {
    if (content) videoOf(content)?.pause();
  };

  lightbox.on("contentLoad", e => {
    if (e.content.data.type !== "video") return;
    e.preventDefault();

    const wrapper = document.createElement("div");
    // `pswp__content` is what PhotoSwipe sizes and positions; the second class
    // is ours to style (see `.pswp-video` in global.css).
    wrapper.className = "pswp__content pswp-video";

    const video = document.createElement("video");
    video.src = e.content.data.src ?? "";
    // Muted is what makes autoplay permissible at all; the reader can unmute
    // from the native controls.
    video.muted = true;
    video.playsInline = true;
    video.controls = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", e.content.data.alt ?? "");
    // The grid thumbnail doubles as the poster: it is already in cache.
    if (e.content.data.msrc) video.poster = e.content.data.msrc;
    video.addEventListener("error", () => e.content.onError());

    wrapper.appendChild(video);
    e.content.element = wrapper;
  });

  lightbox.on("contentActivate", e => play(e.content));
  lightbox.on("contentDeactivate", e => pause(e.content));
  // The first slide activates before the opening animation appends it, so its
  // contentActivate lands on an element that is not in the document yet.
  lightbox.on("appendHeavyContent", e => {
    if (e.slide.isActive) play(e.slide.content);
  });
  lightbox.on("close", () => pause(lightbox.pswp?.currSlide?.content));
  lightbox.on("contentDestroy", e => {
    const video = videoOf(e.content);
    if (!video) return;
    // PhotoSwipe only releases `element` for image content, so drop the source
    // by hand to free the decoder and whatever has been buffered.
    video.pause();
    video.removeAttribute("src");
    video.load();
  });

  // PhotoSwipe preventDefaults mouse events to suppress the browser's native
  // image dragging; on a <video> that also swallows clicking play and dragging
  // the scrubber.
  lightbox.addFilter("preventPointerEvent", (prevent, event) =>
    (event.target as HTMLElement | null)?.tagName === "VIDEO" ? false : prevent
  );

  // A drag starting on the control bar is a scrub, not a swipe to the next
  // slide. Starting anywhere else on the video still swipes, as on a photo.
  lightbox.on("pointerDown", e => {
    const target = e.originalEvent.target as HTMLElement | null;
    if (target?.tagName !== "VIDEO") return;
    const bounds = target.getBoundingClientRect();
    if (e.originalEvent.clientY >= bounds.bottom - VIDEO_CONTROLS_ZONE_PX) {
      e.preventDefault();
    }
  });

  lightbox.addFilter("contentErrorElement", (element, content) => {
    if (content.data.type === "video" && strings.videoError) {
      element.textContent = strings.videoError;
    }
    return element;
  });
}
