import type { APIRoute } from "astro";

export const prerender = true;

import { getCollection, type CollectionEntry } from "astro:content";
import { getPath } from "@/utils/getPath";
import { generateOgImageForPost } from "@/utils/generateOgImages";
import { SITE } from "@/config";

export async function getStaticPaths() {
  if (!SITE.dynamicOgImage) {
    return [];
  }

  // Filter for Chinese posts only
  const posts = await getCollection("blog").then(p =>
    p.filter(({ data, id }) => !data.draft && !data.ogImage && id.startsWith("zh/"))
  );

  return posts.map(post => ({
    params: {
      slug: getPath(post.id, post.filePath, false),
    },
    props: post,
  }));
}

export const GET: APIRoute = async ({ props }) => {
  if (!SITE.dynamicOgImage) {
    return new Response(null, {
      status: 404,
      statusText: "Not found",
    });
  }

  const buffer = await generateOgImageForPost(props as CollectionEntry<"blog">);
  return new Response(new Uint8Array(buffer), {
    headers: { "Content-Type": "image/png" },
  });
};
