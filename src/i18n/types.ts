export interface UIStrings {
  nav: {
    home: string;
    posts: string;
    tags: string;
    about: string;
    archives: string;
    gallery: string;
    search: string;
  };
  post: {
    publishedAt: string;
    updatedAt: string;
    sharePostIntro: string;
    sharePostOn: string;
    sharePostViaEmail: string;
    backToTop: string;
    goBack: string;
    editPage: string;
    previousPost: string;
    nextPost: string;
    toc: string;
    copyCode: string;
    codeCopied: string;
    copyFailed: string;
    /** Placeholder: {{n}} (minutes) */
    readingTime: string;
    relatedPosts: string;
    copyLink: string;
    shareLink: string;
    linkCopied: string;
    copyLinkFailed: string;
  };
  pagination: {
    prev: string;
    next: string;
    /** Placeholder: {{n}} (the page number) */
    pageN: string;
    /** Document title of page 2 onwards of a list. Placeholders: {{title}}, {{n}} */
    pagedTitle: string;
  };
  home: {
    socialLinks: string;
    featured: string;
    recentPosts: string;
    allPosts: string;
  };
  footer: {
    copyright: string;
    allRightsReserved: string;
  };
  pages: {
    /** Placeholder: {{tag}} */
    tagTitle: string;
    /** Placeholders: {{count}}, {{tag}} */
    tagDesc: string;
    /** `tagDesc` when the tag has exactly one post. Placeholders: {{count}}, {{tag}} */
    tagDescOne: string;

    tagsTitle: string;
    tagsDesc: string;

    postsTitle: string;
    postsDesc: string;

    archivesTitle: string;
    archivesDesc: string;

    galleryTitle: string;
    galleryDesc: string;
    galleryEmpty: string;

    searchTitle: string;
    searchDesc: string;
    searchAiTitle: string;
    searchAiLoading: string;
    searchAiNote: string;
  };
  gallery: {
    albumsNav: string;
    filter: string;
    clear: string;
    camera: string;
    lens: string;
    focal: string;
    unknown: string;
    /** Placeholders: {{photos}}, {{albums}} */
    summaryAll: string;
    /** `summaryAll` when there is exactly one album. Placeholders: {{photos}}, {{albums}} */
    summaryAllOneAlbum: string;
    /** Placeholders: {{shown}}, {{total}} */
    summaryFiltered: string;
    /** Placeholder: {{summary}} (the summary text that follows the notice) */
    filtersReset: string;
    noMatch: string;
    focalUltraWide: string;
    focalWide: string;
    focalStandard: string;
    focalShortTele: string;
    focalTele: string;
    focalSuperTele: string;
  };
  a11y: {
    skipToContent: string;
    openMenu: string;
    closeMenu: string;
    toggleTheme: string;
    goToPreviousPage: string;
    goToNextPage: string;
    lightboxClose: string;
    lightboxZoom: string;
    lightboxPrev: string;
    lightboxNext: string;
    lightboxError: string;
    lightboxVideoError: string;
    playVideo: string;
    openToc: string;
    closeToc: string;
    /** Placeholder: {{heading}} (the heading's text) */
    headingAnchor: string;
    zoomImage: string;
    /** `zoomImage` for an image with alt text. Placeholder: {{alt}} */
    zoomImageAlt: string;
    rssFeed: string;
    /** Accessible name of the theme button; its state is `aria-pressed`. */
    darkMode: string;
    pagination: string;
    breadcrumb: string;
    /** Screen-reader unit for a bare post-count superscript. Placeholder: {{count}} */
    postCount: string;
    /** `postCount` when the count is exactly one. Placeholder: {{count}} */
    postCountOne: string;
  };
  notFound: {
    title: string;
    message: string;
    goHome: string;
    searchPosts: string;
    allPosts: string;
  };
  search: {
    /** Pagefind UI's own strings, handed to it verbatim (see below). */
    pagefind: PagefindTranslations;
    /** `astro dev` only: why there are no results. Followed by the build command. */
    devHint: string;
  };
}

/**
 * The `translations` option of Pagefind UI (@pagefind/default-ui 1.5): its
 * snake_case keys, and its own placeholders — `[SEARCH_TERM]`, `[COUNT]`,
 * `[DIFFERENT_TERM]` — rather than `{{…}}`, since Pagefind fills them in.
 * Only the first occurrence of each placeholder is replaced.
 */
export interface PagefindTranslations {
  placeholder: string;
  clear_search: string;
  load_more: string;
  search_label: string;
  filters_label: string;
  zero_results: string;
  many_results: string;
  one_result: string;
  total_zero_results: string;
  total_one_result: string;
  total_many_results: string;
  alt_search: string;
  search_suggestion: string;
  searching: string;
  results_label: string;
  keyboard_navigate: string;
  keyboard_select: string;
  keyboard_clear: string;
  keyboard_close: string;
  keyboard_search: string;
  error_search: string;
  filter_selected_one: string;
  filter_selected_many: string;
  input_hint: string;
  loading: string;
}
