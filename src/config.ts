/**
 * Internal resolved configuration used throughout the codebase.
 *
 * Prefer editing `astro-paper.config.ts` instead of this file. This module exists to
 * apply defaults and expose a fully-resolved config shape (`ResolvedAstroPaperConfig`).
 */
import userConfig from "@/astro-paper.config";
import type {
  AstroPaperConfig,
  ResolvedAstroPaperConfig,
} from "./types/config";
import {
  PUBLIC_AI_SEARCH_URL,
  PUBLIC_GOOGLE_SITE_VERIFICATION,
} from "astro:env/client";

const DEFAULT_OG_IMAGE = "default-og.jpg";

/**
 * On unless explicitly disabled; thresholds filled in either way. Upstream's
 * boolean form (`toc: true` / `toc: false`) is accepted as a shorthand.
 */
function resolveToc(
  toc: NonNullable<AstroPaperConfig["features"]>["toc"]
): ResolvedAstroPaperConfig["features"]["toc"] {
  if (toc === false) return { enabled: false };
  const options = typeof toc === "object" ? toc : undefined;
  if (options?.enabled === false) return { enabled: false };
  return {
    enabled: true,
    minHeadings: options?.minHeadings ?? 3,
    maxDepth: options?.maxDepth ?? 3,
  };
}

/**
 * The semantic-search panel is on only when an endpoint comes from the user
 * config or `PUBLIC_AI_SEARCH_URL` (config wins); an explicit `false` in the
 * config keeps it off even when the env var is set.
 */
function resolveAiSearch(): ResolvedAstroPaperConfig["features"]["aiSearch"] {
  const aiSearch = userConfig.features?.aiSearch;
  if (aiSearch === false) return false;

  const endpoint = (aiSearch?.endpoint || PUBLIC_AI_SEARCH_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (!endpoint) return false;

  return {
    endpoint,
    timeoutMs: aiSearch?.timeoutMs ?? 5000,
    maxResults: aiSearch?.maxResults ?? 5,
    matchThreshold: aiSearch?.matchThreshold ?? 0.4,
  };
}

const config: ResolvedAstroPaperConfig = {
  site: {
    ...userConfig.site,
    ogImage: userConfig.site.ogImage ?? DEFAULT_OG_IMAGE,
    lang: userConfig.site.lang ?? "en",
    timezone: userConfig.site.timezone ?? "UTC",
    dir: userConfig.site.dir ?? "ltr",
    googleVerification:
      userConfig.site.googleVerification || PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  posts: {
    perPage: userConfig.posts?.perPage ?? 4,
    perIndex: userConfig.posts?.perIndex ?? 4,
    // Deprecated and unused. Not read from userConfig, so builds don't warn about it.
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: userConfig.features?.lightAndDarkMode ?? true,
    dynamicOgImage: userConfig.features?.dynamicOgImage ?? true,
    showArchives: userConfig.features?.showArchives ?? true,
    showBackButton: userConfig.features?.showBackButton ?? true,
    editPost: userConfig.features?.editPost ?? { enabled: false },
    search: userConfig.features?.search ?? "pagefind",
    aiSearch: resolveAiSearch(),
    gallery: userConfig.features?.gallery ?? { enabled: false },
    toc: resolveToc(userConfig.features?.toc),
    readingTime: userConfig.features?.readingTime ?? true,
    relatedPosts: userConfig.features?.relatedPosts ?? true,
  },
  socials: userConfig.socials ?? [],
  shareLinks: userConfig.shareLinks ?? [],
};

export default config;
