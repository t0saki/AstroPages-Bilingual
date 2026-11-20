import type { MarkdownHeading } from "astro";
import config from "@/config";
import { countTocItems, getTocItems, type TocItem } from "./getTocItems";

type PostTocInput = {
  /** `headings` from `render(post)`. */
  headings: MarkdownHeading[];
  /** Clean labels by heading id, as `rehypeTocLabels` recorded them. */
  labels?: Record<string, string>;
  /** The post's `toc` frontmatter: `false` hides, `true` forces. */
  toc?: boolean;
  /** The post's `hideToc` frontmatter, upstream's spelling of `toc: false`. */
  hideToc?: boolean;
};

/**
 * A post's table of contents, or `null` when it gets none: the feature is off,
 * the post opts out, or it lists fewer than `minHeadings` entries without
 * `toc: true`. Shared by the zh and en post pages so the rule lives once.
 */
export function getPostToc({
  headings,
  labels,
  toc,
  hideToc,
}: PostTocInput): { items: TocItem[]; forced: boolean } | null {
  const tocConfig = config.features.toc;
  if (!tocConfig.enabled || toc === false || hideToc) return null;

  const items = getTocItems(headings, { maxDepth: tocConfig.maxDepth, labels });
  const forced = toc === true;
  if (
    items.length === 0 ||
    (!forced && countTocItems(items) < tocConfig.minHeadings)
  ) {
    return null;
  }
  return { items, forced };
}
