interface SiteConfig {
  /** Deployed URL of the site, e.g. "https://example.com" */
  url: string;
  /** Blog title shown in header and meta tags */
  title: string;
  /** Short description used in SEO meta and RSS feed */
  description: string;
  /** Default post author name */
  author: string;
  /** Author profile URL (used in structured data) */
  profile?: string;
  /** Fallback OG image filename in /public, e.g. "og.jpg" */
  ogImage?: string;
  /** HTML lang attribute, defaults to "en" */
  lang?: string;
  /** IANA timezone for post dates, e.g. "Asia/Bangkok" */
  timezone?: string;
  /** Text direction */
  dir?: "ltr" | "rtl" | "auto";
  /** Google Search Console verification meta tag value */
  googleVerification?: string;
}

interface PostsConfig {
  /** Posts per page on paginated listing pages */
  perPage?: number;
  /** Posts shown on the index/home page */
  perIndex?: number;
  /**
   * @deprecated No longer has any effect. Publishing is day-granular: a post is
   * listed from the start of its `pubDatetime` day in the site timezone, so
   * there is no sub-day boundary left for a margin to cover. Safe to remove.
   */
  scheduledPostMargin?: number;
}

interface FeaturesConfig {
  /** Enable light/dark mode toggle. Defaults to true. */
  lightAndDarkMode?: boolean;
  /**
   * Generate dynamic OG images per post and provide `/og.png` when the static
   * `public/{site.ogImage}` file is absent. When false, that file is required
   * for the default layout OG image (build fails if missing).
   */
  dynamicOgImage?: boolean;
  /** Show the /archives page and link it in nav. Defaults to true. */
  showArchives?: boolean;
  /** Show back button on post detail pages. Defaults to true. */
  showBackButton?: boolean;
  /** "Edit page" link shown on post detail pages. */
  editPost?:
    | {
        enabled: true;
        /** Base URL for the edit link, e.g. GitHub edit URL */
        url: string;
      }
    | { enabled: false };
  /**
   * Search provider. "pagefind" ships in the base template.
   * Set to false to disable search entirely.
   */
  search?: "pagefind" | false;
  /**
   * Optional semantic-search panel on the search page, backed by the public
   * endpoint of a Cloudflare AI Search instance, e.g.
   * "https://<id>.search.ai.cloudflare.com". Only its `/search` route is used,
   * and only on the Pagefind search page: Pagefind keeps answering instantly
   * and remains the fallback whenever the semantic side fails or times out.
   * Off unless an endpoint is set here or via the `PUBLIC_AI_SEARCH_URL` env
   * var; `false` turns it off even when the env var is set.
   */
  aiSearch?:
    | {
        /** Public endpoint URL; overrides `PUBLIC_AI_SEARCH_URL`. */
        endpoint?: string;
        /** Give up on a request after this many ms. Defaults to 5000. */
        timeoutMs?: number;
        /** Posts listed in the panel. Defaults to 5. */
        maxResults?: number;
        /** Minimum vector similarity (0–1) a chunk needs. Defaults to 0.4. */
        matchThreshold?: number;
      }
    | false;
  /**
   * Photo gallery page (/gallery) collecting media from posts' bodies.
   * A post's `gallery` frontmatter flag is its DEFAULT state — `true` selects
   * its media, unset leaves it out — and either can be overridden per image by
   * the markdown title `"gallery"` / `"nogallery"`, so an ordinary post may
   * contribute a single photo and a gallery post may keep a screenshot out.
   * Only media hosted on one of `imageDomains` is ever included — a marker
   * cannot override the whitelist.
   * Thumbnails, video posters and intrinsic dimensions are pre-generated into
   * the repo by `scripts/generate-gallery-thumbs.mjs` (run locally or via
   * .github/workflows/gallery.yml).
   */
  gallery?:
    | {
        enabled: true;
        /**
         * Hostnames whose media is collected, e.g. ["img.example.com"].
         * Gates videos as well as images — a `.mp4`/`.webm`/`.mov`/`.m4v` URL
         * on one of these hosts becomes a video item.
         */
        imageDomains: string[];
      }
    | { enabled: false };
  /**
   * Table of contents beside post articles (side rail ≥1280px, floating
   * button + sheet below). A post's `toc` frontmatter overrides the threshold:
   * `false` hides it, `true` shows it whatever the heading count.
   * A plain boolean, as upstream AstroPaper writes it, turns the feature on
   * (with the default thresholds) or off.
   */
  toc?:
    | boolean
    | {
        enabled: true;
        /** Fewest listed headings before the TOC appears. Defaults to 3. */
        minHeadings?: number;
        /** Deepest heading level listed (h2…h4). Defaults to 3. */
        maxDepth?: 2 | 3 | 4;
      }
    | { enabled: false };
  /**
   * Estimated reading time after the date, on post cards and the post header.
   * CJK characters and Latin words are counted separately and added up; hidden
   * on `gallery: true` posts. Defaults to true.
   */
  readingTime?: boolean;
  /**
   * Up to three posts sharing the most tags, listed after the share links.
   * Nothing is shown for a post whose tags no other post has. Defaults to true.
   */
  relatedPosts?: boolean;
}

