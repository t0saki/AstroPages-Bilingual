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
- **动态 OG 图片**：基于 satori + sharp 在构建时为每篇文章生成 OpenGraph 图片；中文（以及其他非拉丁文字）标题会自动取用回退字体，不会渲染成豆腐块。
- **中文字体**：内置思源屏显臻宋（`@chinese-fonts/sypxzs`）。
- **静态全文搜索**：基于 [Pagefind](https://pagefind.app/)，按语言分别索引；可选叠加 Cloudflare AI Search 语义结果（见 [语义搜索](#-语义搜索可选)）。
- **数学公式**：Markdown 内嵌 LaTeX 公式，构建期由 [KaTeX](https://katex.org/) 渲染（remark-math + rehype-katex），无需客户端 JS。
- **照片相册**：`/gallery` 页汇集设置了 `gallery: true` 的文章中的图床照片，按文章分组，悬停显示 EXIF（机型/镜头/参数），点击进 [PhotoSwipe](https://photoswipe.com/) 灯箱。可按相机、镜头、焦段筛选。缩略图与 EXIF 由脚本预生成入库（见 [照片相册](#-照片相册)）。**视频同样支持**：链接指向 `.mp4`/`.webm`/`.mov`/`.m4v` 即可，正文渲染成内联播放器，相册页收进一格带播放角标的画面。
- **文章目录**：标题足够多的文章自动生成目录——宽屏（≥1280px）在正文右侧常驻并随阅读位置高亮，窄屏收进左下角的浮动按钮，点开是一张目录面板（见 [文章目录](#文章目录)）。
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

### 中英混排

英文页面会启用字体的比例宽度（`pwid`），让弯引号、撇号和破折号按西文宽度排版。英文文章里如果夹了一段中文，其中的全角逗号和括号也会被压成西文宽度。给这段中文标上语言即可恢复全角：

```md
The sign read <span lang="zh">所有内容，均为生成。</span>
```

中文文章不受影响，里面的英文照常书写。

### 文章目录

文章里的 h2–h3 标题达到 3 个时，自动生成目录：宽屏（≥1280px）显示在正文右侧、随滚动高亮当前小节；窄屏则是左下角的浮动按钮，点开一张可跳转的目录面板。公式、行内代码、链接等标题会显示成干净的纯文本。阈值与深度在 `astro-paper.config.ts` 中调整：

```ts
features: {
  toc: { enabled: true, minHeadings: 3, maxDepth: 3 }, // enabled: false 全站关闭
},
```

单篇文章可用 frontmatter 覆盖：`toc: false` 不显示，`toc: true` 即使标题不足也显示。正文里 remark-toc 使用的「Table of contents」/「目录」标题不会进入目录。

### 阅读时长

文章卡片和文章页头会在日期后显示预计阅读时长（「约 5 分钟」）。中日韩文字（约 400 字/分钟）和拉丁单词（约 230 词/分钟）分别计数再相加，夹杂大量英文术语的中文文章也能估得准；代码块、公式、链接地址和 HTML 标记不计入。`gallery: true` 的文章不显示。用 `features.readingTime: false` 关闭。

### 相关文章

每篇文章末尾会列出同一语言中共同标签最多的至多三篇文章（同分时较新的在前）。标签按 slug 比较，`Photography` 与 `photography` 视为同一个。未写标签的文章默认得到的 `others` 标签不参与匹配。标签与其他文章都不重合时不显示。用 `features.relatedPosts: false` 关闭。

### 分享链接

文章末尾的分享栏以「复制链接」按钮开头（在有系统分享面板的设备上改为调起分享面板），后面是 `astro-paper.config.ts` 中的 `shareLinks`。分享地址里的 `{url}` 和 `{title}` 会替换成文章的地址和标题（均已 URL 编码）；两个占位符都没写时，沿用旧行为，把文章地址拼接在末尾：

```ts
shareLinks: [
  { name: "x", url: "https://x.com/intent/post?url={url}&text={title}" },
  { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" }, // 末尾拼接地址
  { name: "mail", url: "mailto:?subject={title}&body={url}" },
],
```

## 📸 照片相册

`/gallery` 页面把文章正文里的图床照片汇集成相册。它**不依赖单独维护的图片清单**——照片直接来自游记正文的 `![alt](url)` 外链。

视频走同一条路：写法仍是 `![说明](https://img.example.com/clip.mp4)`，靠扩展名（`.mp4`/`.webm`/`.mov`/`.m4v`）区分。正文里渲染成带封面的 `<video controls>` 就地播放，相册页则是一格带播放角标和时长的画面，点开在灯箱里静音自动播放。封面、尺寸和时长由下面的缩略图脚本预生成——它只抓一帧，不会把整段视频拉下来，站点也从不托管或转码视频本身。

### 1. 开启与配置

在 `astro-paper.config.ts` 中开启，并列出允许收集的图床域名（白名单）：

```ts
features: {
  gallery: {
    enabled: true,
    imageDomains: ["img.example.com"], // 只有这些域名下的图片会被收集
  },
},
```

给想要进相册的文章 frontmatter 加上 `gallery: true`。构建时会从该文正文提取白名单域名下的图片，`alt` 作为图注；相册按文章分组、时间倒序，标题链接回原文。中英文各自独立提取。

```yaml
---
title: 我的游记
pubDatetime: 2026-06-20T09:00:00Z
description: ……
gallery: true
---
```

#### 逐图控制

`gallery` 只是这篇文章的**默认**状态，单张图片可以用 Markdown 的 title 属性覆盖它：

| frontmatter `gallery` | 无 title / 其它 title | `"nogallery"` | `"gallery"` |
| --------------------- | --------------------- | ------------- | ----------- |
| `true`                | 入选                  | **排除**      | 入选        |
| 未设 / `false`        | 不入选                | 不入选        | **入选**    |

```md
<!-- 相册文章（gallery: true）里混进一张不该进相册的截图 -->

![当天的徒步路线图](https://img.example.com/route-map.png "nogallery")

<!-- 普通文章（未设 gallery）里单独收一张照片进相册 -->

![出发那天的天空](https://img.example.com/sky.jpg "gallery")
```

标记忽略首尾空白、大小写不敏感，且必须**完全等于** `gallery` 或 `nogallery`；其它 title 只是普通的图片标题，照常作为 tooltip 显示。域名白名单仍是硬门槛——`"gallery"` 不能把白名单之外的图片塞进来。视频写法相同，规则一致。

控制符不会出现在渲染后的 HTML 里，读者不会看到 `title="nogallery"` 这样的 tooltip。被排除的图就是一张普通图片：不生成缩略图、不进 manifest、正文里也没有 EXIF 悬浮层——已经生成过的条目由下面的 `--prune` 清掉（CI 就是这么跑的）。任何文章只要有 ≥1 张入选的图，就会在 `/gallery` 上单独成为一册。

### 2. 生成缩略图与 EXIF

网格显示的是**提交进仓库的缩略图**（`public/gallery/thumbs/`，800px AVIF），配套一份 `src/data/gallery-manifest.json`（记录尺寸与隐私安全的 EXIF 子集，**从不含 GPS**）。视频的封面帧也存在同一处，manifest 里多记 `type: "video"` 与 `duration`。站点构建自身零下载、零转码，只读 manifest。

本地生成：

```bash
node scripts/generate-gallery-thumbs.mjs          # 增量：已有缩略图会跳过
node scripts/generate-gallery-thumbs.mjs --prune  # 顺便清理不再被引用的缩略图
```

脚本用 `sharp` 编码缩略图，`exifr` 提取 EXIF。若图床是 `sharp` 预编译版无法解码的 10-bit AVIF，会回退到 `avifdec`（libavif-bin）/ ImageMagick 解码，故这两者仅在需要时安装。

视频需要 `ffmpeg`/`ffprobe`（且编译时带 https 支持）：脚本用 range 请求直接从图床读取，只取一帧做封面，同时读出显示尺寸（会按旋转矩阵摆正竖拍）、时长和机型，**不会下载整段视频**。HDR 片段的封面保留 10-bit HDR 标记。

### 3. 自动化与"双构建"

`.github/workflows/gallery.yml` 会在 `src/content/posts/**` 变更 push 到 `main` 时自动跑上面的脚本，并把生成的缩略图 + manifest 以 bot 提交推回 `main`。因此新增照片后会经历两次构建：

1. **内容 push → 第一次构建**：此时缩略图尚未生成，缺图的照片临时**回退加载原图**；
2. **bot 提交缩略图 → 第二次构建**：补齐缩略图，网格改用仓库里的轻量 AVIF。

中间通常只有几分钟的"回退窗口"。该流程零 secret、不触碰部署配置（GITHUB_TOKEN 的推送不会递归触发 Actions，且推送路径不匹配 `paths` 过滤）。若 `main` 开启了分支保护，需允许 Actions 绕过或改用 PAT。

> 仅识别 Markdown 图片语法 `![](…)`（视频同样用这个写法）；MDX 里的 `<img>` 或引用式图片暂不收集。
>
> 围栏代码块与行内代码里的图片写法会被跳过，所以可以放心在文章里演示上面这套语法，不会凭空多出一册；四空格缩进的代码块不在此列——它和列表里缩进的图片无法区分，写教程时请用围栏。

### 4. 按相机 / 镜头 / 焦段筛选

相册页顶部有一个默认折叠的「筛选」面板：第一行是相册目录（点击跳到对应相册），下面是**相机**、**镜头**、**焦段**（35mm 等效，分超广角到超长焦六档）三组多选 chip。同一组内多选是「或」，组与组之间是「与」；每个 chip 上的数量会随其它组的选择实时变化，缺少该项 EXIF 的照片归到「未知」。

- 选项全部在构建时从 manifest 里的 EXIF 推导，**代码里不写任何机型或镜头名**，也不需要改 manifest；某个维度不足两个取值时不显示，三个维度都不够就整个面板不渲染。
- 手机等内置镜头的长串名称会被整理成可读的标签，例如 `iPhone 15 Pro back triple camera 6.765mm f/1.78` 显示为 `iPhone 15 Pro 24mm ƒ/1.78`（物理焦距换成该镜头最常用的等效焦距）；可换镜头的名称原样保留。
- 筛选状态写在 URL 里（`/gallery/?camera=…&lens=…&focal=24-35,36-70`），可以直接分享；灯箱翻页会跳过被筛掉的照片。
- 面板由脚本显示，未启用 JavaScript 时页面就是原本的相册列表。

## 🔎 语义搜索（可选）

搜索页可以在 Pagefind 输入框与结果之间加一栏「语义相关」，由 [Cloudflare AI Search](https://developers.cloudflare.com/ai-search/) 按语义找文章，与 Pagefind 共用同一个输入框。**默认关闭**；开启后 Pagefind 照常即时出结果，语义一侧超时、出错或没有结果时这一栏直接隐藏，页面退回纯 Pagefind。

1. 在 Cloudflare 控制台创建 AI Search 实例，数据源选 **Website**，填本站域名（域名须托管在同一 Cloudflare 账号下）。
2. 爬取范围只包含文章页：include 填 `**/posts/*/`，exclude 填分页列表页（`**/posts/2/`、`**/posts/3/` ……，有几页填几条）；内容选择器（content selector）的路径填 `**/posts/*/`，选择器填 `#article`。渲染方式选静态抓取，不要启用浏览器渲染。
3. 开启 **Public endpoint**，只启用 `/search`，并把站点源（含协议，如 `https://example.com`）加入 authorized hosts。
4. 把公开端点地址（`https://<id>.search.ai.cloudflare.com`）写进环境变量 `PUBLIC_AI_SEARCH_URL`（如 Cloudflare Pages 的构建环境变量），或写进 `astro-paper.config.ts`：

```ts
features: {
  aiSearch: { endpoint: "https://<id>.search.ai.cloudflare.com" },
},
```

配置里的值优先于环境变量；`aiSearch: false` 可在设置了环境变量时强制关闭。还可调 `timeoutMs`（默认 5000）、`maxResults`（默认 5）、`matchThreshold`（默认 0.4）。查询只按当前语言的文章前缀过滤，查询内容会发送给 Cloudflare，页面上有一行说明。

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
- `src/components/LanguageSwitcher.astro` + `src/layouts/Layout.astro` 的语言重定向脚本，二者都依赖 `src/utils/resolveAlternate.ts`（判断各语言有哪些页面：新页面要在 `src/pages/` 和 `src/pages/[lang]/` 下都有路由文件，才会生成对应语言的链接和 `hreflang`）。
- `src/styles/theme.css` 的 `--font-app`（中文字体栈）+ `src/layouts/Layout.astro` 的字体导入。
- `_redirects`、`package.json`（部署相关依赖与脚本）。

## 📜 本次 v6.1 重构要点

- **Astro 5 → 6 / Tailwind 4.1 → 4.3**：升级框架，采用上游 v6.1 的配置架构（`astro-paper.config.ts` + `src/config.ts` resolver）。
- **内容迁移**：`src/data/blog/` → `src/content/posts/`，集合 `blog` → `posts`。
- **i18n 文案**：扁平的 `ui.ts` → 上游的 typed `UIStrings`（新增中文 `lang/zh.ts`）。
- **新特性**：callouts（rehype-callouts）、图片 lightbox、MDX。
- **部署变更**：因 Astro 6 的 Cloudflare 适配器只支持 Workers 且其预渲染暂不可用，`main` 改为**纯静态 + Cloudflare Pages**；Keystatic/Workers 版保留在 `keystatic-workers` 分支。

## 📜 许可证
