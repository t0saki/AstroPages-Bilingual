import { parseFrontmatter } from "@astrojs/markdown-remark";

/**
 * Parse the YAML inside a ```` ```chat ```` block.
 *
 * No YAML package is imported directly: the only ones installed are
 * transitive dependencies, which this module (pulled in by `astro.config.ts`)
 * must not rely on. `@astrojs/markdown-remark` is a direct dependency, and its
 * `parseFrontmatter` is the very parser Astro reads post frontmatter with —
 * so wrapping the block in `---` fences and handing it over gives chat blocks
 * the same YAML dialect as the frontmatter right above them, and keeps them
 * on it as Astro upgrades.
 *
 * The cost of borrowing a frontmatter parser: it ends the frontmatter at the
 * first line that starts with `---` (or `+++`, TOML's fence), and would
 * silently drop the rest of the block. Such a line is rejected up front.
 */

export class ChatYamlError extends Error {
  /** 0-based line within the block's content, when known. */
  readonly line?: number;
  readonly column?: number;

  constructor(message: string, line?: number, column?: number) {
    super(message);
    this.name = "ChatYamlError";
    this.line = line;
    this.column = column;
  }
}

/** What js-yaml attaches to a syntax error. */
interface YamlMark {
  buffer?: string;
  line?: number;
  column?: number;
}

const FENCE_LINE = /^(?:---|\+\+\+)/m;

export function parseChatYaml(body: string): unknown {
  const fence = FENCE_LINE.exec(body);
  if (fence) {
    const line = body.slice(0, fence.index).split("\n").length - 1;
    throw new ChatYamlError(
      "a line may not start with --- or +++ (it would end the block early); indent it or put it in quotes",
      line,
      0
    );
  }

  try {
    return parseFrontmatter(`---\n${body}\n---\n`).frontmatter;
  } catch (error) {
    const { reason, mark } = error as { reason?: string; mark?: YamlMark };
    if (!mark || typeof mark.line !== "number") {
      throw new ChatYamlError(`invalid YAML: ${String(error)}`);
    }
    // The mark counts lines from the start of what the parser saw: the text
    // between the fences, which starts with the newline after the opening
    // `---`. Work out that offset from the buffer rather than assuming it.
    const start = mark.buffer?.indexOf(body) ?? -1;
    const offset =
      start >= 0 ? mark.buffer!.slice(0, start).split("\n").length - 1 : 1;
    const lastLine = body.split("\n").length - 1;
    const line = Math.min(Math.max(mark.line - offset, 0), lastLine);
    throw new ChatYamlError(
      `invalid YAML: ${reason ?? (error as Error).message}`,
      line,
      mark.column
    );
  }
}
