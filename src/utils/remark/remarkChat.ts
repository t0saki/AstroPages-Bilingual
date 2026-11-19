import { readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AstroIntegration } from "astro";
import { renderChat, type HastElement } from "../chat/render";
import { chatSchema } from "../chat/schema";
import { ChatYamlError, parseChatYaml } from "../chat/yaml";

/**
 * Turn ```` ```chat ```` fenced blocks into redrawn chat transcripts.
 *
 * A post quotes a group chat or a bot conversation as a YAML block instead of
 * a screenshot: the text stays selectable, searchable and translatable, it
 * follows the site's light/dark theme, and names can be swapped and details
 * blacked out without an image editor. The block's YAML is parsed (`yaml.ts`),
 * validated and normalised (`schema.ts`) and rendered (`render.ts`); the
 * format itself is documented in the README ("聊天记录" / "Chat transcripts").
 *
 * This runs in remark, before Shiki, so the block never reaches the code
 * highlighter. The `code` node is replaced by a node of its own type carrying
 * `data.hName` / `hProperties` / `hChildren`, which mdast-util-to-hast turns
 * into exactly that element tree. (Those fields on the `code` node itself
 * would only replace the inner `<code>`, still wrapped in a `<pre>`.) Emitting
 * hast rather than an HTML string means the block works the same in `.md` and
 * `.mdx`, every piece of author text is escaped by the serialiser, and later
 * rehype plugins see the elements inside.
 *
 * Any problem fails the build with a message starting "chat block:" that
 * names the file, the line (of the offending entry where it can be found,
 * else of the block's opening fence) and the field, so a typo can't quietly
 * drop part of a conversation from a post. That takes two steps, because
 * throwing from a remark plugin (`file.fail`) is not enough here: Astro's
 * content-collection loader catches render errors, logs one line, and stores
 * the post with an empty body — the build then succeeds, and as the store is
 * cached by content digest, later builds (and the `astro build` that follows
 * `astro check`) don't even log it again. So a broken block is rendered as a
 * visible error box instead, which the cache keeps like any other output and
 * which shows in place on the dev server; the message is also recorded on the
 * file (`file.message`) for tools that read vfile messages; and the
 * `chatBlockErrors` integration below fails `astro build` when any built page
 * carries such a box.
 *
 * The tree walk and the mdast/vfile types are hand-rolled on purpose: this
 * module is pulled in by `astro.config.ts`, so it must not import packages
 * that are only present as transitive dependencies (`unist-util-visit`,
 * `@types/mdast`, `vfile`).
 */

interface Point {
  line: number;
  column: number;
}

/** The sliver of mdast this plugin touches. */
interface MdastNode {
  type: string;
  lang?: string | null;
  value?: string;
  position?: { start: Point; end: Point };
  data?: unknown;
  children?: MdastNode[];
}

/** The sliver of vfile this plugin uses. */
interface VFileLike {
  path?: string;
  cwd?: string;
  value?: unknown;
  message(reason: string, place?: unknown): unknown;
}

/** Zod's issue, as far as the messages below read it. */
interface Issue {
  path: PropertyKey[];
  message: string;
  code?: string;
  keys?: string[];
}

const CHAT_NODE = "chatBlock";

/** Marks the error box in the HTML: `data-chat-error`. */
const ERROR_PROPERTY = "dataChatError";
const ERROR_BOX = /<pre[^>]*\sdata-chat-error[^>]*>([\s\S]*?)<\/pre>/g;

// ---------------------------------------------------------------- errors

/** A short handle for a messages entry: its speaker, or its first key. */
function entryLabel(entry: unknown): string {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return "";
  }
  const record = entry as Record<string, unknown>;
  const label =
    typeof record.from === "string" ? record.from : Object.keys(record)[0];
  if (!label) return "";
  return ` (${label.length > 20 ? `${label.slice(0, 20)}…` : label})`;
}

