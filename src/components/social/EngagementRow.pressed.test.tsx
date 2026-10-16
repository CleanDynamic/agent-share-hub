// PT-02 — a pressed action sinks to the well: --well and a 1px --well-border, no opacity.
//
// The interaction hook is held in the pressed and hovered state, and the paint is read from static markup
// (src/test/tokenStyle.tsx), because jsdom drops token-valued styles.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(), auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));
const held = vi.hoisted(() => ({ hovered: false, pressed: false }));
vi.mock("@/lib/theme/interactive", () => ({
  useInteractive: () => ({
    state: { hovered: held.hovered, pressed: held.pressed, focusVisible: false },
    handlers: {},
  }),
}));

import { EngagementRow } from "@/components/social/EngagementRow";
import { staticDoc, styleOf } from "@/test/tokenStyle";

const BUILD = { id: "b1", slug: "inbox-triage", title: "Inbox triage agent", rebuild_count: 2 };

const like = () => {
  const client = new QueryClient();
  const doc = staticDoc(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <EngagementRow variant="page" build={BUILD} counts={{ likes: 24, comments: 5 }} liked={false} saved={false} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return styleOf(doc.querySelector('[data-engagement-action="like"]'));
};

describe("an action's states", () => {
  it("sinks to the well when pressed, with a 1px well border and no opacity", () => {
    held.pressed = true;
    held.hovered = false;
    const style = like();
    expect(style).toContain("background:var(--well)");
    expect(style).toContain("border:1px solid var(--well-border)");
    expect(style).not.toContain("opacity");
  });

  it("steps to --text on hover and changes nothing else", () => {
    held.pressed = false;
    held.hovered = true;
    const style = like();
    expect(style).toContain("color:var(--text)");
    expect(style).toContain("background:transparent");
    expect(style).not.toContain("opacity");
  });

  it("rests at --text2", () => {
    held.pressed = false;
    held.hovered = false;
    expect(like()).toContain("color:var(--text2)");
  });
});
