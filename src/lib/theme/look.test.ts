import { describe, expect, it } from "vitest";
import { REFINED_LOOK_ENABLED, resolveLook } from "./look";

describe("the look switch (UI-P78)", () => {
  it("is on since UI-P98", () => {
    expect(REFINED_LOOK_ENABLED).toBe(true);
  });

  it("switch off: current, on any route", () => {
    expect(resolveLook("/", "", false)).toBe("current");
    expect(resolveLook("/dev/kit/pages/home", "", false)).toBe("current");
  });

  it("dev route with look=refined: refined, whatever the switch says", () => {
    expect(resolveLook("/dev/kit/pages/home", "?theme=dusk&look=refined", false)).toBe("refined");
    expect(resolveLook("/dev/kit/components", "?look=refined", true)).toBe("refined");
  });

  it("dev route with look=current: current, even with the switch on", () => {
    expect(resolveLook("/dev/kit/pages/home", "?look=current", true)).toBe("current");
  });

  it("dev route with a bad or missing look: the switch decides", () => {
    expect(resolveLook("/dev/kit", "?look=other", false)).toBe("current");
    expect(resolveLook("/dev/kit", "", true)).toBe("refined");
  });

  it("non-dev route: the switch decides and look= is ignored", () => {
    expect(resolveLook("/gallery", "?look=refined", false)).toBe("current");
    expect(resolveLook("/gallery", "?look=current", true)).toBe("refined");
    expect(resolveLook("/devices", "?look=refined", false)).toBe("current");
  });

  it("defaults to the real switch", () => {
    expect(resolveLook("/", "")).toBe(REFINED_LOOK_ENABLED ? "refined" : "current");
  });
});
