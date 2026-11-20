import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://astropages-bilingual.pages.dev/",
    title: "AstroPaper Bilingual",
    description: "A bilingual blog based on Astro Paper",
    author: "tosaki",
    profile: "https://t0saki.com",
    ogImage: "astropaper-og.jpg",
    // Default locale of the bilingual site (Chinese at root, English at /en/).
    // Used as the html lang fallback when Astro.currentLocale is undefined.
    lang: "zh",
    timezone: "Asia/Singapore",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
  },
  features: {
    lightAndDarkMode: true,
    // Dynamic per-post OG images (satori + sharp). Works in the pure-static
    // Node build. Latin text uses the Google Sans Code webfont; anything
    // outside it (CJK, Cyrillic, …) is drawn with a fallback family fetched at
    // build time — see src/utils/getOgFonts.ts.
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/t0saki/AstroPages-Bilingual/edit/main/",
    },
    search: "pagefind",
    // Semantic results from Cloudflare AI Search above the Pagefind ones. Off
    // unless an endpoint is set here or via PUBLIC_AI_SEARCH_URL; Pagefind
    // stays the fallback. Setup steps are in the README.
    // aiSearch: { endpoint: "https://<id>.search.ai.cloudflare.com" },
    gallery: {
      enabled: true,
      imageDomains: ["upload.wikimedia.org"],
    },
    // Table of contents for posts with at least `minHeadings` h2–h{maxDepth}
    // headings: a side rail on wide screens, a floating button + sheet below.
    // Per post, `toc: false` hides it and `toc: true` forces it.
    toc: { enabled: true, minHeadings: 3, maxDepth: 3 },
    // "约 5 分钟" / "5 min read" after the date on cards and post headers.
    readingTime: true,
    // Up to three posts sharing the most tags, at the end of each post.
    relatedPosts: true,
  },
  socials: [
    { name: "github", url: "https://github.com/t0saki/AstroPages-Bilingual" },
    { name: "x", url: "https://x.com/username" },
    { name: "linkedin", url: "https://www.linkedin.com/in/username/" },
    { name: "mail", url: "mailto:yourmail@gmail.com" },
  ],
  // `{url}` and `{title}` in a share URL are replaced by the post's URL and
  // title (URL-encoded); a URL without either gets the post URL appended.
  // A "copy link" button (the system share sheet where there is one) always
  // comes first.
  shareLinks: [
    {
      name: "weibo",
      url: "https://service.weibo.com/share/share.php?url=",
      iconStyle: "solid",
    },
    {
      name: "qq",
      url: "https://connect.qq.com/widget/shareqq/index.html?url=",
      iconStyle: "solid",
    },
    {
      name: "qzone",
      url: "https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=",
      iconStyle: "solid",
    },
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url={url}&text={title}" },
    { name: "telegram", url: "https://t.me/share/url?url={url}&text={title}" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail", url: "mailto:?subject={title}&body={url}" },
  ],
});
