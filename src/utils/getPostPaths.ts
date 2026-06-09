import { getRelativeLocaleUrl } from "astro:i18n";
import { BLOG_PATH } from "@/content.config";
import { slugifyStr } from "./slugify";
import config from "@/config";

// Posts are organised by locale directory: src/content/posts/{zh,en}/...
// The leading directory selects the locale and is stripped from the public slug,
// so `zh/welcome` -> `/posts/welcome` and `en/welcome` -> `/en/posts/welcome`.
const LOCALE_DIRS = new Set<string>(["zh", "en"]);

/** All path segments below BLOG_PATH except the filename, slugified. */
function getRawSegments(filePath: string | undefined): string[] {
  return (
    filePath
      ?.replace(BLOG_PATH, "")
      .split("/")
      .filter(path => path !== "")
      .filter(path => !path.startsWith("_"))
      .slice(0, -1)
      .map(segment => slugifyStr(segment)) ?? []
  );
}

/** Path segments that form the slug — with the locale directory removed. */
function getSlugSegments(filePath: string | undefined): string[] {
  const segments = getRawSegments(filePath);
  return segments.length > 0 && LOCALE_DIRS.has(segments[0])
    ? segments.slice(1)
    : segments;
}

function getIdSlug(id: string): string {
  const postId = id.split("/");
  return postId.length > 0 ? String(postId[postId.length - 1]) : id;
}

function getPostSlugPath(id: string, filePath: string | undefined): string {
  const pathSegments = getSlugSegments(filePath);
  const slug = getIdSlug(id);
  return pathSegments.length > 0
    ? [...pathSegments, slug].join("/")
    : String(slug);
}

/** The locale a post belongs to, derived from its leading id segment (zh|en). */
export function getPostLocale(id: string): string {
  const first = id.split("/")[0];
  return LOCALE_DIRS.has(first) ? first : config.site.lang;
}

/**
 * Returns the slug-only path for use as a route param in `getStaticPaths`.
 * The locale directory is stripped (locale is encoded by the route tree).
 * e.g. `zh/my-post` -> `/my-post`
 */
export function getPostSlug(id: string, filePath: string | undefined): string {
  return `/${getPostSlugPath(id, filePath)}`;
}

/**
 * Returns a fully navigable, locale-aware URL for `<a href>` and RSS links.
 * The locale defaults to the post's own directory, so links resolve correctly
 * regardless of which language's page renders them.
 * e.g. `/posts/my-post` (zh) or `/en/posts/my-post` (en)
 */
export function getPostUrl(
  id: string,
  filePath: string | undefined,
  locale: string | undefined = getPostLocale(id)
): string {
  return getRelativeLocaleUrl(locale, `posts/${getPostSlugPath(id, filePath)}`);
}
