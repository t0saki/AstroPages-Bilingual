import type { MarkdownHeading } from "astro";

/** One entry of a post's table of contents, with its nested sub-sections. */
export type TocItem = {
  slug: string;
  text: string;
  /** Nesting level, 0 for the outermost entries. */
  level: number;
  children: TocItem[];
};

type TocOptions = {
  /** Deepest heading level listed (h2 is always the shallowest). */
  maxDepth: number;
  /**
   * Clean labels by heading id, from `rehypeTocLabels`. Headings without one
   * fall back to Astro's collected text.
   */
  labels?: Record<string, string>;
};

/**
 * Headings that title an inline TOC. rehypeInlineToc already takes the first
 * English one out of `headings`; a repeat of it, or the Chinese "目录" it
 * doesn't match, would otherwise list a TOC inside the TOC.
 */
const INLINE_TOC_HEADING = /^(table[ -]of[ -])?contents?$|^toc$|^目录$/i;

/** The visually hidden "Footnotes" heading remark-rehype adds. */
const FOOTNOTE_LABEL_ID = "footnote-label";

/**
 * Build a post's nested table of contents from the headings Astro collected.
 *
 * Only h2…h{maxDepth} are listed (h1 is the post title). Nesting follows the
 * document outline, so a jump such as h2 → h4 nests the h4 one level under
 * the h2 rather than two, and a post that opens with h3 still starts at the
 * outermost level. With the default `maxDepth` of 3 the list is therefore at
 * most two levels deep.
 */
export function getTocItems(
  headings: MarkdownHeading[],
  { maxDepth, labels = {} }: TocOptions
): TocItem[] {
  const roots: TocItem[] = [];
  // Open ancestors of the next heading, shallowest first.
  const stack: { depth: number; item: TocItem }[] = [];

  for (const heading of headings) {
    if (heading.depth < 2 || heading.depth > maxDepth) continue;

    // Astro escapes `{` as `${` in the collected text of .md headings (it
    // feeds MDX-style templating); undo that for display.
    const text = (
      labels[heading.slug] ?? heading.text.replace(/\$\{/g, "{")
    ).trim();

    // Close the sections this heading ends even when it isn't listed itself,
    // so what follows an unlisted heading doesn't nest under the section
    // before it.
    while (stack.length && stack[stack.length - 1].depth >= heading.depth) {
      stack.pop();
    }
    if (
      !text ||
      heading.slug === FOOTNOTE_LABEL_ID ||
      INLINE_TOC_HEADING.test(text)
    ) {
      continue;
    }

    const parent = stack[stack.length - 1]?.item;
    const item: TocItem = {
      slug: heading.slug,
      text,
      level: parent ? parent.level + 1 : 0,
      children: [],
    };
    (parent ? parent.children : roots).push(item);
    stack.push({ depth: heading.depth, item });
  }

  return roots;
}

/** Total number of entries, nested ones included. */
export function countTocItems(items: TocItem[]): number {
  return items.reduce((sum, item) => sum + 1 + countTocItems(item.children), 0);
}
