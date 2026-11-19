---
title: Welcome to AstroPaper
pubDatetime: 2026-01-11T00:00:00Z
description: This is a sample English blog post to demonstrate the bilingual blog system.
featured: true
draft: false
tags:
  - welcome
  - introduction
---

# Welcome to AstroPaper Bilingual Blog

This is a bilingual blog system built on the AstroPaper theme.

## Key Features

- 🌍 **Bilingual Support**: Full Chinese and English content support
- 🚀 **High Performance**: Built on Astro 5 static site generation
- ✍️ **Keystatic CMS**: Intuitive content management experience
- ☁️ **Cloudflare Pages**: Edge deployment, global acceleration

## Tech Stack

This blog uses the following technologies:

- Astro v5 with Native i18n
- Keystatic Headless CMS
- TailwindCSS v4
- TypeScript

## Math Formulas

Posts support LaTeX math embedded in Markdown, rendered at build time by KaTeX. For example, the inline mass–energy equation $E = mc^2$, and a display equation:

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## Chat Transcripts

A fenced block tagged `chat` is redrawn as a chat transcript at build time: the text stays selectable and searchable, follows the light/dark theme, and a long conversation scrolls inside its frame.

```chat
title: Blog builders
meta: Group chat · January 2026
caption: A made-up conversation; people and addresses are fictional.
people:
  DeployBot: { bot: true }
  Me: { self: true }
messages:
  - time: "21:05"
  - Lin: Is your blog live yet?
  - Me: Just pushed it, Cloudflare is still building
  - Me: "@DeployBot how did the latest build go?"
  - from: DeployBot
    reply: { from: Me, text: "@DeployBot how did the latest build go?" }
    text: |
      Build succeeded in 48 seconds.

      36 pages generated, search index updated.
    card:
      label: Build report
      rows:
        - title: main · a1b2c3d
        - stats: { Pages: 36, Time: 48s, Warnings: 0 }
        - lines: [92, 74, 48]
    reactions: ["🎉 2", "👍 1"]
  - Lin: That was quick
  - Lin: Mine is still stuck on `pnpm install`
  - Jay: Did you forget to commit the lockfile?
  - Lin: Maybe, let me check
  - note: Jay renamed the group to "Blog builders"
  - gap: 8 messages skipped
  - time: "22:30"
  - Lin: Fixed it, my Node version was too old
  - Lin: Also, what do you use for comments?
  - Jay: I run ████ myself, hosted on ██████
  - Me: "@Lin forget comments for now, write your first post"
  - from: Lin
    text: Fair point
    reactions: ["😂 3"]
  - from: DeployBot
    text: |
      Lin's site built fine too:
      `https://example.pages.dev`
```

Enjoy!
