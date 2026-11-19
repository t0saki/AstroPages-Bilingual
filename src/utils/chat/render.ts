import type {
  ChatCard,
  ChatCardRow,
  ChatCaptionPart,
  ChatData,
  ChatMessage,
  ChatPerson,
} from "./schema";

/**
 * Render a validated chat block (see `schema.ts`) as a hast tree: a
 * `<figure class="chat">` that redraws the conversation, styled by
 * `src/styles/chat.css`.
 *
 * Pure: data in, hast out. The tree goes straight into the document, so the
 * same output works in `.md` and `.mdx`, text is escaped by whichever
 * serialiser runs last, and later rehype plugins see real elements (the
 * `<img>` of an image message gets `rehypeImageAttrs`' treatment).
 *
 * Without CSS — reader modes, RSS readers, a stylesheet that failed to load —
 * the markup still reads as a transcript: every message is "Name: text" (the
 * separator is hidden once styled), redaction bars are literal █ runs, and
 * decorative pieces (avatars, skeleton bars, waveforms) are `aria-hidden`.
 * Hidden text is kept language-neutral (a colon, a middle dot) because the
 * same renderer serves posts in every locale.
 *
 * The hast types are hand-rolled for the same reason as in the rehype
 * plugins: this module is pulled in by `astro.config.ts`, and `@types/hast`
 * is only present as a transitive dependency.
 */

export interface HastText {
  type: "text";
  value: string;
}

export interface HastElement {
  type: "element";
  tagName: string;
  properties: Record<string, string | number | boolean | string[]>;
  children: HastChild[];
}

export type HastChild = HastElement | HastText;

type Properties = HastElement["properties"];

function h(
  tagName: string,
  properties: Properties | string,
  children: (HastChild | string)[] = []
): HastElement {
  const props =
    typeof properties === "string"
      ? { className: properties.split(" ") }
      : properties;
  return {
    type: "element",
    tagName,
    properties: props,
    children: children.map(child =>
      typeof child === "string" ? { type: "text", value: child } : child
    ),
  };
}

/** Aria-hidden decoration: avatars, skeleton bars, waveforms. */
const decorative = (className: string, children: HastChild[] = []) =>
  h("div", { className: className.split(" "), ariaHidden: "true" }, children);

const SEPARATOR = ": ";

// ---------------------------------------------------------------- text

const REDACTED = /█+/g;

