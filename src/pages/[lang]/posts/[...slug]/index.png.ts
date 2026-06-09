import { getCollection } from "astro:content";
import { getPostSlug } from "@/utils/getPostPaths";
import config from "@/config";

// Reuse the exact OG renderer from the root (zh) route; only the path set
// differs (English posts, under the /en/ tree).
export { GET } from "@/pages/posts/[...slug]/index.png";

export async function getStaticPaths() {
  if (!config.features.dynamicOgImage) {
    return [];
  }

  const posts = await getCollection("posts", ({ id }) =>
    id.startsWith("en/")
  ).then(p => p.filter(({ data }) => !data.draft && !data.ogImage));

  return posts.map(post => ({
    params: { lang: "en", slug: getPostSlug(post.id, post.filePath) },
    props: post,
  }));
}
