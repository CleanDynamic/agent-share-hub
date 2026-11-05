// UX-09 Part 6: the nav marks OpenBuilds on a space, a topic and the old requests list, and each has its own trail.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { crumbHeading, trailFor } from "./breadcrumbTrail";
import { sectionForPath } from "./siteNav";
import { CrumbTitleProvider, useBreadcrumb, useCrumbTitle } from "./useBreadcrumb";

const OPENBUILDS = { label: "OpenBuilds", href: "/openbuilds" };

describe("UX-09 P6: OpenBuilds is the section", () => {
  it.each(["/openbuilds/spaces/claude-code", "/openbuilds/topics/p1", "/openbuilds/requests", "/openbuilds"])("%s is OpenBuilds", (path) => {
    expect(sectionForPath(path)).toBe("bounties");
  });
});

describe("UX-09 P6: the trails", () => {
  it("a space: OpenBuilds / <space name>", () => {
    expect(trailFor("/openbuilds/spaces/claude-code", "Claude Code")).toEqual([{ label: "Home", href: "/" }, OPENBUILDS, { label: "Claude Code" }]);
    // While the space loads, its crumb is the skeleton.
    expect(trailFor("/openbuilds/spaces/claude-code", null).at(-1)).toEqual({ label: null });
  });

  it("a topic in a space: OpenBuilds / <first space> / <heading>", () => {
    const space = { label: "Claude Code", href: "/openbuilds/spaces/claude-code" };
    expect(trailFor("/openbuilds/topics/p1", "Can anyone make the scorer faster?", space)).toEqual([{ label: "Home", href: "/" }, OPENBUILDS, space, { label: "Can anyone make the scorer faster?" }]);
  });

  it("a topic in no space: OpenBuilds / <heading>", () => {
    expect(trailFor("/openbuilds/topics/p1", "A topic")).toEqual([{ label: "Home", href: "/" }, OPENBUILDS, { label: "A topic" }]);
  });

  it("the old list: OpenBuilds / Older requests", () => {
    expect(trailFor("/openbuilds/requests", null)).toEqual([{ label: "Home", href: "/" }, OPENBUILDS, { label: "Older requests" }]);
  });

  it("a heading is cut to 40 characters", () => {
    const long = "Can anyone make the CV scorer run in under a second on a laptop?";
    expect(crumbHeading(long)).toHaveLength(40);
    expect(crumbHeading(long).endsWith("…")).toBe(true);
    expect(crumbHeading("Short heading")).toBe("Short heading");
  });

  it("a page names its parent crumb with its title", () => {
    function Topic() {
      useCrumbTitle("A topic", { label: "Claude Code", href: "/openbuilds/spaces/claude-code" });
      const trail = useBreadcrumb();
      return <p>{trail.map((crumb) => crumb.label).join(" / ")}</p>;
    }
    render(
      <MemoryRouter initialEntries={["/openbuilds/topics/p1"]}>
        <CrumbTitleProvider>
          <Topic />
        </CrumbTitleProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("Home / OpenBuilds / Claude Code / A topic")).toBeInTheDocument();
  });
});
