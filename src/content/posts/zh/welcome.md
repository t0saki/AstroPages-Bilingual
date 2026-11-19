---
title: 欢迎使用 AstroPaper
pubDatetime: 2026-01-11T00:00:00Z
description: 这是一篇示例中文博客文章，用于演示双语博客系统。
featured: true
draft: false
tags:
  - 欢迎
  - 介绍
---

# 欢迎来到 AstroPaper 双语博客

这是一个基于 Astro Paper 主题构建的双语博客系统。

## 主要特性

- 🌍 **双语支持**：完整的中英文内容支持
- 🚀 **高性能**：基于 Astro 5 的静态站点生成
- ✍️ **Keystatic CMS**：直观的内容管理体验
- ☁️ **Cloudflare Pages**：边缘部署，全球加速

## 技术栈

本博客使用了以下技术：

- Astro v5 with Native i18n
- Keystatic Headless CMS
- TailwindCSS v4
- TypeScript

## 数学公式

文章支持 Markdown 内嵌 LaTeX 公式，由 KaTeX 在构建期渲染。例如行内的质能方程 $E = mc^2$，以及块级公式：

$$
\int_0^1 x^2 \, dx = \frac{1}{3}
$$

## 聊天记录

语言标记为 `chat` 的代码块会在构建时重绘成一段聊天记录：文字可以选中和搜索，跟随亮色/暗色主题，内容太长时在框内滚动。

```chat
title: 博客搭建互助群
meta: 群聊 · 2026 年 1 月
caption: 示例对话，人物和地址均为虚构。
people:
  部署助手: { bot: true }
  我: { self: true }
messages:
  - time: "21:05"
  - 小林: 你的博客上线了吗
  - 我: 刚推上去，Cloudflare 还在构建
  - 我: "@部署助手 看一下最新一次构建"
  - from: 部署助手
    reply: { from: 我, text: "@部署助手 看一下最新一次构建" }
    text: |
      构建成功，用时 48 秒。

      共生成 36 个页面，搜索索引已更新。
    card:
      label: 构建报告
      rows:
        - title: main · a1b2c3d
        - stats: { 页面: 36, 用时: 48s, 警告: 0 }
        - lines: [92, 74, 48]
    reactions: ["🎉 2", "👍 1"]
  - 小林: 这么快
  - 小林: 我的还卡在 `pnpm install`
  - 阿杰: 是不是锁文件没提交
  - 小林: 好像是，我看看
  - note: 阿杰 把群名改成了“博客搭建互助群”
  - gap: 中间略去 8 条
  - time: "22:30"
  - 小林: 搞定了，原来是 Node 版本太旧
  - 小林: 顺便问一下，评论区用什么好
  - 阿杰: 我用的 ████，自己部署在 ██████ 上
  - 我: "@小林 先别折腾评论区了，把第一篇文章写出来再说"
  - from: 小林
    text: 有道理
    reactions: ["😂 3"]
  - from: 部署助手
    text: |
      小林 的站点也构建成功了：
      `https://example.pages.dev`
```

祝你使用愉快！