/** `features.toc` with its defaults applied. */
type ResolvedTocConfig =
  | { enabled: true; minHeadings: number; maxDepth: 2 | 3 | 4 }
  | { enabled: false };

interface SocialLink {
  /**
   * Must match an SVG filename in src/assets/icons/socials/.
   * e.g. "github" → src/assets/icons/socials/github.svg
   */
  name: string;
  url: string;
  /**
   * Accessible label for the icon link (aria-label, title attribute).
   * Auto-generated if omitted: "{site.title} on GitHub", "Send an email to {site.title}", etc.
   * Override when the default wording doesn't fit.
   */
  linkTitle?: string;
}

interface ShareLink {
  /**
   * Must match an SVG filename in src/assets/icons/socials/.
   * e.g. "facebook" → src/assets/icons/socials/facebook.svg
   */
  name: string;
  /**
   * Share URL template. `{url}` and `{title}` are replaced by the post's URL
   * and title, both URL-encoded, e.g.
   * "https://x.com/intent/post?url={url}&text={title}". A template with
   * neither placeholder gets the encoded post URL appended instead, e.g.
   * "https://www.facebook.com/sharer.php?u=".
   */
  url: string;
  /** Rendering style used by the source icon. Defaults to "outline". */
  iconStyle?: "outline" | "solid";
  /**
   * Accessible label for the icon link (aria-label, title attribute).
   * Auto-generated if omitted: "Share this post on Facebook", "Share this post via WhatsApp", etc.
   * Override when the default wording doesn't fit.
   */
  linkTitle?: string;
}

export interface AstroPaperConfig {
  site: SiteConfig;
  posts?: PostsConfig;
  features?: FeaturesConfig;
  /** Social profile links shown in header/footer */
  socials?: SocialLink[];
  /** Share links shown on post detail pages */
  shareLinks?: ShareLink[];
}

type ResolvedSiteConfig = Required<
  Pick<
    SiteConfig,
    | "url"
    | "title"
    | "description"
    | "author"
    | "lang"
    | "timezone"
    | "dir"
    | "ogImage"
  >
> &
  Pick<SiteConfig, "profile" | "googleVerification">;

type ResolvedAiSearchConfig = Required<
  Exclude<NonNullable<FeaturesConfig["aiSearch"]>, false>
>;

type ResolvedFeaturesConfig = Required<
  Omit<FeaturesConfig, "aiSearch" | "toc">
> & {
  /** `false` when no endpoint is configured. */
  aiSearch: ResolvedAiSearchConfig | false;
  toc: ResolvedTocConfig;
};

export interface ResolvedAstroPaperConfig {
  site: ResolvedSiteConfig;
  posts: Required<PostsConfig>;
  features: ResolvedFeaturesConfig;
  socials: SocialLink[];
  shareLinks: ShareLink[];
}

/**
 * Type helper for astro-paper.config.ts.
 * Provides full IntelliSense without any runtime overhead.
 */
export function defineAstroPaperConfig(
  config: AstroPaperConfig
): AstroPaperConfig {
  return config;
}
