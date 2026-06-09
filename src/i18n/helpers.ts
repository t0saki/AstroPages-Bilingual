/**
 * Bilingual routing helpers (fork-specific).
 *
 * Routing scheme: Chinese (default locale) is served at the site root (`/foo`),
 * English is served under the `/en/` prefix (`/en/foo`). Astro's native i18n
 * (`Astro.currentLocale`, `getRelativeLocaleUrl`) handles locale detection and
 * link building; these helpers only cover the language switcher, which needs to
 * map the current URL to its counterpart in the other language.
 */

export const DEFAULT_LOCALE = "zh";

export const LOCALES = [
  { code: "zh", label: "中文" },
  { code: "en", label: "English" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

/** Detect the locale from a URL pathname (en under `/en/`, otherwise zh). */
export function getLocaleFromPath(pathname: string): Locale {
  const first = pathname.split("/").filter(Boolean)[0];
  return first === "en" ? "en" : "zh";
}

/**
 * Map `pathname` to its equivalent in `target` locale.
 * e.g. `/posts/welcome/` → `/en/posts/welcome/` (zh→en) and back (en→zh).
 * Preserves a trailing slash for non-root paths (build emits `dir/index.html`).
 */
export function getAlternatePath(pathname: string, target: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "en") parts.shift(); // drop the current English prefix
  if (target === "en") parts.unshift("en");
  if (parts.length === 0) return "/";
  const path = "/" + parts.join("/");
  return pathname.endsWith("/") ? `${path}/` : path;
}
