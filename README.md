# Bilingual Blog Starter 🌍

[English](README-en.md)

[Demo](https://astropages-bilingual.pages.dev)

一个基于 [Astro v5](https://astro.build)、[Keystatic CMS](https://keystatic.com) 和 [Cloudflare Pages](https://pages.cloudflare.com) 构建的现代、高性能双语博客模版。

专为追求“混合（Hybrid）”体验的工程师和内容创作者设计：面向访客使用 **SSG (静态站点生成)** 以获得极致性能，同时提供 **Headless CMS** 带来无需维护数据库的优秀写作体验。

本项目基于 [astro-paper](https://github.com/satnaing/astro-paper) 主题，并针对原生 i18n 和工程健壮性进行了重构。

## ✨ 特性

* **Astro v5 原生 i18n**：全路由结构，中文在根路径 `/`，英文在 `/en/`，支持零配置重定向。
* **混合渲染 (Hybrid Rendering)**：访客端为静态页面 (SSG)，CMS 管理端为动态路由 (SSR)。
* **Keystatic CMS**：基于 Git 的 Headless CMS。无需数据库，内容直接存储在你的代码仓库中。
* **Cloudflare Pages**：预配置部署设置，支持自动化构建。
* **类型安全的内容管理**：对所有博客文章进行严格的 `astro:content` schema 校验。
* **SEO 优化**：预配置多语言的 Meta 标签、Sitemap 和 OpenGraph 图片。

## 🛠️ 快速开始

### 1. 环境要求

* Node.js v18+
* GitHub 账号（用于 CMS 存储）
* Cloudflare 账号（可选，用于部署）

### 2. 安装

克隆此仓库并安装依赖：

```bash
git clone https://github.com/t0saki/AstroPages-Bilingual.git
cd AstroPages-Bilingual
npm install

```

### 3. 本地开发

启动开发服务器：

```bash
npm run dev

```

* **博客**：访问 `http://localhost:4321/` (中文首页) 或 `http://localhost:4321/en/` (英文首页)
* **CMS**：访问 `http://localhost:4321/keystatic` 在本地管理内容。

## ☁️ 部署

### 部署到Cloudflare Pages

1. Fork 这个仓库。
2. 登录 Cloudflare Dashboard > Workers 和 Pages > 创建应用程序 > 下面小字Pages Get Started > Connect to Git。
3. 选择你的仓库。
4. **构建设置 (Build Settings)**：
* **Framework Preset**: Astro
* **Build Command**: `npm run build` (默认)
* **Output Directory**: `dist` (默认)


5. 点击 **Save and Deploy**。
6. **注意**：部署完成后，建议在 Cloudflare Dashboard 的 **Speed > Optimization** 中**关闭 Rocket Loader**。Rocket Loader 会干扰 Astro 的客户端路由（View Transitions），导致页面导航和脚本执行异常。

### 配置生产环境 CMS (GitHub 模式)

要在线上站点 (`/keystatic`) 编辑内容，需要将 Keystatic 连接到 GitHub。如果您希望直接通过 GitHub 管理内容而不是通过单独的 Keystatic 管理端，可以跳过此步骤。

1. **创建 GitHub App**：
* 前往 [GitHub Developer Settings](https://github.com/settings/apps) > New GitHub App。
* **Homepage URL**: `https://your-site.pages.dev`
* **Callback URL**: `https://your-site.pages.dev/api/keystatic/github/oauth/callback`
* 如果你设置了自定义域名（国内环境强烈推荐），请相应替换上述域名。
* **Permissions**: 对 "Contents" 的读写权限 (Read & Write)，对 "Metadata" 的只读权限 (Read-only)。
* 保存 `Client ID` 并生成一个 `Client Secret`。
* 左边菜单找到 **Install App**，安装到你的内容仓库。


2. **在 Cloudflare 设置环境变量**：
* 前往 Pages 项目 > Settings > Environment variables。
* 添加以下变量：
* `KEYSTATIC_GITHUB_CLIENT_ID`: (你的 Client ID)
* `KEYSTATIC_GITHUB_CLIENT_SECRET`: (你的 Client Secret)
* `KEYSTATIC_SECRET`: (用于会话加密的随机长字符串)
* 添加完以后重新部署以使变量生效。
* 部署完成后，访问 `https://your-site.pages.dev/keystatic`，使用 GitHub 登录即可管理线上内容。


## 📂 项目结构

```text
/
├── src/
│   ├── content/
│   │   └── blog/
│   │       ├── zh/         # 中文文章
│   │       └── en/         # 英文文章
│   ├── pages/
│   │   └── [lang]/         # i18n 动态路由
│   │       ├── index.astro
│   │       └── posts/...
│   └── components/         # 通用 UI 组件
├── keystatic.config.ts     # CMS 配置
├── astro.config.mjs        # Astro & i18n 配置
└── public/                 # 静态资源

```

## 📝 撰写内容

你可以通过两种方式撰写内容：

1. **通过 Keystatic UI**：访问 `/keystatic`，使用 GitHub 登录并使用可视化编辑器。
2. **直接创建文件**：在 `src/content/blog/zh/` 或 `src/content/blog/en/` 中直接创建 Markdown/MDX 文件。

## 📜 许可证

MIT Licensed.