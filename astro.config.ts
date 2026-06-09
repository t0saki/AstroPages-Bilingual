import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";
import keystatic from "@keystatic/astro";
import cloudflare from "@astrojs/cloudflare";
import { unified } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import config from "./astro-paper.config";

export default defineConfig({
  site: config.site.url,

  // Bilingual: Chinese is the default locale served at root (`/`),
  // English is served under the `/en/` prefix.
  // `redirectToDefaultLocale` must be false in Astro 6 when prefixDefaultLocale
  // is false; the legacy `/zh/*` -> `/*` behaviour is handled by dedicated
  // redirect routes + the client-side preferred-language script.
  i18n: {
    defaultLocale: "zh",
    locales: ["zh", "en"],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  integrations: [
    mdx(),
    sitemap({
      filter: page => {
        // Exclude the legacy /zh/* redirect routes from the sitemap.
        if (page.includes("/zh/")) return false;
        // Exclude archives when the feature is disabled.
        return (
          config.features?.showArchives !== false ||
          !page.endsWith("/archives/")
        );
      },
    }),
    // React + Keystatic power the Git-based CMS admin UI at /keystatic.
    react(),
    keystatic(),
  ],

  markdown: {
    processor: unified({
      remarkPlugins: [
        remarkToc,
        [remarkCollapse, { test: "Table of contents" }],
      ],
      rehypePlugins: [rehypeCallouts],
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
    optimizeDeps: {
      // @resvg/resvg-js ships native bindings used by the OG image renderer.
      // @keystatic/* register a `virtual:keystatic-config` module that the
      // esbuild dep-optimizer cannot resolve; exclude them so they are handled
      // by the Keystatic Vite plugin instead.
      exclude: [
        "@resvg/resvg-js",
        "@keystatic/astro",
        "@keystatic/core",
        "@astrojs/cloudflare/entrypoints/server",
      ],
    },
    ssr: {
      external: ["@resvg/resvg-js"],
    },
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
    },
  },

  experimental: {
    svgOptimizer: svgoOptimizer(),
  },

  adapter: cloudflare(),
});
