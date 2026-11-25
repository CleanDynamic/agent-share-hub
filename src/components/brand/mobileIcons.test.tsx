import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileIcon } from "./MobileIcon";
import { MOBILE_ICONS, type MobileIconName } from "./mobileIcons";

const names = Object.keys(MOBILE_ICONS) as MobileIconName[];

describe("the mobile icon set", () => {
  it("holds 81 icons (prompt 22 added Play and Pause for the replay)", () => {
    expect(names).toHaveLength(81);
  });

  it("has a filled version for Home, Builds, OpenBuilds, Activity, Like, Save and Search heavier", () => {
    for (const base of ["home", "builds", "ob", "bell", "heart", "save", "search"] as const) {
      expect(MOBILE_ICONS[`${base}f` as MobileIconName], `${base}f`).toBeTruthy();
    }
  });

  it.each(names)("renders %s as a 24 grid, hidden from assistive technology, in currentColor", (name) => {
    const { container, unmount } = render(<MobileIcon name={name} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.children.length).toBeGreaterThan(0);
    unmount();
  });

  it("takes a size and a stroke width", () => {
    const { container } = render(<MobileIcon name="home" size={20} strokeWidth={3} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("stroke-width")).toBe("3");
  });
});
