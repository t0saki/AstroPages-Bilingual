# Bilingual Blog Starter 🌍

[中文](README.md)

[Demo](https://astropages-bilingual.pages.dev)

[My Blog](https://t0saki.com) also uses this template.

A modern, high-performance bilingual blog template built with [Astro v6](https://astro.build) (tracking upstream [astro-paper](https://github.com/satnaing/astro-paper) **v6.1**) and [Cloudflare Pages](https://pages.cloudflare.com).

Visitors get **Static Site Generation (SSG)** for extreme performance. An optional, Git-based [Keystatic CMS](https://keystatic.com) (no database) is preserved on the `keystatic-workers` branch — see [Branches](#-branches) below.

Based on the [astro-paper](https://github.com/satnaing/astro-paper) theme, refactored for native i18n, Astro 6, and robust engineering.

## ✨ Features

- **Astro v6 Native i18n**: Full routing structure with Chinese at root `/` and English at `/en/`, with a language switcher and first-visit language redirect.
- **Pure Static Output (SSG)**: The default branch is fully static and deploys to Cloudflare Pages — no server runtime needed.
- **Optional Keystatic CMS**: Git-based Headless CMS (`keystatic-workers` branch).
- **Type-Safe Content**: rigorous `astro:content` schema validation for all blog posts.
- **Dynamic OG Images**: per-post OpenGraph images generated at build time (satori + sharp); CJK (and other non-Latin) titles pull in a fallback font instead of rendering as tofu boxes.
- **Chinese Font**: bundled Source Han Serif (`@chinese-fonts/sypxzs`).
- **Static Full-Text Search**: [Pagefind](https://pagefind.app/), indexed per language, with optional semantic results from Cloudflare AI Search (see [Semantic search](#-semantic-search-optional)).
- **Math Formulas**: LaTeX math embedded in Markdown, rendered at build time by [KaTeX](https://katex.org/) (remark-math + rehype-katex) — no client-side JS.
- **Photo Gallery**: a `/gallery` page collecting image-host photos from posts marked `gallery: true`, grouped by post, with EXIF (camera / lens / settings) on hover and a [PhotoSwipe](https://photoswipe.com/) lightbox. Filterable by camera, lens and focal length. Thumbnails and EXIF are pre-generated into the repo (see [Photo Gallery](#-photo-gallery)).
- **Table of Contents**: posts with enough headings get a TOC — a sticky rail beside the article on wide screens (≥1280px) that highlights the section you're reading, and a floating button that opens it as a sheet on smaller ones (see [Table of contents](#table-of-contents)).
- **SEO Optimized**: multi-language meta tags, sitemap, and OpenGraph pre-configured.

## 🛠️ Quick Start

### 1. Requirements

- Node.js **v22.12+** (required by Astro 6)
- GitHub Account (only for the Keystatic CMS)
- Cloudflare Account (optional, for deployment)

### 2. Installation

Clone this repository and install dependencies (`pnpm` recommended):

```bash
git clone https://github.com/t0saki/AstroPages-Bilingual.git
cd AstroPages-Bilingual
pnpm install
```

### 3. Local Development

Start the development server:

```bash
pnpm dev
```

- **Blog**: Visit `http://localhost:4321/` (Chinese homepage) or `http://localhost:4321/en/` (English homepage).
- **CMS**: The default branch is static and has no `/keystatic`. For visual content management, switch to the `keystatic-workers` branch and visit `/keystatic` (see [Branches](#-branches)).

## ☁️ Deployment

### Deploy to Cloudflare Pages

1.  Fork this repository.
2.  Log in to Cloudflare Dashboard > Workers & Pages > Create application > Pages (Get Started) > Connect to Git.
3.  Select your repository.
4.  **Build Settings**:
    -   **Framework Preset**: Astro
    -   **Build Command**: `pnpm build`
    -   **Output Directory**: `dist` (default)
5.  Click **Save and Deploy**.
6.  **Note**: After deployment, it is recommended to **disable Rocket Loader** in Cloudflare Dashboard under **Speed > Optimization**. Rocket Loader interferes with Astro's Client Router (View Transitions), causing issues with page navigation and script execution.

> Legacy links: the root `_redirects` file is copied into `dist/` at build time and 301-redirects historical `/zh/*` paths to the site root.

### Configure Production CMS (`keystatic-workers` branch only)

> The static default branch has no server, so there is no live `/keystatic`. The steps below apply to the `keystatic-workers` branch (Keystatic + Cloudflare Workers). That branch currently cannot build due to an upstream Astro 6 Cloudflare-adapter prerender bug — see [Branches](#-branches).

To edit content on the live site (`/keystatic`), connect Keystatic to GitHub:

1.  **Create a GitHub App**:
    -   Go to [GitHub Developer Settings](https://github.com/settings/apps) > New GitHub App.
    -   **Homepage URL**: `https://your-site.pages.dev`
    -   **Callback URL**: `https://your-site.pages.dev/api/keystatic/github/oauth/callback`
    -   If you have set up a custom domain, replace the domain above accordingly.
    -   **Permissions**: Read & Write access to "Contents", Read-only access to "Metadata".
    -   Save the `Client ID` and generate a `Client Secret`.
    -   Find **Install App** in the left menu and install it to your content repository.
2.  **Set Environment Variables in Cloudflare**:
    -   Go to your project > Settings > Environment variables.
    -   Add: `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`, `KEYSTATIC_SECRET` (a random long string), then redeploy.

## 📂 Project Structure

```text
/
├── astro-paper.config.ts   # Site config (title, author, socials, feature flags…)
├── astro.config.ts         # Astro & i18n configuration
├── src/
│   ├── content/
│   │   ├── posts/
│   │   │   ├── zh/          # Chinese posts
│   │   │   └── en/          # English posts
│   │   └── pages/
│   │       ├── zh/about.md  # Chinese About page
│   │       └── en/about.md  # English About page
│   ├── pages/
│   │   ├── index.astro      # Chinese (default-locale, root) route tree
│   │   ├── posts/ tags/ ... # Chinese pages
│   │   └── [lang]/          # English (/en/) route tree
│   ├── i18n/                # UI strings (lang/zh.ts, lang/en.ts) + bilingual helpers
│   └── components/          # Shared UI (incl. LanguageSwitcher)
├── _redirects              # Cloudflare Pages redirects (copied to dist/ at build)
└── public/                 # Static assets
```

## 📝 Writing Content

Create Markdown/MDX files in `src/content/posts/zh/` or `src/content/posts/en/`. **The directory prefix is the language**: a file under `zh/` becomes `/posts/<slug>`, and under `en/` becomes `/en/posts/<slug>`. Use the same `slug` in both languages so the language switcher maps them one-to-one.

(On the `keystatic-workers` branch you can also edit visually at `/keystatic`.)

### Mixing languages

English pages turn on the font's proportional widths (`pwid`) so curly quotes, apostrophes and dashes take Latin widths. A Chinese passage inside an English post gets them too, which narrows its full-width comma and parentheses. Mark the passage's language to keep them full-width:

```md
The sign read <span lang="zh">所有内容，均为生成。</span>
```

Chinese posts are unaffected; write English inside them as usual.

### Table of contents

A post with at least 3 h2–h3 headings gets a table of contents: on wide screens (≥1280px) a rail beside the article that follows your reading position, on smaller screens a floating button (bottom start) that opens it as a sheet. Headings holding math, inline code or links are listed as clean plain text. Tune the threshold and depth in `astro-paper.config.ts`:

```ts
features: {
  toc: { enabled: true, minHeadings: 3, maxDepth: 3 }, // enabled: false turns it off site-wide
},
```

Per post, frontmatter overrides it: `toc: false` hides it, `toc: true` shows it even below the threshold. A remark-toc "Table of contents" / "目录" heading in the body is never listed.

### Reading time

Post cards and the post header show an estimated reading time after the date ("5 min read"). CJK characters (~400/min) and Latin words (~230/min) are counted separately and added up, so a Chinese post full of English terms is estimated as fairly as an English one; code blocks, math, URLs and markup don't count. `gallery: true` posts show none. Turn it off with `features.readingTime: false`.

### Related posts

At the end of each post, up to three posts in the same language that share the most tags (newer first on a tie) are listed. Tags are compared by their slug, so `Photography` and `photography` match. The `others` tag that untagged posts get by default doesn't count. A post whose tags no other post uses gets no list. Turn it off with `features.relatedPosts: false`.

### Share links

The share row under each post starts with a "Copy link" button (on devices with a system share sheet it opens that instead), followed by `shareLinks` from `astro-paper.config.ts`. In a share URL, `{url}` and `{title}` are replaced by the post's URL and title, both URL-encoded; a URL with neither placeholder gets the post URL appended, as before:

```ts
shareLinks: [
  { name: "x", url: "https://x.com/intent/post?url={url}&text={title}" },
  { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" }, // URL appended
  { name: "mail", url: "mailto:?subject={title}&body={url}" },
],
```

## 📸 Photo Gallery

The `/gallery` page collects image-host photos straight from your posts' bodies. There's **no separate image list to maintain** — the photos come from the `![alt](url)` links already in your travelogues.

### 1. Enable & configure

Turn it on in `astro-paper.config.ts` and list the allowed image-host domains (a whitelist):

```ts
features: {
  gallery: {
    enabled: true,
    imageDomains: ["img.example.com"], // only images on these hosts are collected
  },
},
```

Add `gallery: true` to the frontmatter of any post you want in the gallery. At build time its body images on whitelisted hosts are extracted (`alt` becomes the caption); albums are grouped per post, newest-first, and the title links back to the post. Each language is extracted independently.

```yaml
---
title: My Travelogue
pubDatetime: 2026-06-20T09:00:00Z
description: …
gallery: true
---
```

#### Per-image control

`gallery` only sets the post's **default**; any single image can override it through the markdown title attribute:

| frontmatter `gallery` | no title / other title | `"nogallery"` | `"gallery"` |
| --- | --- | --- | --- |
| `true` | included | **excluded** | included |
| unset / `false` | not included | not included | **included** |

```md
<!-- a gallery post (gallery: true) with a screenshot that doesn't belong in the album -->

![The route we walked that day](https://img.example.com/route-map.png "nogallery")

<!-- an ordinary post (no gallery flag) sending one photo to the gallery -->

![The sky on the morning we left](https://img.example.com/sky.jpg "gallery")
```

Markers are trimmed and case-insensitive and must match `gallery` or `nogallery` **exactly**; every other title is an ordinary image title and still shows as a tooltip. The domain whitelist remains a hard gate — `"gallery"` cannot pull in an image from a host you haven't configured. Videos use the same syntax and follow the same rules.

Markers never reach the rendered HTML, so no reader ever sees a `title="nogallery"` tooltip. An excluded image is just a plain image: no thumbnail, no manifest entry, no EXIF overlay in the post — entries generated earlier are cleared by `--prune` below, which is how CI runs the script. Any post with at least one included image becomes its own album on `/gallery`.

### 2. Generate thumbnails & EXIF

The grid renders **thumbnails committed to the repo** (`public/gallery/thumbs/`, 800px AVIF) plus a `src/data/gallery-manifest.json` (dimensions and a privacy-safe EXIF subset — **never GPS**). The site build itself downloads and transcodes nothing; it only reads the manifest.

Generate locally:

```bash
node scripts/generate-gallery-thumbs.mjs          # incremental: existing thumbs are skipped
node scripts/generate-gallery-thumbs.mjs --prune  # also delete thumbs no longer referenced
```

The script encodes thumbnails with `sharp` and extracts EXIF with `exifr`. If a host serves 10-bit AVIF that sharp's prebuilt build can't decode, it falls back to `avifdec` (libavif-bin) / ImageMagick — so those are only needed when required.

### 3. Automation & the "double build"

`.github/workflows/gallery.yml` runs the script automatically when a push to `main` touches `src/content/posts/**`, then commits the generated thumbnails + manifest back to `main` as a bot commit. So adding photos triggers two builds:

1. **Content push → first build**: thumbnails don't exist yet, so missing photos temporarily **fall back to the original image**;
2. **Bot commit of thumbnails → second build**: thumbnails land and the grid switches to the lightweight repo AVIFs.

The "fallback window" in between is usually just a few minutes. The flow needs no secrets and never touches your deploy config (GITHUB_TOKEN pushes don't recursively trigger Actions, and the pushed paths don't match the `paths` filter). If `main` has branch protection, allow Actions to bypass it or use a PAT.

> v1 only recognizes Markdown image syntax `![](…)`; `<img>` in MDX and reference-style images aren't collected yet.
>
> Image syntax inside fenced code blocks and inline code spans is skipped, so a post can demonstrate the syntax above without conjuring an album out of its own examples. Indented (4-space) code blocks are not — they can't be told apart from an image nested in a list item — so reach for fences when writing a tutorial.

### 4. Filtering by camera / lens / focal length

The gallery page opens with a collapsed **Filter** panel: its first row is an album index (click to jump to an album), followed by three groups of multi-select chips — **camera**, **lens**, and **focal length** (35mm-equivalent, in six buckets from ultra-wide to super tele). Choices within a group are OR-ed and groups are AND-ed; each chip's count updates live with the other groups' picks, and photos lacking that piece of EXIF fall under "Unknown".

- Every option is derived at build time from the EXIF already in the manifest — **no camera or lens name is hard-coded**, and the manifest is untouched. A dimension with fewer than two values is left out, and with no dimension left the panel isn't rendered at all.
- A built-in lens's verbose name is tidied into a readable label, e.g. `iPhone 15 Pro back triple camera 6.765mm f/1.78` becomes `iPhone 15 Pro 24mm ƒ/1.78` (the physical focal length is swapped for the 35mm equivalent that lens was most often shot at); interchangeable lens names are kept verbatim.
- The selection lives in the URL (`/gallery/?camera=…&lens=…&focal=24-35,36-70`), so a filtered view can be shared, and the lightbox skips photos the filter has hidden.
- The panel is revealed by script; without JavaScript the page is the plain album list.

## 🔎 Semantic search (optional)

The search page can show a small "Related by meaning" panel between the Pagefind input and its results, powered by [Cloudflare AI Search](https://developers.cloudflare.com/ai-search/) and driven by the same input. It is **off by default**. When on, Pagefind still answers instantly and stays the fallback: if the semantic side times out, errors or finds nothing, the panel simply hides and the page is plain Pagefind.

1. In the Cloudflare dashboard, create an AI Search instance with a **Website** data source pointing at your site (the domain must be on the same Cloudflare account).
2. Limit crawling to post pages: include `**/posts/*/`, exclude the paginated list pages (`**/posts/2/`, `**/posts/3/`, … one per page), and add a content selector with path `**/posts/*/` and selector `#article`. Use static fetching, not browser rendering.
3. Enable the **public endpoint** with only `/search` turned on, and add your site origin with its scheme (e.g. `https://example.com`) to the authorized hosts.
4. Put the public endpoint URL (`https://<id>.search.ai.cloudflare.com`) in the `PUBLIC_AI_SEARCH_URL` env var (e.g. a Cloudflare Pages build variable), or in `astro-paper.config.ts`:

```ts
features: {
  aiSearch: { endpoint: "https://<id>.search.ai.cloudflare.com" },
},
```

The config value wins over the env var, and `aiSearch: false` turns the feature off even when the env var is set. `timeoutMs` (default 5000), `maxResults` (default 5) and `matchThreshold` (default 0.4) are optional. Queries are filtered to the current language's posts; the query text is sent to Cloudflare, and the panel says so.

## 🧩 Branches

| Branch | Purpose | Status |
| --- | --- | --- |
| `main` | **Pure-static** bilingual site, deployed to Cloudflare **Pages** | ✅ builds, recommended |
| `keystatic-workers` | Same bilingual site **+ Keystatic CMS + Cloudflare Workers** (server-side rendering) | ⏳ does not build yet, pending upstream fix |

`keystatic-workers` keeps the full Keystatic config and the Cloudflare Workers adapter. However, the Astro 6 `@astrojs/cloudflare` adapter prerenders in the `workerd` runtime, which currently breaks static builds ([withastro/astro#15684](https://github.com/withastro/astro/issues/15684), [#15650](https://github.com/withastro/astro/issues/15650)) and cannot run satori/sharp for OG images. Once the adapter is fixed, switch to that branch to regain the live CMS.

## 🔄 Upgrading from upstream astro-paper

This repo stays close to upstream and keeps the bilingual customizations isolated, so following upstream [astro-paper](https://github.com/satnaing/astro-paper) is a normal git flow:

```bash
# one-time: add the upstream remote
git remote add upstream https://github.com/satnaing/astro-paper.git

# each upgrade:
git fetch upstream
git merge upstream/main      # or `git diff main upstream/main` to review first
# resolve conflicts only in the fork-specific files listed below
pnpm install
pnpm build                   # verify
```

**Fork-specific files** (where upgrade conflicts will concentrate):

- `astro.config.ts` — i18n config (zh/en, `prefixDefaultLocale:false`).
- `astro-paper.config.ts` — site info & feature flags.
- `src/content.config.ts` / `src/content/posts/{zh,en}/` — per-locale content.
- `src/i18n/lang/zh.ts`, `src/i18n/helpers.ts` — Chinese strings & bilingual helpers.
- `src/utils/getPostPaths.ts` — strips the locale dir from slugs; infers locale from dir.
- `src/pages/[lang]/**` — English route tree (upstream is single-language).
- The `getCollection("posts", …)` calls in `src/pages/**` — add per-locale (`zh/`) filtering.
- `src/components/LanguageSwitcher.astro` + the redirect script in `src/layouts/Layout.astro`, both fed by `src/utils/resolveAlternate.ts` (which pages exist in each language: a new page needs a route file in both `src/pages/` and `src/pages/[lang]/` to get a counterpart link and `hreflang`).
- `src/styles/theme.css` `--font-app` (CJK stack) + the font import in `src/layouts/Layout.astro`.
- `_redirects`, `package.json` (deploy-related deps & scripts).

## 📜 License

MIT Licensed.
