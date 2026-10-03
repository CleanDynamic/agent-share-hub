import { describe, expect, it, vi } from "vitest";

/* UI-P40 — the frame's chrome is memoised and takes no props, so a page's data
   changing (which re-renders the frame around it) never re-renders the chrome. */

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { Breadcrumb } from "./Breadcrumb";
import { Dock } from "./Dock";
import { MobileHeader } from "./MobileHeader";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

describe("the frame's chrome", () => {
  it.each([
    ["SiteHeader", SiteHeader],
    ["MobileHeader", MobileHeader],
    ["Breadcrumb", Breadcrumb],
    ["SiteFooter", SiteFooter],
    ["Dock", Dock],
  ])("%s is memoised", (_, component) => {
    expect((component as unknown as { $$typeof: symbol }).$$typeof).toBe(Symbol.for("react.memo"));
  });
});
