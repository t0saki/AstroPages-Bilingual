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
    scheduledPostMargin: 15 * 60 * 1000,
  },
  features: {
    lightAndDarkMode: true,
    // Dynamic per-post OG images (satori + sharp). Works in the pure-static
    // Node build. Latin titles render fully; CJK titles fall back to the
    // satori font set (see og.png.ts) — same behaviour as before the rebase.
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: {
      enabled: true,
      url: "https://github.com/t0saki/AstroPages-Bilingual/edit/main/",
    },
    search: "pagefind",
    gallery: {
      enabled: true,
      imageDomains: ["upload.wikimedia.org"],
    },
  },
  socials: [
    { name: "github", url: "https://github.com/t0saki/AstroPages-Bilingual" },
    { name: "x", url: "https://x.com/username" },
    { name: "linkedin", url: "https://www.linkedin.com/in/username/" },
    { name: "mail", url: "mailto:yourmail@gmail.com" },
  ],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x", url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail", url: "mailto:?subject=See%20this%20post&body=" },
  ],
});
