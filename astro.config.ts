import { copyFile } from "node:fs/promises";
import type { AstroIntegration } from "astro";
import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { rehypeHeadingIds, unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkMath from "remark-math";
import rehypeCallouts from "rehype-callouts";
import rehypeKatex from "rehype-katex";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import rehypeGalleryMarker from "./src/utils/rehype/rehypeGalleryMarker";
import rehypeVideoEmbed from "./src/utils/rehype/rehypeVideoEmbed";
import rehypeTocLabels from "./src/utils/rehype/rehypeTocLabels";
import rehypeTableWrap from "./src/utils/rehype/rehypeTableWrap";
import rehypeImageAttrs from "./src/utils/rehype/rehypeImageAttrs";
import rehypeEmphasisParagraph from "./src/utils/rehype/rehypeEmphasisParagraph";
import config from "./astro-paper.config";

const DEFAULT_LOCALE = "zh";
const LOCALES = ["zh", "en"];
/** Locales served under a `/<locale>/` prefix: all but the default. */
const PREFIXED_LOCALES = LOCALES.filter(locale => locale !== DEFAULT_LOCALE);

/** A prefixed locale's 404 page, in either build format. */
const LOCALE_404_PAGE = new RegExp(
  `/(?:${PREFIXED_LOCALES.join("|")})/404(?:/|\\.html)?$`
);

/**
 * Astro only treats the root 404 route as the 404 page. A prefixed locale's
 * (`src/pages/[lang]/404.astro`) is an ordinary route, built as
 * `<locale>/404/index.html`, while Cloudflare Pages answers a missing
 * `/<locale>/…` URL with the nearest `404.html`: copy it there. Nothing to do
 * when the page doesn't exist — a fork that deleted it, or
 * `build.format: "file"`, which writes `<locale>/404.html` itself.
 */
function localeNotFoundPages(locales: string[]): AstroIntegration {
  return {
    name: "locale-404-pages",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        for (const locale of locales) {
          try {
            await copyFile(
              new URL(`${locale}/404/index.html`, dir),
              new URL(`${locale}/404.html`, dir)
            );
            logger.info(`${locale}/404/index.html → ${locale}/404.html`);
          } catch (error) {
            if ((error as { code?: string }).code !== "ENOENT") throw error;
          }
        }
      },
    },
  };
}

// Pure-static build deployed to Cloudflare Pages.
// NOTE: the Astro 6 Cloudflare *Workers* adapter is intentionally NOT used here
// because its workerd prerenderer currently fails static builds
// (withastro/astro#15684, #15650). A Keystatic + Workers/SSR variant of this
// project is preserved on the `keystatic-workers` branch (see README).
export default defineConfig({
  site: config.site.url,

  // Bilingual: Chinese is the default locale served at root (`/`),
  // English is served under the `/en/` prefix.
  i18n: {
    defaultLocale: DEFAULT_LOCALE,
    locales: LOCALES,
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  integrations: [
    localeNotFoundPages(PREFIXED_LOCALES),
    mdx(),
    sitemap({
      filter: page => {
        // Exclude the legacy /zh/* paths from the sitemap.
        if (page.includes("/zh/")) return false;
        // Exclude the other locales' 404 pages, which Astro builds as
        // ordinary routes (see localeNotFoundPages).
        if (LOCALE_404_PAGE.test(page)) return false;
        // Exclude archives when the feature is disabled.
        if (
          config.features?.showArchives === false &&
          page.endsWith("/archives/")
        ) {
          return false;
        }
        // Exclude gallery when the feature is disabled.
        if (
          config.features?.gallery?.enabled !== true &&
          page.endsWith("/gallery/")
        ) {
          return false;
        }
        return true;
      },
    }),
  ],

  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
        remarkMath,
      ],
      // rehypeTocLabels records clean heading labels for the post TOC; it needs
      // KaTeX's output and the heading ids, so Astro's own rehypeHeadingIds
      // runs early here (its final pass keeps these ids unchanged).
      // rehypeGalleryMarker drops the `"gallery"`/`"nogallery"` image titles so
      // they never surface as tooltips; rehypeVideoEmbed then turns
      // `![caption](…/clip.mp4)` lines into real <video> players, and
      // rehypeImageAttrs gives the remaining images lazy loading and their
      // manifest size.
      // rehypeEmphasisParagraph marks paragraphs that are one long `*…*` (a
      // figure caption, typically) so Chinese emphasis dots skip them.
      // rehypeTableWrap puts each table in its own horizontal scroller so a
      // wide one can't widen the page on phones.
      // A fork that configures Astro's `base` must pass the same value here.
      rehypePlugins: [
        rehypeCallouts,
        rehypeKatex,
        rehypeHeadingIds,
        rehypeTocLabels,
        rehypeGalleryMarker,
        rehypeVideoEmbed,
        rehypeImageAttrs,
        rehypeEmphasisParagraph,
        rehypeTableWrap,
      ],
    }),
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.google(),
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],

  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      // Cloudflare AI Search public endpoint for the optional semantic panel
      // on /search (see `features.aiSearch` in astro-paper.config.ts).
      PUBLIC_AI_SEARCH_URL: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },

  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
