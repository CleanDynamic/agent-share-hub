// UX-14 P2. Every title is `<page> · OpenBuilds.ai`; the home page is the name alone; nothing doubles the suffix.

import { render, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it } from "vitest";
import { SeoHead } from "@/components/SeoHead";
import { shareTitle } from "@/lib/build/shareMeta";
import { OPENBUILDS_SEO, spaceSeo, topicSeo } from "@/pages/site/openbuilds/openBuildsSeo";
import { SITE_NAME } from "@/lib/site";

async function titleOf(title: string) {
  const { unmount } = render(
    <HelmetProvider>
      <SeoHead title={title} description="Words" path="/x" />
    </HelmetProvider>,
  );
  await waitFor(() => expect(document.title).not.toBe(""));
  const got = {
    title: document.title,
    og: document.head.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    site: document.head.querySelector('meta[property="og:site_name"]')?.getAttribute("content"),
  };
  unmount();
  return got;
}

describe("UX-14 P2 · SeoHead titles", () => {
  it("the home page is the name alone", async () => {
    const got = await titleOf(SITE_NAME);
    expect(got).toEqual({ title: "OpenBuilds.ai", og: "OpenBuilds.ai", site: "OpenBuilds.ai" });
  });

  it("a build is `<title> · OpenBuilds.ai`", async () => {
    expect((await titleOf(shareTitle("Inbox triage agent"))).title).toBe("Inbox triage agent · OpenBuilds.ai");
  });

  it("the OpenBuilds section's own page is `OpenBuilds · OpenBuilds.ai`, with the suffix once", async () => {
    expect((await titleOf(OPENBUILDS_SEO.title)).title).toBe("OpenBuilds · OpenBuilds.ai");
  });

  it("a space and a topic carry their own name first", async () => {
    expect((await titleOf(spaceSeo({ name: "Claude Code", description: "" }).title)).title).toBe("Claude Code · OpenBuilds.ai");
    expect((await titleOf(topicSeo({ body: "Faster scorer?\nMore" }).title)).title).toBe("Faster scorer? · OpenBuilds.ai");
  });

  it("a page that gives no suffix gets one, and a page that has it keeps one", async () => {
    expect((await titleOf("Messages")).title).toBe("Messages · OpenBuilds.ai");
    expect((await titleOf("Sign in · OpenBuilds.ai")).title).toBe("Sign in · OpenBuilds.ai");
  });
});

describe("UX-14 P2 · index.html", () => {
  const html = readFileSync("index.html", "utf8");
  const content = (sel: RegExp) => html.match(sel)?.[1];

  it("every title and site-name tag says OpenBuilds.ai", () => {
    const title = "OpenBuilds.ai: things people built with AI, and whether they still work";
    expect(content(/<title>([^<]*)<\/title>/)).toBe(title);
    expect(content(/property="og:title" content="([^"]*)"/)).toBe(title);
    expect(content(/name="twitter:title" content="([^"]*)"/)).toBe(title);
    expect(content(/property="og:site_name" content="([^"]*)"/)).toBe("OpenBuilds.ai");
  });

  it("the share descriptions are the page description", () => {
    const description = content(/name="description" content="([^"]*)"/);
    expect(description).toBeTruthy();
    expect(content(/property="og:description" content="([^"]*)"/)).toBe(description);
    expect(content(/name="twitter:description" content="([^"]*)"/)).toBe(description);
  });

  it("no tag carries the old names or the old description", () => {
    const tags = html.match(/<(title|meta)[^>]*>(?:[^<]*<\/title>)?/g)!.join("\n");
    expect(tags).not.toMatch(/buildgallery|neoscale|Download AI assistants|Tactics Forum/i);
  });
});
