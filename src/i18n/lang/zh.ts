import type { UIStrings } from "../types";

export default {
  nav: {
    home: "首页",
    posts: "文章",
    tags: "标签",
    about: "关于",
    archives: "归档",
    gallery: "相册",
    search: "搜索",
  },
  post: {
    publishedAt: "发布于",
    updatedAt: "更新于",
    sharePostIntro: "分享这篇文章：",
    sharePostOn: "分享到 {{platform}}",
    sharePostViaEmail: "通过邮件分享",
    tagLabel: "标签",
    backToTop: "回到顶部",
    goBack: "返回",
    editPage: "编辑此页",
    previousPost: "上一篇",
    nextPost: "下一篇",
  },
  pagination: {
    prev: "上一页",
    next: "下一页",
    page: "第",
  },
  home: {
    socialLinks: "社交链接",
    featured: "精选文章",
    recentPosts: "最新文章",
    allPosts: "全部文章",
  },
  footer: {
    copyright: "版权所有",
    allRightsReserved: "保留所有权利。",
  },
  pages: {
    tagTitle: "标签",
    tagDesc: "所有带有此标签的文章",

    tagsTitle: "标签",
    tagsDesc: "按话题串起的文章。",

    postsTitle: "文章",
    postsDesc: "写下来的，就不会忘了。",

    archivesTitle: "归档",
    archivesDesc: "旧文按时间沉淀在这里。",

    galleryTitle: "相册",
    galleryDesc: "被光记住的片刻。",
    galleryEmpty: "快门还没响过。",

    searchTitle: "搜索",
    searchDesc: "用几个字，找回一篇文章。",
  },
  a11y: {
    skipToContent: "跳转到正文",
    openMenu: "打开菜单",
    closeMenu: "关闭菜单",
    toggleTheme: "切换主题",
    searchPlaceholder: "搜索文章……",
    noResults: "未找到结果",
    goToPreviousPage: "前往上一页",
    goToNextPage: "前往下一页",
    lightboxClose: "关闭",
    lightboxZoom: "缩放",
    lightboxPrev: "上一张",
    lightboxNext: "下一张",
    lightboxError: "图片加载失败。",
  },
  notFound: {
    title: "404 未找到",
    message: "页面不存在",
    goHome: "返回首页",
  },
} satisfies UIStrings;
