// 29c: a dock tab remembers where it was scrolled to; only the tab's root page counts.
import { beforeEach, describe, expect, it } from "vitest";

import { dockSectionOf, forgetDockScroll, readDockScroll, saveDockScroll } from "./dockScroll";

beforeEach(forgetDockScroll);

describe("dock scroll", () => {
  it("names the five dock tabs by their root page, and no other page", () => {
    expect(dockSectionOf("/")).toBe("home");
    expect(dockSectionOf("/builds")).toBe("builds");
    expect(dockSectionOf("/import")).toBe("import");
    expect(dockSectionOf("/openbuilds")).toBe("openbuilds");
    expect(dockSectionOf("/notifications")).toBe("activity");
    expect(dockSectionOf("/b/some-build")).toBeNull();
    expect(dockSectionOf("/openbuilds/post/1")).toBeNull();
  });

  it("keeps a position per tab and nothing for a tab not left yet", () => {
    saveDockScroll("builds", 812.4);
    saveDockScroll("home", 40);
    expect(readDockScroll("builds")).toBe(812);
    expect(readDockScroll("home")).toBe(40);
    expect(readDockScroll("activity")).toBeNull();
  });
});
