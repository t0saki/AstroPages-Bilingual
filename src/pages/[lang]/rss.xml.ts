import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";

export function getStaticPaths() {
  return [{ params: { lang: "en" } }];
}

export async function GET() {
  const posts = await getCollection("posts", ({ id }) => id.startsWith("en/"));
  const sortedPosts = getSortedPosts(posts);

  return rss({
    title: config.site.title,
    description: config.site.description,
    site: config.site.url,
    items: sortedPosts.map(({ data, id, filePath }) => ({
      link: getPostUrl(id, filePath, "en"),
      title: data.title,
      description: data.description,
      pubDate: new Date(data.modDatetime ?? data.pubDatetime),
    })),
  });
}