/** `messages #4 (Ann) › card › rows #2`: list items counted from 1. */
function formatPath(path: PropertyKey[], data: unknown): string {
  const parts: string[] = [];
  path.forEach((segment, index) => {
    if (typeof segment === "number") {
      const label =
        index === 1 && path[0] === "messages"
          ? entryLabel((data as { messages?: unknown[] }).messages?.[segment])
          : "";
      parts[parts.length - 1] += ` #${segment + 1}${label}`;
    } else {
      parts.push(String(segment));
    }
  });
  return parts.join(" › ");
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Best-effort line (0-based, within the block) of the entry an issue is
 * about: a top-level key, or an item of the `messages` list written in block
 * style. Anything fancier (flow style, anchors) returns undefined and the
 * error points at the block's fence instead.
 */
function locate(body: string, path: PropertyKey[]): number | undefined {
  const lines = body.split("\n");
  const [key, index] = path;
  if (typeof key !== "string") return undefined;
  const keyLine = lines.findIndex(line =>
    new RegExp(`^["']?${escapeRegExp(key)}["']?\\s*:`).test(line)
  );
  if (keyLine < 0) return undefined;
  if (key === "people" && typeof index === "string") {
    const person = lines.findIndex(
      (line, i) =>
        i > keyLine &&
        new RegExp(`^\\s+["']?${escapeRegExp(index)}["']?\\s*:`).test(line)
    );
    return person >= 0 ? person : keyLine;
  }
  if (key !== "messages" || typeof index !== "number") return keyLine;

  const items: number[] = [];
  let indent: string | undefined;
  for (let i = keyLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[^\s#-]/.test(line)) break; // the next top-level key
    const item = /^(\s*)-(?:\s|$)/.exec(line);
    if (!item) continue;
    indent ??= item[1];
    if (item[1] === indent) items.push(i);
  }
  return items[index] ?? keyLine;
}

/**
 * Lines of the source file above the text remark was given. The content
 * loader hands remark a post's body with the frontmatter cut off, so its line
 * numbers are short by the frontmatter's length; MDX passes the whole file.
 * Only computed when reporting an error.
 */
function lineOffset(file: VFileLike): number {
  if (!file.path || typeof file.value !== "string") return 0;
  try {
    const source = readFileSync(file.path, "utf8");
    const start = source.indexOf(file.value);
    return start > 0 ? source.slice(0, start).split("\n").length - 1 : 0;
  } catch {
    return 0;
  }
}

function relativePath(file: VFileLike): string {
  const path = file.path ?? "<unknown file>";
  const cwd = file.cwd?.replace(/\/?$/, "/");
  return cwd && path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

// ---------------------------------------------------------------- plugin

function convert(node: MdastNode, index: number, file: VFileLike): MdastNode {
  const body = node.value ?? "";
  // The block's content starts on the line after its opening fence.
  const fenceLine = node.position?.start.line ?? 1;
  const where = (line?: number, column?: number): Point => ({
    line: line === undefined ? fenceLine : fenceLine + 1 + line,
    column: column === undefined ? 1 : column + 1,
  });
  const fail = (reason: string, place: Point): MdastNode => {
    const line = place.line + lineOffset(file);
    const message = `chat block: ${reason}\n  at ${relativePath(file)}:${line}`;
    file.message(message, place);
    return {
      type: CHAT_NODE,
      position: node.position,
      data: {
        hName: "pre",
        hProperties: { className: ["chat-error"], [ERROR_PROPERTY]: "" },
        hChildren: [{ type: "text", value: message }],
      },
    };
  };

  let raw: unknown;
  try {
    raw = parseChatYaml(body);
  } catch (error) {
    if (!(error instanceof ChatYamlError)) throw error;
    return fail(error.message, where(error.line, error.column));
  }

  const result = chatSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues as Issue[];
    const describe = (issue: Issue) => {
      const path = formatPath(issue.path, raw);
      return path ? `${path}: ${issue.message}` : issue.message;
    };
    const first = issues[0];
    const firstPath =
      first.code === "unrecognized_keys" && first.keys?.length
        ? [...first.path, first.keys[0]]
        : first.path;
    const reason =
      issues.length === 1
        ? describe(first)
        : `${issues.length} problems:\n${issues.map(issue => `  - ${describe(issue)}`).join("\n")}`;
    return fail(reason, where(locate(body, firstPath)));
  }

  const figure: HastElement = renderChat(result.data, `chat-${index}`);
  return {
    type: CHAT_NODE,
    position: node.position,
    data: {
      hName: figure.tagName,
      hProperties: figure.properties,
      hChildren: figure.children,
    },
  };
}

export default function remarkChat() {
  return (tree: MdastNode, file: VFileLike) => {
    let count = 0;
    const walk = (node: MdastNode): void => {
      node.children?.forEach((child, index, siblings) => {
        if (child.type === "code" && child.lang === "chat") {
          siblings[index] = convert(child, ++count, file);
        } else {
          walk(child);
        }
      });
    };
    walk(tree);
  };
}

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#x27;": "'",
  "&#39;": "'",
  "&amp;": "&",
};

/**
 * Fail `astro build` when a page carries a chat block error box (see the
 * module comment for why the remark plugin can't fail it by itself), listing
 * every message. Reads the built HTML once, after the build; `astro dev`
 * shows the boxes in place instead.
 */
export function chatBlockErrors(): AstroIntegration {
  return {
    name: "chat-block-errors",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir);
        const errors = new Set<string>();
        for (const name of await readdir(root, { recursive: true })) {
          if (!name.endsWith(".html")) continue;
          const html = await readFile(join(root, name), "utf8");
          if (!html.includes("data-chat-error")) continue;
          for (const [, text] of html.matchAll(ERROR_BOX)) {
            errors.add(
              text.replace(/&(?:lt|gt|quot|amp|#x27|#39);/g, e => ENTITIES[e])
            );
          }
        }
        if (errors.size > 0) {
          throw new Error(
            `${errors.size} broken chat block${errors.size > 1 ? "s" : ""}:\n\n${[...errors].join("\n\n")}`
          );
        }
      },
    },
  };
}
