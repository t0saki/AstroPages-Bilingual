/**
 * Post page enhancements, shared by the zh and en post pages: the reading
 * progress bar, the back-to-top button (markup in
 * src/pages/posts/[...slug]/_components/BackToTopButton.astro), heading anchor
 * links and code copy buttons.
 *
 * Headings and code blocks inside a `.not-prose` subtree are left alone: that
 * is a component the post placed in the article, which brings its own markup
 * and behaviour (README, "Per-post components"). The article's styles stop at
 * the same boundary (typography.css).
 *
 * This is a bundled module, run once per page instance through `onPageReady`.
 * Every listener it adds hangs off one `AbortController` that
 * `astro:before-swap` aborts, so none outlives its page: a `document` scroll
 * handler left behind would keep firing on every later page and keep the old
 * page's DOM alive.
 */

import { tplStr } from "@/i18n/format";

/** Share of the page scrolled past before the back-to-top button shows. */
const BACK_TO_TOP_THRESHOLD = 0.3;

/** How long "Copied" / "Copy failed" stays on a copy button. */
const COPY_FEEDBACK_MS = 1500;

/**
 * UI strings, rendered by BackToTopButton.astro as JSON in
 * `#post-enhance-config[data-strings]` for the page's locale. The English
 * fallbacks only matter if that element is missing.
 */
interface PostStrings {
  copyCode: string;
  codeCopied: string;
  copyFailed: string;
  /** Placeholder: {{heading}} */
  headingAnchor: string;
}

const FALLBACK_STRINGS: PostStrings = {
  copyCode: "Copy",
  codeCopied: "Copied",
  copyFailed: "Copy failed",
  headingAnchor: "Link to section: {{heading}}",
};

/** Inside a `.not-prose` subtree, which the enhancements skip. */
const inNotProse = (element: Element) => element.closest(".not-prose") !== null;

/** Cleanup for the page instance currently wired up. */
let teardown: (() => void) | null = null;

function readStrings(): PostStrings {
  const config = document.getElementById("post-enhance-config");
  try {
    return {
      ...FALLBACK_STRINGS,
      ...JSON.parse(config?.dataset.strings ?? "{}"),
    };
  } catch {
    return FALLBACK_STRINGS;
  }
}

/**
 * A heading's text as a reader reads it, for the anchor's accessible name.
 * `textContent` is wrong wherever the heading holds rendered markup: KaTeX
 * emits each formula twice (MathML plus an `aria-hidden` HTML copy) and a
 * footnote reference glues its number onto the last word. Same rules as
 * src/utils/rehype/rehypeTocLabels.ts, which does this at build time for the
 * TOC — but only for the headings the TOC lists.
 */
function readableText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element)) return "";
  if (
    node.getAttribute("aria-hidden") === "true" ||
    node.hasAttribute("data-footnote-ref")
  ) {
    return "";
  }
  if (node.classList.contains("katex")) {
    const tex = node.querySelector('annotation[encoding="application/x-tex"]');
    if (tex) return tex.textContent ?? "";
  }
  return Array.from(node.childNodes, readableText).join("");
}

/**
 * A "#" link after each heading of the article, pointing at its `id`. The "#"
 * itself is decoration, so the link is named after the section it links to —
 * without a name, screen readers announced 28 bare "link"s on a long post.
 */
function addHeadingLinks(article: HTMLElement, strings: PostStrings) {
  const headings = article.querySelectorAll<HTMLElement>(
    ":is(h2, h3, h4, h5, h6)[id]"
  );
  for (const heading of headings) {
    if (inNotProse(heading)) continue;
    const text = readableText(heading).replace(/\s+/g, " ").trim();

    heading.classList.add("group");
    const link = document.createElement("a");
    link.className =
      "heading-link ms-2 no-underline opacity-75 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100";
    link.href = `#${heading.id}`;
    link.setAttribute(
      "aria-label",
      tplStr(strings.headingAnchor, { heading: text })
    );

    const span = document.createElement("span");
    span.ariaHidden = "true";
    span.textContent = "#";
    link.appendChild(span);
    heading.appendChild(link);
  }
}

/**
 * A copy button on every code block of the article. The outcome shows on the
 * button and is announced through a visually hidden live region: the button's
 * own label changing is not reliably read out. Returns a canceller for the
 * pending feedback timers.
 */
