import { BLOG_PATH } from "@/config";
import { slugifyStr } from "./slugify";
import { defaultLang } from "@/i18n/ui";

/**
 * Get full path of a blog post
 * @param id - id of the blog post (aka slug)
 * @param filePath - the blog post full file location
 * @param includeBase - whether to include `/posts` in return value
 * @returns blog post path
 */
export function getPath(
  id: string,
  filePath: string | undefined,
  includeBase = true
) {
  // Extract language prefix from id (e.g., "zh/welcome" -> "zh")
  const idParts = id.split("/");
  const langPrefix = idParts.length > 1 ? idParts[0] : "";
  const slug = idParts.length > 1 ? idParts.slice(1).join("/") : id;

  const pathSegments = filePath
    ?.replace(BLOG_PATH, "")
    .split("/")
    .filter(path => path !== "") // remove empty string in the segments ["", "other-path"] <- empty string will be removed
    .filter(path => !path.startsWith("_")) // exclude directories start with underscore "_"
    .filter(path => path !== langPrefix) // exclude language directory from path segments
    .slice(0, -1) // remove the last segment (file name) since it's unnecessary
    .map(segment => slugifyStr(segment)); // slugify each segment path

  // Build base path with language prefix for i18n routing
  // Default locale (Chinese) has no prefix, English has /en prefix
  const langUrlPrefix = langPrefix === defaultLang ? "" : (langPrefix ? `/${langPrefix}` : "");
  const basePath = includeBase
    ? `${langUrlPrefix}/posts`
    : "";

  // If not inside the sub-dir (other than lang), simply return the file path
  if (!pathSegments || pathSegments.length < 1) {
    return [basePath, slug].join("/");
  }

  return [basePath, ...pathSegments, slug].join("/");
}
