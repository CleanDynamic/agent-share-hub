// SV-01 Part 2. The print view of a post is HTML written into a window that
// shares the site's origin, so a post's own words must come out as text.

import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { payloadToHtml } from "./exportToFormat";

const payload = (title: string, text: string) =>
  ({
    meta: { title, subtitle: "<i>sub</i>", description: null },
    authorAttribution: { name: "<b>Maya</b>", handle: "maya", derivedBio: null },
    content: {
      prose: [{ type: "paragraph", text, data: null }],
      stages: [],
      results: [],
      references: [],
    },
  }) as never;

describe("SV-01 P2: payloadToHtml", () => {
  it("makes no element out of a post's own markup", () => {
    const html = payloadToHtml(payload("</title><script>alert(1)</script>", "# <img src=x onerror=alert(1)>\n<svg onload=alert(2)>"));
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("script, img, svg, b, i")).toBeNull();
    expect(doc.title).toContain("<script>alert(1)</script>");
    expect(doc.body.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(doc.body.textContent).toContain("<svg onload=alert(2)>");
  });
});
