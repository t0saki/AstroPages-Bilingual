export const languages = {
  zh: "中文",
  en: "English",
} as const;

export const defaultLang = "zh" as const;

export type Lang = keyof typeof languages;

export const ui = {
  zh: {
    // Navigation
    "nav.posts": "文章",
    "nav.tags": "标签",
    "nav.about": "关于",
    "nav.archives": "归档",
    "nav.search": "搜索",
    "nav.skipToContent": "跳转到内容",
    "nav.home": "首页",
    "nav.goBack": "返回",
    "nav.searchDesc": "搜索文章...",
    "nav.archivesDesc": "所有归档文章",
    
    // Months
    "month.1": "一月",
    "month.2": "二月",
    "month.3": "三月",
    "month.4": "四月",
    "month.5": "五月",
    "month.6": "六月",
    "month.7": "七月",
    "month.8": "八月",
    "month.9": "九月",
    "month.10": "十月",
    "month.11": "十一月",
    "month.12": "十二月",
    
    // Home page hero
    "hero.greeting": "你好",
    "hero.description": "this is a page",
    "hero.cta": "",
    "hero.socialLinks": "",
    
    // Sections
    "section.featured": "精选文章",
    "section.recentPosts": "最新文章",
    "button.allPosts": "所有文章",
    
    // Post details
    "post.previous": "上一篇",
    "post.next": "下一篇",
    "post.shareOn": "分享到：",
    "post.backToTop": "返回顶部",
    "post.updated": "更新于：",
    "post.editPage": "编辑页面",
    
    // Pages
    "page.posts": "文章",
    "page.postsDesc": "所有发布的文章",
    "page.tags": "标签",
    "page.tagsDesc": "所有使用的标签",
    "page.tagPrefix": "标签：",
    "page.tagDesc": "包含「{tag}」标签的所有文章",
    "page.about": "关于",
    "page.pageNum": "第 {num} 页",
    
    // Footer
    "footer.copyright": "版权所有 © {year}",
    "footer.allRights": "保留所有权利",
    
    // 404 Page
    "error.pageNotFound": "页面未找到",
    "error.goHome": "返回首页",
    
    // Theme
    "theme.toggle": "切换明暗模式",
    
    // Language
    "lang.switch": "切换语言",
  },
  en: {
    // Navigation
    "nav.posts": "Posts",
    "nav.tags": "Tags",
    "nav.about": "About",
    "nav.archives": "Archives",
    "nav.search": "Search",
    "nav.skipToContent": "Skip to content",
    "nav.home": "Home",
    "nav.goBack": "Go back",
    "nav.searchDesc": "Search any article ...",
    "nav.archivesDesc": "All the articles I've archived.",

    // Months
    "month.1": "January",
    "month.2": "February",
    "month.3": "March",
    "month.4": "April",
    "month.5": "May",
    "month.6": "June",
    "month.7": "July",
    "month.8": "August",
    "month.9": "September",
    "month.10": "October",
    "month.11": "November",
    "month.12": "December",
    
    // Home page hero
    "hero.greeting": "Hello",
    "hero.description": "A minimal, responsive, accessible and SEO-friendly Astro blog theme. Light and dark mode supported with customizable color schemes.",
    "hero.cta": "Read the blog posts or check",
    "hero.socialLinks": "Social Links:",
    
    // Sections
    "section.featured": "Featured",
    "section.recentPosts": "Recent Posts",
    "button.allPosts": "All Posts",
    
    // Post details
    "post.previous": "Previous Post",
    "post.next": "Next Post",
    "post.shareOn": "Share this post on:",
    "post.backToTop": "Back To Top",
    "post.updated": "Updated:",
    "post.editPage": "Edit page",
    
    // Pages
    "page.posts": "Posts",
    "page.postsDesc": "All the articles I've posted.",
    "page.tags": "Tags",
    "page.tagsDesc": "All the tags used in posts.",
    "page.tagPrefix": "Tag:",
    "page.tagDesc": "All the articles with the tag \"{tag}\".",
    "page.about": "About",
    "page.pageNum": "page {num}",
    
    // Footer
    "footer.copyright": "Copyright © {year}",
    "footer.allRights": "All rights reserved.",
    
    // 404 Page
    "error.pageNotFound": "Page Not Found",
    "error.goHome": "Go back home",
    
    // Theme
    "theme.toggle": "Toggles light & dark",
    
    // Language
    "lang.switch": "Switch language",
  },
} as const;

export type TranslationKey = keyof typeof ui[typeof defaultLang];

export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    return ui[lang]?.[key] || ui[defaultLang][key];
  };
}

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang in languages) return lang as Lang;
  return defaultLang;
}

/**
 * Get the URL prefix for a language
 * Chinese (default) has no prefix, English has /en prefix
 */
export function getLangPrefix(lang: Lang): string {
  return lang === defaultLang ? "" : `/${lang}`;
}

/**
 * Get the alternate language path for the current URL
 * Handles switching between root (Chinese) and /en/ (English) paths
 */
export function getAlternatePath(currentPath: string, targetLang: Lang): string {
  const pathParts = currentPath.split("/").filter(p => p);
  
  // Remove current language prefix if present ("en" or legacy "zh")
  if (pathParts[0] === "en" || pathParts[0] === "zh") {
    pathParts.shift();
  }
  
  // Add target language prefix only if not default (Chinese)
  if (targetLang !== defaultLang) {
    pathParts.unshift(targetLang);
  }
  
  // Build the path - handle empty pathParts case (root)
  const pathString = pathParts.length > 0 ? pathParts.join("/") : "";
  const trailingSlash = currentPath.endsWith("/") || currentPath === "" || pathParts.length === 0 ? "/" : "";
  
  return "/" + pathString + (pathString && trailingSlash ? "/" : trailingSlash ? "" : "");
}
