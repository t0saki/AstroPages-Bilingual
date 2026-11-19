import { z } from "astro/zod";

/**
 * Structure of a ```` ```chat ```` block, and its normalisation into the shape
 * the renderer (`render.ts`) consumes.
 *
 * The block is hand-written YAML, so the schema is strict everywhere: an
 * unknown field is an error rather than silently ignored, because the usual
 * cause is a typo (`reaction:` for `reactions:`, `avatr:`), and an ignored
 * typo would quietly drop part of the conversation from the post.
 *
 * Two YAML conveniences are folded away here, so the renderer never sees them:
 * - `- Name: words` is shorthand for `{ from: Name, text: words }`;
 * - plain scalars that YAML reads as numbers or booleans (`- Ann: 666`,
 *   `- Ann: yes` is a string already, but `- Ann: true` is not) become text.
 *   Null, maps and lists where text belongs are errors, and so are dates:
 *   YAML turns an unquoted `2026-05-01` into a timestamp, and there is no way
 *   back to what the author typed.
 */

// ---------------------------------------------------------------- output

export interface ChatPerson {
  bot: boolean;
  self: boolean;
  /** Characters shown in the avatar; defaults to the name's first grapheme. */
  avatar?: string;
  /** Avatar colour slot, 1–6; unset ones are dealt out in order of appearance. */
  color?: number;
  /** Show the "Bot" badge; defaults to `bot`. */
  badge?: boolean;
}

/** A piece of the caption: plain text, or a `[text](href)` link. */
export interface ChatCaptionPart {
  text: string;
  href?: string;
}

export interface ChatImage {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export type ChatCardRow =
  | { kind: "title" | "heading" | "text"; text: string }
  | { kind: "lines" | "bullets"; widths: number[] }
  | { kind: "rule" }
  | { kind: "stats"; items: [string, string][] }
  | { kind: "tiles"; count: number }
  | { kind: "plot"; points: [number, number][] };

export interface ChatCard {
  label?: string;
  inline: boolean;
  rows: ChatCardRow[];
}

export interface ChatMessage {
  kind: "message";
  from: string;
  text?: string;
  reply?: { from: string; text: string };
  image?: ChatImage;
  card?: ChatCard;
  voice?: number;
  reactions: string[];
}

export type ChatEntry =
  | { kind: "time" | "note" | "gap"; text: string }
  | ChatMessage;

export interface ChatData {
  title?: string;
  meta?: string;
  caption?: ChatCaptionPart[];
  wide: boolean;
  /** `"none"` (never scroll), a CSS length, or unset (the stylesheet's cap). */
  maxHeight?: string;
  people: Map<string, ChatPerson>;
  messages: ChatEntry[];
}

// ---------------------------------------------------------------- scalars

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

function describeNonText(value: unknown): string {
  if (value === undefined) return "is required";
  if (value === null) return "is empty (write some text, or drop the field)";
  if (value instanceof Date) {
    return "was read by YAML as a date; put it in quotes";
  }
  if (Array.isArray(value)) return "must be text, not a list";
  return "must be text, not a map (quote it if it contains `: `)";
}

/** Author text: a YAML string, or a number / boolean taken as written. */
const text = z.unknown().transform((value, ctx): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  ctx.addIssue({ code: "custom", message: describeNonText(value) });
  return z.NEVER;
});

/** Text that has to say something: names, alt text, labels. */
const nonEmptyText = text.refine(value => value.trim() !== "", {
  message: "must not be empty",
});

const bool = z.boolean({ error: "must be true or false" });

const int = (min: number, max: number) =>
  z
    .number({ error: "must be a number" })
    .int({ error: "must be a whole number" })
    .min(min, { error: `must be at least ${min}` })
    .max(max, { error: `must be at most ${max}` });

const percent = z
  .number({ error: "must be a number (a percentage, 0–100)" })
  .min(0, { error: "must be between 0 and 100" })
  .max(100, { error: "must be between 0 and 100" });

