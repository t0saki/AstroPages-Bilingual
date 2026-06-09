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
- **Dynamic OG Images**: per-post OpenGraph images generated at build time (satori + sharp).
- **Chinese Font**: bundled Source Han Serif (`@chinese-fonts/sypxzs`).
- **Static Full-Text Search**: [Pagefind](https://pagefind.app/), indexed per language.
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
- `src/components/LanguageSwitcher.astro` + the redirect script in `src/layouts/Layout.astro`.
- `src/styles/theme.css` `--font-app` (CJK stack) + the font import in `src/layouts/Layout.astro`.
- `_redirects`, `package.json` (deploy-related deps & scripts).

## 📜 License

MIT Licensed.