/** Plain author text, with runs of █ drawn as a soft redaction bar. */
function redacted(text: string): HastChild[] {
  const out: HastChild[] = [];
  let last = 0;
  for (const match of text.matchAll(REDACTED)) {
    if (match.index > last) out.push(textNode(text.slice(last, match.index)));
    out.push(h("span", "chat__redacted", [match[0]]));
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(textNode(text.slice(last)));
  return out;
}

const textNode = (value: string): HastText => ({ type: "text", value });

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `@Name` for every name the block knows, longest first so `@Anna` wins over
 * `@Ann`. A name ending in an ASCII word character must also end the word
 * (`@Ann` doesn't light up the start of `@Annie`); CJK names have no word
 * boundaries to respect.
 */
function mentionPattern(names: Iterable<string>): RegExp | undefined {
  const sorted = [...new Set(names)]
    .filter(name => name !== "")
    .sort((a, b) => b.length - a.length);
  if (sorted.length === 0) return undefined;
  const alternatives = sorted.map(
    name =>
      escapeRegExp(name) +
      (/[A-Za-z0-9_]$/.test(name) ? "(?![A-Za-z0-9_])" : "")
  );
  return new RegExp(`@(?:${alternatives.join("|")})`, "g");
}

/** One line of message text: mentions and redactions. */
function decorateLine(line: string, mentions?: RegExp): HastChild[] {
  if (!mentions) return redacted(line);
  const out: HastChild[] = [];
  let last = 0;
  for (const match of line.matchAll(mentions)) {
    if (match.index > last)
      out.push(...redacted(line.slice(last, match.index)));
    out.push(h("span", "chat__at", [match[0]]));
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(...redacted(line.slice(last)));
  return out;
}

const CODE_SPAN = /`([^`\n]+)`/g;

/** A line of message text: `code` spans first, then mentions and bars. */
function messageLine(line: string, mentions?: RegExp): HastChild[] {
  const out: HastChild[] = [];
  let last = 0;
  for (const match of line.matchAll(CODE_SPAN)) {
    if (match.index > last) {
      out.push(...decorateLine(line.slice(last, match.index), mentions));
    }
    out.push(h("code", "chat__code", redacted(match[1])));
    last = match.index + match[0].length;
  }
  if (last < line.length) out.push(...decorateLine(line.slice(last), mentions));
  return out;
}

/**
 * Message text: a blank line starts a paragraph, a single newline is a
 * `<br>`. Nothing else is interpreted — `*stars*` and `# hashes` show as
 * typed, as they did in the chat app.
 */
function messageText(text: string, mentions?: RegExp): HastElement[] {
  const body = text.replace(/^(?:[ \t]*\n)+/, "").trimEnd();
  return body.split(/\n[ \t]*\n\s*/).map(paragraph => {
    const children: HastChild[] = [];
    paragraph.split("\n").forEach((line, index) => {
      if (index > 0) children.push(h("br", {}));
      children.push(...messageLine(line, mentions));
    });
    return h("div", "chat__p", children);
  });
}

// ---------------------------------------------------------------- people

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function firstGrapheme(name: string): string {
  for (const { segment } of graphemes.segment(name.trim())) return segment;
  return name;
}

const COLORS = [1, 2, 3, 4, 5, 6];

/**
 * Avatar colour per speaker: the one set in `people`, or the next free slot in
 * order of first appearance. Slots someone was given explicitly are skipped
 * while any remain, so a dealt colour doesn't double an explicit one. Self
 * (no avatar) and bots (the accent hue) take no slot unless given one.
 */
function dealColors(data: ChatData): Map<string, number> {
  const taken = new Set<number>();
  for (const person of data.people.values()) {
    if (person.color) taken.add(person.color);
  }
  const free = COLORS.filter(color => !taken.has(color));
  const pool = free.length > 0 ? free : COLORS;

  const colors = new Map<string, number>();
  let dealt = 0;
  for (const entry of data.messages) {
    if (entry.kind !== "message" || colors.has(entry.from)) continue;
    const person = data.people.get(entry.from) ?? NO_SETTINGS;
    if (person.color !== undefined) colors.set(entry.from, person.color);
    else if (!person.self && !person.bot) {
      colors.set(entry.from, pool[dealt++ % pool.length]);
    }
  }
  return colors;
}

const NO_SETTINGS: ChatPerson = { bot: false, self: false };

// ---------------------------------------------------------------- pieces

function cardRow(row: ChatCardRow): HastElement {
  switch (row.kind) {
    case "title":
      return h("div", "chat__card-title", redacted(row.text));
    case "heading":
      return h("div", "chat__card-h", redacted(row.text));
    case "text":
      return h("div", "chat__card-t", redacted(row.text));
    case "lines":
    case "bullets":
      return decorative(
        row.kind === "bullets" ? "chat__bars is-bullets" : "chat__bars",
        row.widths.map(width => h("span", { style: `width:${width}%` }))
      );
    case "rule":
      return decorative("chat__card-hr");
    case "stats":
      return h(
        "div",
        "chat__card-stats",
        row.items.map(([label, value]) =>
          h("div", {}, [
            h("span", "chat__card-k", redacted(label)),
            " ",
            h("span", "chat__card-v", redacted(value)),
          ])
        )
      );
    case "tiles":
      return decorative(
        "chat__card-grid",
        Array.from({ length: row.count }, () => h("span", {}))
      );
    case "plot":
      return decorative(
        "chat__card-plot",
        row.points.map(([x, y]) => h("span", { style: `left:${x}%;top:${y}%` }))
      );
  }
}

function card(data: ChatCard): HastElement {
  const rows = data.rows.map(cardRow);
  if (data.label) {
    rows.unshift(h("div", "chat__card-label", redacted(data.label)));
  }
  return h("div", data.inline ? "chat__card is-inline" : "chat__card", rows);
}

function caption(parts: ChatCaptionPart[], id: string): HastElement {
  return h(
    "figcaption",
    { className: ["chat__cap"], id },
    parts.flatMap(part =>
      part.href
        ? [h("a", { href: part.href, rel: "noopener" }, redacted(part.text))]
        : redacted(part.text)
    )
  );
}

function message(
  entry: ChatMessage,
  person: ChatPerson,
  color: number | undefined,
  continued: boolean,
  mentions: RegExp | undefined
): HastElement {
  const className = ["chat__msg"];
  if (person.self) className.push("is-self");
  if (person.bot) className.push("is-bot");
  if (continued) className.push("is-cont");

  const children: HastChild[] = [];
  if (!person.self) {
    const hue = person.bot && person.color === undefined ? "bot" : color;
    children.push(
      h(
        "span",
        { className: ["chat__av", `chat__av--${hue}`], ariaHidden: "true" },
        [person.avatar ?? firstGrapheme(entry.from)]
      )
    );
  }

  const body: HastChild[] = [];
  const showBadge = person.badge ?? person.bot;
  body.push(
    h("div", person.self || continued ? "chat__who chat__vh" : "chat__who", [
      entry.from,
      ...(showBadge ? [" ", h("span", "chat__badge", ["Bot"])] : []),
    ]),
    h("span", "chat__sep", [SEPARATOR])
  );

  const inlineCard = entry.card?.inline ? entry.card : undefined;
  if (entry.text !== undefined || entry.reply || inlineCard) {
    const bubble: HastChild[] = [];
    if (entry.reply) {
      bubble.push(
        h("div", "chat__quote", [
          h("span", "chat__quote-who", [entry.reply.from]),
          h("span", "chat__sep", [SEPARATOR]),
          h("span", "chat__quote-text", redacted(entry.reply.text)),
        ])
      );
    }
    if (entry.text !== undefined) {
      bubble.push(...messageText(entry.text, mentions));
    }
    if (inlineCard) bubble.push(card(inlineCard));
    body.push(h("div", "chat__bubble", bubble));
  }
  if (entry.voice !== undefined) {
    body.push(
      h("div", "chat__bubble chat__voice", [
        h(
          "span",
          { className: ["chat__wave"], ariaHidden: "true" },
          Array.from({ length: 5 }, () => h("span", {}))
        ),
        `${entry.voice}″`,
      ])
    );
  }
  if (entry.image) {
    const { src, alt, width, height } = entry.image;
    const properties: Properties = { src, alt };
    if (width !== undefined) properties.width = width;
    if (height !== undefined) properties.height = height;
    body.push(h("div", "chat__media", [h("img", properties)]));
  }
  if (entry.card && !inlineCard) body.push(card(entry.card));
  if (entry.reactions.length > 0) {
    body.push(
      h(
        "div",
        "chat__reacts",
        entry.reactions.map(reaction => h("span", "chat__react", [reaction]))
      )
    );
  }

  children.push(h("div", "chat__body", body));
  return h("div", { className }, children);
}

// ---------------------------------------------------------------- block

/**
 * @param data  a block that passed `chatSchema`
 * @param id    prefix for the ids the scroll region is labelled by; unique
 *              within the page (the plugin numbers blocks per post)
 */
export function renderChat(data: ChatData, id: string): HastElement {
  const speakers = new Set<string>();
  const names = new Set<string>(data.people.keys());
  for (const entry of data.messages) {
    if (entry.kind !== "message") continue;
    speakers.add(entry.from);
    names.add(entry.from);
    if (entry.reply) names.add(entry.reply.from);
  }
  const mentions = mentionPattern(names);
  const colors = dealColors(data);

  const log: HastChild[] = [];
  const headId = `${id}-title`;
  const captionId = `${id}-caption`;
  if (data.title || data.meta) {
    const head: HastChild[] = [];
    if (data.title) {
      head.push(h("span", "chat__title", redacted(data.title)));
    }
    if (data.title && data.meta) {
      head.push(h("span", "chat__sep", [" · "]));
    }
    if (data.meta) head.push(h("span", "chat__meta", redacted(data.meta)));
    log.push(h("div", { className: ["chat__head"], id: headId }, head));
  }

  const feed: HastChild[] = [];
  let previous: string | undefined;
  for (const entry of data.messages) {
    if (entry.kind !== "message") {
      feed.push(h("div", `chat__${entry.kind}`, redacted(entry.text)));
      previous = undefined;
      continue;
    }
    feed.push(
      message(
        entry,
        data.people.get(entry.from) ?? NO_SETTINGS,
        colors.get(entry.from),
        previous === entry.from,
        mentions
      )
    );
    previous = entry.from;
  }

  const feedProperties: Properties = { className: ["chat__feed"] };
  if (data.maxHeight !== "none") {
    // Scrolls on its own: keyboard users need a tab stop to scroll it, and a
    // name so the stop announces what it is. The caption describes the chat
    // best; the title row next; failing both, the speakers' names, which
    // need no translating.
    Object.assign(feedProperties, {
      className: ["chat__feed", "is-scroll"],
      tabIndex: 0,
      role: "region",
    });
    if (data.caption) feedProperties.ariaLabelledBy = captionId;
    else if (data.title || data.meta) feedProperties.ariaLabelledBy = headId;
    else feedProperties.ariaLabel = [...speakers].join(", ");
  }
  log.push(h("div", feedProperties, feed));

  const figureProperties: Properties = {
    className: data.wide
      ? ["chat", "not-prose", "chat--wide"]
      : ["chat", "not-prose"],
  };
  if (data.maxHeight && data.maxHeight !== "none") {
    figureProperties.style = `--chat-max-h:${data.maxHeight}`;
  }

  const figure = [h("div", "chat__log", log)];
  if (data.caption) figure.push(caption(data.caption, captionId));
  return h("figure", figureProperties, figure);
}