function attachCopyButtons(
  article: HTMLElement,
  strings: PostStrings,
  signal: AbortSignal
) {
  const codeBlocks = Array.from(article.querySelectorAll("pre")).filter(
    codeBlock => !inNotProse(codeBlock)
  );
  const timers = new Map<HTMLButtonElement, number>();
  if (codeBlocks.length === 0) return () => {};

  const status = document.createElement("span");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  document.body.appendChild(status);

  for (const codeBlock of codeBlocks) {
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";

    // Shiki's file-name transformer (src/utils/transformers/fileName.js)
    // records where its label sits; line the button up with it.
    const hasFileNameOffset =
      getComputedStyle(codeBlock)
        .getPropertyValue("--file-name-offset")
        .trim() !== "";
    const topClass = hasFileNameOffset ? "top-(--file-name-offset)" : "-top-3";

    const button = document.createElement("button");
    button.type = "button";
    button.className = `copy-code absolute end-3 ${topClass} rounded bg-muted border border-muted px-2 py-1 text-xs leading-4 text-foreground font-medium`;
    button.textContent = strings.copyCode;
    codeBlock.setAttribute("tabindex", "0");
    codeBlock.appendChild(button);

    codeBlock.parentNode?.insertBefore(wrapper, codeBlock);
    wrapper.appendChild(codeBlock);

    button.addEventListener(
      "click",
      async () => {
        const text = codeBlock.querySelector("code")?.innerText ?? "";
        let copied = true;
        try {
          // Rejects when permission is denied; `navigator.clipboard` is
          // missing altogether outside a secure context (plain-http preview).
          await navigator.clipboard.writeText(text);
        } catch {
          copied = false;
        }
        if (signal.aborted) return;

        const message = copied ? strings.codeCopied : strings.copyFailed;
        button.textContent = message;
        // Empty first, so a second identical message is announced again.
        status.textContent = "";
        requestAnimationFrame(() => (status.textContent = message));

        window.clearTimeout(timers.get(button));
        timers.set(
          button,
          window.setTimeout(() => {
            timers.delete(button);
            button.textContent = strings.copyCode;
            status.textContent = "";
          }, COPY_FEEDBACK_MS)
        );
      },
      { signal }
    );
  }

  return () => {
    for (const timer of timers.values()) window.clearTimeout(timer);
    timers.clear();
  };
}

/**
 * Reading progress: a bar across the top of the viewport and, on phones, a
 * ring around the back-to-top button, which itself shows once the reader is
 * past `BACK_TO_TOP_THRESHOLD`. One rAF-throttled passive scroll handler
 * drives all three.
 */
function initScrollChrome(signal: AbortSignal) {
  const root = document.documentElement;

  const progressContainer = document.createElement("div");
  progressContainer.className =
    "progress-container fixed top-0 z-10 h-1 w-full bg-background";
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar h-1 w-0 bg-accent";
  progressBar.id = "myBar";
  progressContainer.appendChild(progressBar);
  document.body.appendChild(progressContainer);

  const btnContainer = document.getElementById("btt-btn-container");
  const backToTopBtn = btnContainer?.querySelector<HTMLButtonElement>(
    "[data-button='back-to-top']"
  );
  const progressIndicator = document.getElementById("progress-indicator");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  backToTopBtn?.addEventListener(
    "click",
    () => {
      // Decided here rather than left to `<html>`'s scroll-behavior, so
      // reduced motion holds whatever the page CSS says: from the end of a
      // long post this is tens of thousands of pixels of motion.
      window.scrollTo({
        top: 0,
        behavior: reduceMotion.matches ? "instant" : "smooth",
      });
    },
    { signal }
  );

  let lastVisible: boolean | null = null;
  function update() {
    const scrollTotal = root.scrollHeight - root.clientHeight;
    // A page that doesn't scroll has no progress to show: a full bar would
    // just be a stray accent line across the top of the viewport.
    const progress = scrollTotal > 0 ? root.scrollTop / scrollTotal : 0;
    const percent = Math.floor(progress * 100);

    progressBar.style.width = `${percent}%`;
    progressIndicator?.style.setProperty(
      "background-image",
      `conic-gradient(var(--accent), var(--accent) ${percent}%, transparent ${percent}%)`
    );

    const visible = scrollTotal > 0 && progress > BACK_TO_TOP_THRESHOLD;
    if (btnContainer && visible !== lastVisible) {
      btnContainer.classList.toggle("opacity-100", visible);
      btnContainer.classList.toggle("translate-y-0", visible);
      btnContainer.classList.toggle("opacity-0", !visible);
      btnContainer.classList.toggle("translate-y-14", !visible);
      // Hidden means gone: no taps, no Tab stop, nothing in the a11y tree.
      btnContainer.inert = !visible;
      lastVisible = visible;
    }
  }

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  const options = { signal, passive: true };
  window.addEventListener("scroll", schedule, options);
  window.addEventListener("resize", schedule, options);
  update();

  return () => cancelAnimationFrame(frame);
}

export function initPostEnhance() {
  const article = document.getElementById("article");
  // Enhancing is not idempotent (it inserts anchors, buttons, a progress
  // bar), so a second run on the same page — a second copy of this module
  // registered by some other entry point — must be a no-op.
  if (article?.dataset.postEnhanced !== undefined) return;

  teardown?.();
  if (!article) return;
  article.dataset.postEnhanced = "";

  const controller = new AbortController();
  const { signal } = controller;

  const strings = readStrings();
  addHeadingLinks(article, strings);
  const cancelCopyTimers = attachCopyButtons(article, strings, signal);
  const cancelFrame = initScrollChrome(signal);

  const cleanup = () => {
    controller.abort();
    cancelCopyTimers();
    cancelFrame();
    if (teardown === cleanup) teardown = null;
  };
  teardown = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { signal });
}
