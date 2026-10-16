// PT-02 — the engagement row draws the site's own glyphs, never changes opacity, and adds Rebuild on request.
//
// The source is read as text for the two claims about what the file may contain; the markup is read through
// staticDoc because jsdom drops token-valued styles (src/test/tokenStyle.tsx).

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ createSignedUrl: vi.fn() }) },
  },
}));

import { GLYPHS } from "@/components/brand/glyphs";
import { EngagementRow } from "@/components/social/EngagementRow";
import { staticDoc, styleOf } from "@/test/tokenStyle";

const BUILD = { id: "b1", slug: "inbox-triage", title: "Inbox triage agent", rebuild_count: 2 };
const ENGAGEMENT = { counts: { likes: 24, comments: 5 }, liked: false, saved: false };

function providers(node: ReactElement): ReactElement {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{node}</MemoryRouter>
    </QueryClientProvider>
  );
}

const row = (props: Partial<Parameters<typeof EngagementRow>[0]> = {}) =>
  providers(<EngagementRow variant="page" build={BUILD} {...ENGAGEMENT} {...props} />);

/** The source with its comments taken out, so a claim about code is not tripped by prose. */
const code = readFileSync(resolve(process.cwd(), "src/components/social/EngagementRow.tsx"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("the engagement row's source", () => {
  it("imports nothing from lucide-react", () => {
    expect(code).not.toMatch(/lucide-react/);
  });

  it("sets no opacity anywhere, and names none in a transition", () => {
    expect(code).not.toMatch(/opacity/i);
  });
});

describe("the engagement row's glyphs", () => {
  it("draws heart, comment, save and share from the glyph table", () => {
    const doc = staticDoc(row());
    const paths = [...doc.querySelectorAll("[data-engagement-icon] path")].map((path) => path.getAttribute("d"));
    expect(paths).toEqual([GLYPHS.heart, GLYPHS.comment, GLYPHS.save, GLYPHS.share]);
  });

  it("sets no opacity and no opacity transition in any rendered style", () => {
    const doc = staticDoc(row({ withRebuild: true }));
    for (const element of doc.querySelectorAll("[style]")) expect(styleOf(element)).not.toMatch(/opacity/);
  });

  it("rests clear and sinks to the well when pressed", () => {
    const doc = staticDoc(row());
    const like = doc.querySelector('[data-engagement-action="like"]');
    expect(styleOf(like)).toContain("background:transparent");
    expect(styleOf(like)).toContain("border:1px solid transparent");
  });
});

describe("withRebuild", () => {
  it("adds a link to /rebuild/{slug} named with the count", () => {
    render(row({ withRebuild: true }));
    const link = screen.getByRole("link", { name: "Rebuild, 2 rebuilds" });
    expect(link).toHaveAttribute("href", "/rebuild/inbox-triage");
    expect(link.querySelector("path")).toHaveAttribute("d", GLYPHS.rebuild);
    expect(link).toHaveTextContent("2");
  });

  it("orders the row Comment, Rebuild, Like, Save, Share", () => {
    const doc = staticDoc(row({ withRebuild: true }));
    const order = [...doc.querySelectorAll("[data-engagement-action]")].map((el) => el.getAttribute("data-engagement-action"));
    expect(order).toEqual(["comment", "rebuild", "like", "save", "share"]);
  });

  it("says 1 rebuild in the singular", () => {
    render(row({ withRebuild: true, build: { ...BUILD, rebuild_count: 1 } }));
    expect(screen.getByRole("link", { name: "Rebuild, 1 rebuild" })).toBeInTheDocument();
  });

  it("without it the row is Like, Comment, Save, Share and has no link", () => {
    render(row());
    const actions = within(screen.getByTestId("engagement-row"));
    expect(actions.queryByRole("link")).toBeNull();
    expect(actions.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Like",
      "Comment",
      "Save",
      "Share",
    ]);
  });
});
