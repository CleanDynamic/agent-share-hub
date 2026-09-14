// BG-P27 — onboarding's paint, asserted.
//
// WHY THIS FILE EXISTS SEPARATELY FROM authPaint.test.tsx. Both onboarding
// routes sit behind `ProtectedRoute`, so neither the tier-1 spec nor a manual
// pass can reach them without a seeded account, and this repository has none.
// That left the two pages verified by `npm run build` alone, which proves they
// compile and nothing else. Mocking the three things that gate them — the auth
// context, the approved-tools query and the Supabase client, none of which the
// PAINT depends on — is what makes the rendered surface assertable at all.
//
// Rendered through `staticDoc` for the same reason as the auth cards: jsdom's
// CSS parser stores nothing when a `var(--token)` is assigned, so no assertion
// that reads `element.style` can see a token. See src/test/tokenStyle.tsx.

import { describe, expect, it, vi } from "vitest";

import { staticDoc, styleOf } from "@/test/tokenStyle";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ update: () => ({ eq: async () => ({}) }) }) },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isLoggedIn: true,
    loading: false,
    user: { id: "u1", email: "ada@example.com", user_metadata: {} },
    profile: { id: "p1", username: "ada", display_name: "Ada", account_type: "user" },
    refreshProfile: async () => {},
  }),
}));

vi.mock("@/hooks/useApprovedTools", () => ({
  useApprovedToolNames: () => ({ data: ["Any Tool", "Claude", "Cursor"] }),
}));

vi.mock("@/components/SeoHead", () => ({ SeoHead: () => null }));

vi.mock("react-router-dom", () => ({ useNavigate: () => () => {} }));

const { default: Onboarding } = await import("./Onboarding");
const { default: OnboardingProfile } = await import("./OnboardingProfile");

/** The panel is the one element carrying the glass hairline. */
const panel = (doc: Document) =>
  [...doc.querySelectorAll("div")].find((div) =>
    styleOf(div).includes("var(--glass-border)"),
  );

describe("Onboarding", () => {
  const doc = () => staticDoc(<Onboarding />);

  it("takes the auth card's panel rather than shadcn's bg-card", () => {
    const style = styleOf(panel(doc()));
    expect(style).toContain("background:var(--glass)");
    expect(style).toContain("border-color:var(--glass-border)");
    expect(style).toContain("border-radius:var(--r-panel)");
    expect(style).toContain("box-shadow:var(--elev-raised)");
    expect(doc().body.innerHTML).not.toContain("bg-card");
  });

  it("says where the reader is in words, not in a coloured bar", () => {
    const html = doc().body.innerHTML;
    expect(html).toContain("Step 1 of 3");
    /* The bar was three `h-1.5 flex-1 rounded-full` segments, filled
       `bg-primary` and `bg-accent`. `bg-primary` alone is not the assertion to
       make — it is still in `ui/button.tsx`'s class list, where the kit's inline
       `--action` outranks it — so the bar is identified by its own two
       classes. */
    expect(html).not.toContain("h-1.5");
    expect(html).not.toContain("bg-accent");
  });

  it("paints the option tiles from tokens and drops transition-all", () => {
    const html = doc().body.innerHTML;
    const tile = [...doc().querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Research"),
    );
    const style = styleOf(tile);
    expect(style).toContain("background:var(--recess)");
    expect(style).toContain("border-color:var(--line)");
    expect(style).toContain("border-radius:var(--r-control)");
    // The theme forbids `all`; here it was animating padding and border-width
    // alongside the colour.
    expect(html).not.toContain("transition-all");
    expect(tile?.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("OnboardingProfile", () => {
  const doc = () => staticDoc(<OnboardingProfile />);

  it("takes the same panel, so the two steps are one room", () => {
    const style = styleOf(panel(doc()));
    expect(style).toContain("background:var(--glass)");
    expect(style).toContain("border-radius:var(--r-panel)");
    expect(doc().body.innerHTML).not.toContain("bg-card");
  });

  it("keeps no Tailwind green or shadcn red for the username's verdict", () => {
    const html = doc().body.innerHTML;
    expect(html).not.toContain("text-green-500");
    expect(html).not.toContain("text-destructive");
  });
});
