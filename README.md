# Bilingual Blog Starter 🌍

[English](README-en.md)

[Demo](https://astropages-bilingual.pages.dev)

[我的博客](https://t0saki.com)同样使用了这个模版。

一个基于 [Astro v6](https://astro.build)（对齐上游 [astro-paper](https://github.com/satnaing/astro-paper) **v6.1**）和 [Cloudflare Pages](https://pages.cloudflare.com) 构建的现代、高性能双语博客模版。

面向访客使用 **SSG（静态站点生成）** 以获得极致性能。可选的、基于 Git 的 [Keystatic CMS](https://keystatic.com)（无需数据库）保留在 `keystatic-workers` 分支上，详见下文 [分支说明](#-分支说明)。

本项目基于 [astro-paper](https://github.com/satnaing/astro-paper) 主题，并针对原生 i18n、Astro 6 与工程健壮性进行了重构。

## ✨ 特性

- **Astro v6 原生 i18n**：全路由结构，中文在根路径 `/`，英文在 `/en/`，含语言切换器与首访语言重定向。
- **纯静态输出 (SSG)**：默认分支为纯静态，部署到 Cloudflare Pages，无需服务端运行时。
- **可选 Keystatic CMS**：基于 Git 的 Headless CMS（`keystatic-workers` 分支）。
- **类型安全的内容管理**：对所有博客文章进行严格的 `astro:content` schema 校验。
- **动态 OG 图片**：基于 satori + sharp 在构建时为每篇文章生成 OpenGraph 图片。
- **中文字体**：内置思源屏显臻宋（`@chinese-fonts/sypxzs`）。
- **静态全文搜索**：基于 [Pagefind](https://pagefind.app/)，按语言分别索引。
- **数学公式**：Markdown 内嵌 LaTeX 公式，构建期由 [KaTeX](https://katex.org/) 渲染（remark-math + rehype-katex），无需客户端 JS。
- **SEO 优化**：预配置多语言 Meta 标签、Sitemap 与 OpenGraph。

## 🛠️ 快速开始

### 1. 环境要求

- Node.js **v22.12+**（Astro 6 要求）
- GitHub 账号（使用 Keystatic CMS 时需要）
- Cloudflare 账号（可选，用于部署）

### 2. 安装

克隆此仓库并安装依赖（推荐 `pnpm`）：

```bash
git clone https://github.com/t0saki/AstroPages-Bilingual.git
cd AstroPages-Bilingual
pnpm install
```

### 3. 本地开发

启动开发服务器：

```bash
pnpm dev
```

- **博客**：访问 `http://localhost:4321/`（中文首页）或 `http://localhost:4321/en/`（英文首页）。
- **CMS**：默认分支为纯静态，不含 `/keystatic`。如需可视化内容管理，请切换到 `keystatic-workers` 分支后访问 `/keystatic`（见 [分支说明](#-分支说明)）。

## ☁️ 部署

### 部署到 Cloudflare Pages

1. Fork 这个仓库。
2. 登录 Cloudflare Dashboard > Workers 和 Pages > 创建应用程序 > 下面小字 Pages Get Started > Connect to Git。
3. 选择你的仓库。
4. **构建设置 (Build Settings)**：
   - **Framework Preset**: Astro
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`（默认）
5. 点击 **Save and Deploy**。
6. **注意**：部署完成后，建议在 Cloudflare Dashboard 的 **Speed > Optimization** 中**关闭 Rocket Loader**。Rocket Loader 会干扰 Astro 的客户端路由（View Transitions），导致页面导航和脚本执行异常。

> 旧链接兼容：根目录的 `_redirects` 会在构建时拷入 `dist/`，把历史的 `/zh/*` 路径 301 重定向到根路径。

### 配置生产环境 CMS（仅 `keystatic-workers` 分支）

> 纯静态的默认分支没有服务端，因此线上没有 `/keystatic`。以下步骤适用于 `keystatic-workers` 分支（Keystatic + Cloudflare Workers）。该分支当前受上游 Astro 6 Cloudflare 适配器的预渲染缺陷影响，暂时无法构建（见 [分支说明](#-分支说明)）。

要在线上站点 (`/keystatic`) 编辑内容，需要将 Keystatic 连接到 GitHub：

1. **创建 GitHub App**：
   - 前往 [GitHub Developer Settings](https://github.com/settings/apps) > New GitHub App。
   - **Homepage URL**: `https://your-site.pages.dev`
   - **Callback URL**: `https://your-site.pages.dev/api/keystatic/github/oauth/callback`
   - 如果你设置了自定义域名（国内环境强烈推荐），请相应替换上述域名。
   - **Permissions**: 对 "Contents" 的读写权限 (Read & Write)，对 "Metadata" 的只读权限 (Read-only)。
   - 保存 `Client ID` 并生成一个 `Client Secret`。
   - 左边菜单找到 **Install App**，安装到你的内容仓库。
2. **在 Cloudflare 设置环境变量**：
   - 前往项目 > Settings > Environment variables。
   - 添加以下变量：
     - `KEYSTATIC_GITHUB_CLIENT_ID`: (你的 Client ID)
     - `KEYSTATIC_GITHUB_CLIENT_SECRET`: (你的 Client Secret)
     - `KEYSTATIC_SECRET`: (用于会话加密的随机长字符串)
   - 添加完以后重新部署以使变量生效，访问 `/keystatic` 使用 GitHub 登录管理内容。

## 📂 项目结构

```text
/
├── astro-paper.config.ts   # 站点配置（标题、作者、socials、功能开关…）
├── astro.config.ts         # Astro & i18n 配置
├── src/
│   ├── content/
│   │   ├── posts/
│   │   │   ├── zh/          # 中文文章
│   │   │   └── en/          # 英文文章
│   │   └── pages/
│   │       ├── zh/about.md  # 中文「关于」页
│   │       └── en/about.md  # 英文「关于」页
│   ├── pages/
│   │   ├── index.astro      # 中文（默认语言，根路径）路由树
│   │   ├── posts/ tags/ ... # 中文各页
│   │   └── [lang]/          # 英文（/en/）路由树
│   ├── i18n/                # UI 文案（lang/zh.ts、lang/en.ts）+ 双语 helper
│   └── components/          # 通用 UI 组件（含 LanguageSwitcher）
├── _redirects              # Cloudflare Pages 重定向（构建时拷入 dist/）
└── public/                 # 静态资源
```

## 📝 撰写内容

在 `src/content/posts/zh/` 或 `src/content/posts/en/` 中直接创建 Markdown/MDX 文件即可。**目录前缀即语言**：`zh/` 下的文章生成 `/posts/<slug>`，`en/` 下的文章生成 `/en/posts/<slug>`。两种语言使用相同的 `slug` 即可在语言切换时一一对应。

（在 `keystatic-workers` 分支上，也可以通过 `/keystatic` 可视化编辑。）

## 🧩 分支说明

| 分支                | 用途                                                                  | 状态                        |
| ------------------- | --------------------------------------------------------------------- | --------------------------- |
| `main`              | **纯静态**双语站点，部署到 Cloudflare **Pages**                       | ✅ 正常构建、推荐使用       |
| `keystatic-workers` | 同样的双语站点 **+ Keystatic CMS + Cloudflare Workers**（生产端 SSR） | ⏳ 暂不可构建，等待上游修复 |

`keystatic-workers` 分支保留了完整的 Keystatic 配置与 Cloudflare Workers 适配器。但 Astro 6 的 `@astrojs/cloudflare` 适配器在 `workerd` 运行时预渲染，目前会导致静态构建失败（[withastro/astro#15684](https://github.com/withastro/astro/issues/15684)、[#15650](https://github.com/withastro/astro/issues/15650)），且 `workerd` 无法运行 satori/sharp 生成 OG 图片。待该适配器修复后，即可切换到该分支获得线上 CMS 能力。

## 🔄 从上游 astro-paper 升级

本仓库刻意尽量贴近上游、把双语相关的定制集中隔离，因此后续跟进上游 [astro-paper](https://github.com/satnaing/astro-paper) 更新只需常规的 git 操作：

```bash
# 一次性：添加上游远程
git remote add upstream https://github.com/satnaing/astro-paper.git

# 每次升级：
git fetch upstream
git merge upstream/main      # 或 git diff main upstream/main 先查看改动
# 仅需在下列「本仓库定制文件」中解决冲突
pnpm install
pnpm build                   # 验证构建
```

**本仓库相对上游的定制文件**（升级时主要在这些地方解决冲突）：

- `astro.config.ts` — i18n 配置（zh/en、`prefixDefaultLocale:false`）。
- `astro-paper.config.ts` — 站点信息与功能开关。
- `src/content.config.ts` / `src/content/posts/{zh,en}/` — 按语言分目录的内容。
- `src/i18n/lang/zh.ts`、`src/i18n/helpers.ts` — 中文文案与双语路由 helper。
- `src/utils/getPostPaths.ts` — 从 slug 中剥离语言目录、按目录推断语言。
- `src/pages/[lang]/**` — 英文路由树（上游为单语言，无此目录）。
- `src/pages/**` 中各页的 `getCollection("posts", …)` — 增加了按语言（`zh/`）过滤。
- `src/components/LanguageSwitcher.astro` + `src/layouts/Layout.astro` 的语言重定向脚本。
- `src/styles/theme.css` 的 `--font-app`（中文字体栈）+ `src/layouts/Layout.astro` 的字体导入。
- `_redirects`、`package.json`（部署相关依赖与脚本）。

## 📜 本次 v6.1 重构要点

- **Astro 5 → 6 / Tailwind 4.1 → 4.3**：升级框架，采用上游 v6.1 的配置架构（`astro-paper.config.ts` + `src/config.ts` resolver）。
- **内容迁移**：`src/data/blog/` → `src/content/posts/`，集合 `blog` → `posts`。
- **i18n 文案**：扁平的 `ui.ts` → 上游的 typed `UIStrings`（新增中文 `lang/zh.ts`）。
- **新特性**：callouts（rehype-callouts）、图片 lightbox、MDX。
- **部署变更**：因 Astro 6 的 Cloudflare 适配器只支持 Workers 且其预渲染暂不可用，`main` 改为**纯静态 + Cloudflare Pages**；Keystatic/Workers 版保留在 `keystatic-workers` 分支。

## 📜 许可证
