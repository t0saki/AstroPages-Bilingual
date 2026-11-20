import type { CollectionEntry } from "astro:content";
import config from "@/config";
import { resolveTimezone } from "./resolveTimezone";

/**
 * Calendar year, month (1–12) and day of a post's `pubDatetime`, read in the
 * post's own timezone (falling back to the site's) — the same clock
 * Datetime.astro formats dates with.
 *
 * `Date#getFullYear()`/`getMonth()` would use the build machine's zone
 * instead: Cloudflare Pages builds in UTC, so a post published at 00:30 on
 * 1 January in Singapore would be filed under the previous December while
 * its date reads "2026年1月1日", and a local build could file it elsewhere
 * than CI.
 */
export function getPostDateParts({ data }: CollectionEntry<"posts">) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(data.timezone ?? config.site.timezone),
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(data.pubDatetime);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(p => p.type === type)?.value);

  return { year: part("year"), month: part("month"), day: part("day") };
}
