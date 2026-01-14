# Bilingual Blog Starter 🌍

[中文](README.md)

[Demo](https://astropages-bilingual.pages.dev)

[My Blog](https://t0saki.com) also uses this template.

A modern, high-performance bilingual blog template built with [Astro v5](https://astro.build), [Keystatic CMS](https://keystatic.com), and [Cloudflare Pages](https://pages.cloudflare.com).

Designed for engineers and content creators who want a "Hybrid" experience: **Static Site Generation (SSG)** for extreme performance, and **Headless CMS** for a great writing experience without database maintenance.

Based on the [astro-paper](https://github.com/satnaing/astro-paper) theme, refactored for native i18n and robust engineering.

## ✨ Features

- **Astro v5 Native i18n**: Full routing structure with Chinese at root `/` and English at `/en/`, with zero-config redirection.
- **Hybrid Rendering**: Static pages for visitors (SSG), dynamic routes for CMS admin (SSR).
- **Keystatic CMS**: Git-based Headless CMS. No database required. content lives in your repo.
- **Cloudflare Pages**: Ready-to-deploy configuration with automated builds.
- **Type-Safe Content**: rigorous `astro:content` schema validation for all blog posts.
- **SEO Optimized**: Meta tags, sitemap, and OpenGraph images pre-configured for multi-language.

## 🛠️ Quick Start

### 1. Requirements

- Node.js v18+
- GitHub Account (for CMS storage)
- Cloudflare Account (optional, for deployment)

### 2. Installation

Clone this repository and install dependencies:

```bash
git clone https://github.com/t0saki/AstroPages-Bilingual.git
cd AstroPages-Bilingual
npm install
```

### 3. Local Development

Start the development server:

```bash
npm run dev
```

- **Blog**: Visit `http://localhost:4321/` (Chinese homepage) or `http://localhost:4321/en/` (English homepage)
- **CMS**: Visit `http://localhost:4321/keystatic` to manage content locally.

## ☁️ Deployment

### Deploy to Cloudflare Pages

1.  Fork this repository.
2.  Log in to Cloudflare Dashboard > Workers & Pages > Create application > Pages (Get Started) > Connect to Git.
3.  Select your repository.
4.  **Build Settings**:
    -   **Framework Preset**: Astro
    -   **Build Command**: `npm run build` (default)
    -   **Output Directory**: `dist` (default)
5.  Click **Save and Deploy**.
6.  **Note**: After deployment, it is recommended to **disable Rocket Loader** in Cloudflare Dashboard under **Speed > Optimization**. Rocket Loader interferes with Astro's Client Router (View Transitions), causing issues with page navigation and script execution.

### Configure Production CMS (GitHub Mode)

To edit content on the live site (`/keystatic`), you need to connect Keystatic to GitHub. If you prefer to manage content directly through GitHub instead of using a separate Keystatic admin interface, you can skip this step, and the website should already be functional.

1.  **Create a GitHub App**:
    -   Go to [GitHub Developer Settings](https://github.com/settings/apps) > New GitHub App.
    -   **Homepage URL**: `https://your-site.pages.dev`
    -   **Callback URL**: `https://your-site.pages.dev/api/keystatic/github/oauth/callback`
    -   If you have set up a custom domain, please replace the domain above accordingly.
    -   **Permissions**: Read & Write access to "Contents", Read-only access to "Metadata".
    -   Save the `Client ID` and generate a `Client Secret`.
    -   Find **Install App** in the left menu and install it to your content repository.

2.  **Set Environment Variables in Cloudflare**:
    -   Go to your Pages project > Settings > Environment variables.
    -   Add the following:
        -   `KEYSTATIC_GITHUB_CLIENT_ID`: (Your Client ID)
        -   `KEYSTATIC_GITHUB_CLIENT_SECRET`: (Your Client Secret)
        -   `KEYSTATIC_SECRET`: (A random long string for session encryption)

## 📂 Project Structure

```text
/
├── src/
│   ├── content/
│   │   └── blog/
│   │       ├── zh/         # Chinese posts
│   │       └── en/         # English posts
│   ├── pages/
│   │   └── [lang]/         # i18n dynamic routes
│   │       ├── index.astro
│   │       └── posts/...
│   └── components/         # Shared UI components
├── keystatic.config.ts     # CMS configuration
├── astro.config.mjs        # Astro & i18n configuration
└── public/                 # Static assets
```

## 📝 Writing Content

You can write content in two ways:

1.  **Via Keystatic UI**: Navigate to `/keystatic`, authenticate with GitHub, and use the visual editor.
2.  **Direct File Creation**: Create Markdown/MDX files in `src/content/blog/zh/` or `src/content/blog/en/`.

## 📜 License

MIT Licensed.