const list = <T extends z.ZodType>(item: T, what: string) =>
  z
    .array(item, {
      error: issue =>
        issue.input === undefined ? "is required" : `must be a list of ${what}`,
    })
    .min(1, {
      error: `must list at least one ${what.replace(/s$/, "")}`,
    });

/**
 * The only link schemes a block may emit: no `javascript:`, and no `//host`
 * or `/\host`, which browsers resolve as `//host` — another site.
 */
const SAFE_HREF = /^(?:https?:\/\/|\/(?![/\\])|#)/i;
const SAFE_SRC = /^(?:https?:\/\/|\/(?![/\\]))/i;

/**
 * Accepted `max-height` values besides `none`: lengths and the math functions
 * that combine them (`32rem`, `min(30rem, 62svh)`). The value lands in an
 * inline `style`, so the alphabet is kept to what such an expression needs —
 * no `;`, quotes or braces that could start another declaration. It must
 * also contain a number with a unit: a bare `30` or a stray word would be an
 * invalid value, which the browser drops silently, leaving the block
 * uncapped while it still announces itself as a scroll region.
 */
const CSS_LENGTH = /^[0-9a-z.,%() +\-*/]+$/;
const CSS_DIMENSION = /\d(?:[a-z]+|%)/;

/**
 * `[text](href)`; the href may hold one level of balanced parentheses, as
 * Wikipedia's `…/Foo_(bar)` do.
 */
const CAPTION_LINK = /\[([^\]\n]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

const caption = text.transform((value, ctx): ChatCaptionPart[] => {
  const parts: ChatCaptionPart[] = [];
  let unreadLink = false;
  const plain = (slice: string) => {
    // What looks like a link but didn't match would otherwise show as typed.
    if (slice.includes("](")) unreadLink = true;
    parts.push({ text: slice });
  };
  let last = 0;
  for (const match of value.matchAll(CAPTION_LINK)) {
    const [whole, label, href] = match;
    if (!SAFE_HREF.test(href)) {
      ctx.addIssue({
        code: "custom",
        message: `link "${href}" must start with http(s)://, / or #`,
      });
      return z.NEVER;
    }
    if (match.index > last) plain(value.slice(last, match.index));
    parts.push({ text: label, href });
    last = match.index + whole.length;
  }
  if (last < value.length) plain(value.slice(last));
  if (unreadLink) {
    ctx.addIssue({
      code: "custom",
      message:
        "has a [text](link) that can't be read: links may not contain spaces or unbalanced parentheses",
    });
    return z.NEVER;
  }
  return parts;
});

const maxHeight = text.refine(
  value =>
    value === "none" || (CSS_LENGTH.test(value) && CSS_DIMENSION.test(value)),
  {
    message:
      'must be none or a CSS length with a unit, such as "32rem" or "min(30rem, 62svh)"',
  }
);

// ---------------------------------------------------------------- people

const person = z.strictObject(
  {
    bot: bool.optional(),
    self: bool.optional(),
    avatar: nonEmptyText.optional(),
    color: int(1, 6).optional(),
    badge: bool.optional(),
  },
  { error: issueFor("a map of settings, e.g. { bot: true }") }
);

// ---------------------------------------------------------------- cards

/** One card row is a single-key map; the key says what to draw. */
const cardRowSchemas = {
  title: nonEmptyText,
  heading: nonEmptyText,
  text: nonEmptyText,
  lines: list(percent, "widths"),
  bullets: list(percent, "widths"),
  rule: z.literal(true, { error: "must be true" }),
  stats: z
    .record(z.string(), nonEmptyText, {
      error: "must be a map of label: value",
    })
    .refine(items => Object.keys(items).length > 0, {
      message: "must have at least one label: value",
    }),
  tiles: int(1, 48),
  plot: list(
    z.tuple([percent, percent], {
      error: "each point must be [x%, y%]",
    }),
    "points"
  ),
} as const;

type CardRowKey = keyof typeof cardRowSchemas;
const CARD_ROW_KEYS = Object.keys(cardRowSchemas) as CardRowKey[];

function toCardRow(key: CardRowKey, value: unknown): ChatCardRow {
  switch (key) {
    case "title":
    case "heading":
    case "text":
      return { kind: key, text: value as string };
    case "lines":
    case "bullets":
      return { kind: key, widths: value as number[] };
    case "rule":
      return { kind: "rule" };
    case "stats":
      return {
        kind: "stats",
        items: Object.entries(value as Record<string, string>),
      };
    case "tiles":
      return { kind: "tiles", count: value as number };
    case "plot":
      return { kind: "plot", points: value as [number, number][] };
  }
}

const cardRow = z.unknown().transform((raw, ctx): ChatCardRow => {
  const keys = isPlainObject(raw) ? Object.keys(raw) : [];
  const key = keys[0] as CardRowKey;
  if (keys.length !== 1 || !CARD_ROW_KEYS.includes(key)) {
    ctx.addIssue({
      code: "custom",
      message:
        keys.length === 1
          ? `unknown row "${keys[0]}" (expected one of: ${CARD_ROW_KEYS.join(", ")})`
          : `each row is a single-key map, one of: ${CARD_ROW_KEYS.join(", ")}`,
    });
    return z.NEVER;
  }
  const result = cardRowSchemas[key].safeParse(
    (raw as Record<string, unknown>)[key]
  );
  if (!result.success) {
    for (const issue of result.error.issues) {
      ctx.addIssue({ ...issue, path: [key, ...issue.path] });
    }
    return z.NEVER;
  }
  return toCardRow(key, result.data);
});

const card = z
  .strictObject(
    {
      label: nonEmptyText.optional(),
      inline: bool.optional(),
      rows: list(cardRow, "rows"),
    },
    { error: issueFor("a map with rows") }
  )
  .transform(
    (value): ChatCard => ({
      label: value.label,
      inline: value.inline ?? false,
      rows: value.rows,
    })
  );

// ---------------------------------------------------------------- messages

const image = z.strictObject(
  {
    src: nonEmptyText.refine(value => SAFE_SRC.test(value), {
      message: "must start with http(s):// or /",
    }),
    alt: nonEmptyText,
    width: int(1, 100_000).optional(),
    height: int(1, 100_000).optional(),
  },
  { error: issueFor("a map with src and alt") }
);

const message = z
  .strictObject(
    {
      from: nonEmptyText,
      text: text.optional(),
      reply: z
        .strictObject(
          { from: nonEmptyText, text: nonEmptyText },
          { error: issueFor("a map with from and text") }
        )
        .optional(),
      image: image.optional(),
      card: card.optional(),
      voice: int(1, 3600).optional(),
      reactions: list(nonEmptyText, "reactions").optional(),
    },
    { error: issueFor("a map") }
  )
  .refine(
    value =>
      (value.text !== undefined && value.text.trim() !== "") ||
      value.image ||
      value.card ||
      value.voice,
    { message: "needs at least one of text, image, card or voice" }
  )
  .transform(
    (value): ChatMessage => ({
      kind: "message",
      from: value.from,
      text: value.text?.trim() ? value.text : undefined,
      reply: value.reply,
      image: value.image,
      card: value.card,
      voice: value.voice,
      reactions: value.reactions ?? [],
    })
  );

const MARKERS = ["time", "note", "gap"] as const;
type Marker = (typeof MARKERS)[number];

const marker = <K extends Marker>(key: K) =>
  z.strictObject({ [key]: nonEmptyText } as Record<K, typeof nonEmptyText>, {
    error: issueFor("a single-key map"),
  });

const markerSchemas: Record<Marker, z.ZodType<Record<string, string>>> = {
  time: marker("time"),
  note: marker("note"),
  gap: marker("gap"),
};

/** The fields of a message besides `from`. */
const MESSAGE_FIELDS = new Set([
  "text",
  "reply",
  "image",
  "card",
  "voice",
  "reactions",
]);

/**
 * Keys that never start the `- Name: words` shorthand: the entry kinds, and
 * the message fields, so `- text: hi` (a message missing its `from`) is
 * reported as such instead of becoming a speaker called "text". A speaker who
 * really is called that can still talk through `from:`.
 */
const NOT_SHORTHAND = new Set([...MARKERS, "from", ...MESSAGE_FIELDS]);

const entry = z.unknown().transform((raw, ctx): ChatEntry => {
  if (!isPlainObject(raw)) {
    ctx.addIssue({
      code: "custom",
      message:
        "each item is a map: `- Name: text`, `- from: …`, or `- time: …`",
    });
    return z.NEVER;
  }
  const keys = Object.keys(raw);

  const forward = (issues: z.core.$ZodIssue[]) => {
    for (const issue of issues) ctx.addIssue({ ...issue });
    return z.NEVER;
  };

  if (!("from" in raw)) {
    const marker = MARKERS.find(key => key in raw);
    if (marker) {
      const result = markerSchemas[marker].safeParse(raw);
      if (!result.success) return forward(result.error.issues);
      return { kind: marker, text: result.data[marker] };
    }
    if (keys.length === 1 && !NOT_SHORTHAND.has(keys[0])) {
      const [name] = keys;
      const result = text.safeParse(raw[name]);
      if (!result.success) {
        return forward(
          result.error.issues.map(issue => ({ ...issue, path: [name] }))
        );
      }
      if (result.data.trim() === "") {
        ctx.addIssue({ code: "custom", message: "is empty", path: [name] });
        return z.NEVER;
      }
      return { kind: "message", from: name, text: result.data, reactions: [] };
    }
    // `- Ann: hi` followed by `reactions:` and the like: the message schema
    // would report both a missing `from` and an unknown field "Ann", which
    // doesn't say what went wrong.
    const names = keys.filter(key => !NOT_SHORTHAND.has(key));
    if (
      names.length === 1 &&
      keys.every(key => key === names[0] || MESSAGE_FIELDS.has(key))
    ) {
      ctx.addIssue({
        code: "custom",
        message: `shorthand "- Name: text" takes no other fields; write from: ${names[0]}, text: … instead`,
      });
      return z.NEVER;
    }
  }

  const result = message.safeParse(raw);
  if (!result.success) return forward(result.error.issues);
  return result.data;
});

// ---------------------------------------------------------------- block

export const chatSchema = z
  .strictObject(
    {
      title: nonEmptyText.optional(),
      meta: nonEmptyText.optional(),
      caption: caption.optional(),
      wide: bool.optional(),
      "max-height": maxHeight.optional(),
      people: z
        .record(z.string(), person, {
          error: "must be a map of name: { settings }",
        })
        .optional(),
      messages: list(entry, "messages"),
    },
    { error: issueFor("a map with a messages list") }
  )
  .transform(
    (value): ChatData => ({
      title: value.title,
      meta: value.meta,
      caption: value.caption,
      wide: value.wide ?? false,
      maxHeight: value["max-height"],
      people: new Map(
        Object.entries(value.people ?? {}).map(([name, settings]) => [
          name,
          {
            bot: settings.bot ?? false,
            self: settings.self ?? false,
            avatar: settings.avatar,
            color: settings.color,
            badge: settings.badge,
          },
        ])
      ),
      messages: value.messages,
    })
  );

/**
 * Error wording for a strict object: name the unknown fields (almost always a
 * typo), and say what was expected when the value isn't a map at all.
 */
function issueFor(expected: string) {
  return (issue: z.core.$ZodRawIssue): string | undefined => {
    if (issue.code === "unrecognized_keys") {
      const keys = (issue as { keys?: string[] }).keys ?? [];
      const plural = keys.length > 1 ? "s" : "";
      return `unknown field${plural} ${keys.map(key => `"${key}"`).join(", ")}`;
    }
    if (issue.code === "invalid_type") {
      return issue.input === undefined ? "is required" : `must be ${expected}`;
    }
    return undefined;
  };
}
