// UX-13 P4. The canonical and og:url name openbuilds.ai whichever address the page is read on.

import { render, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it } from "vitest";
import { SeoHead } from "@/components/SeoHead";

const head = () => ({
  canonicals: [...document.head.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute("href")),
  ogUrl: document.head.querySelector('meta[property="og:url"]')?.getAttribute("content"),
});

describe("UX-13 P4 · SeoHead", () => {
  it.each(["/", "/b2/inbox-triage", "/openbuilds/spaces/agents"])("canonicalises %s to openbuilds.ai", async (path) => {
    // jsdom's own address is http://localhost:3000, standing in for the Lovable address or a preview.
    const { unmount } = render(
      <HelmetProvider>
        <SeoHead title="A page" description="Words" path={path} />
      </HelmetProvider>,
    );
    const want = `https://openbuilds.ai${path}`;
    await waitFor(() => expect(head().canonicals).toEqual([want]));
    expect(head().ogUrl).toBe(want);
    unmount();
  });
});
