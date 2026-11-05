// UX-09 P10: the titles and descriptions SeoHead gives the OpenBuilds pages. Pure, so each is tested without a page.
//
// The site is named after this section, so /openbuilds is titled by the name alone. A space and a topic carry their own name or
// heading first.

import { splitBody } from "@/components/post/postCardModel";

export interface PageSeo {
  title: string;
  description: string;
}

/** How much of a topic's text its description carries. */
export const TOPIC_DESCRIPTION_MAX = 150;

export const OPENBUILDS_SEO: PageSeo = {
  title: "OpenBuilds",
  description: "Start a topic with anything, reply with anything. Spaces are made and run by the people in them.",
};

/** A space: `<name> · OpenBuilds`, with its own description. */
export function spaceSeo(space: { name: string; description: string } | null): PageSeo {
  return { title: `${space?.name ?? "Space"} · OpenBuilds`, description: space?.description || "A space on OpenBuilds." };
}

/** A topic: `<heading> · OpenBuilds`, with the first 150 characters of its text (the heading when it has none). */
export function topicSeo(topic: { body: string } | null): PageSeo {
  if (!topic) return { title: "Topic · OpenBuilds", description: "A topic on OpenBuilds." };
  const { heading, text } = splitBody(topic.body);
  return { title: `${heading || "Topic"} · OpenBuilds`, description: text.slice(0, TOPIC_DESCRIPTION_MAX) || heading || "A topic on OpenBuilds." };
}
