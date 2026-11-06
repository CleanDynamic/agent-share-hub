// UX-10 P7: the side column: the owner's order, hidden and empty sections, Works in from builds, the counts' drop-out, and the
// phone's one About row. The side column adds one request (get_profile_side), read as one jsonb.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

import { getProfileSide, toProfileSide } from "@/lib/profile/profileSide";
import { DEFAULT_SETTINGS } from "@/lib/profile/settings";

import { ProfileSide, sectionHasContent, type ProfileSideProps } from "./ProfileSide";
import { othersLines } from "./profileFeedModel";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => rpc.mockReset());

const props = (over: Partial<ProfileSideProps> = {}): ProfileSideProps => ({
  order: DEFAULT_SETTINGS.sideSections,
  about: "Agents a person can check.\nSecond line.",
  worksIn: ["Claude Code", "Opus 5.5"],
  spaces: [
    { slug: "evals", name: "Evals", standing: "Created" },
    { slug: "audio", name: "Audio", standing: "Member" },
  ],
  others: othersLines("maya", { rebuiltFrom: 6, firstRebuildSlug: "x", stepsAdded: 11, topicsStarted: 4 }),
  collections: [],
  marks: ["First build"],
  progress: null,
  ...over,
});

const mount = (over: Partial<ProfileSideProps> = {}) =>
  render(
    <MemoryRouter>
      <ProfileSide {...props(over)} />
    </MemoryRouter>,
  );

const titles = () => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);

describe("the side column", () => {
  it("draws its sections in the owner's order, each a module with its head", () => {
    mount({ order: [{ key: "marks", hidden: false }, { key: "spaces", hidden: false }, { key: "about", hidden: false }, { key: "others", hidden: false }, { key: "collections", hidden: false }] });
    expect(titles()).toEqual(["Marks", "In spaces", "About", "What others did with it"]);
  });

  it("leaves out a hidden section and an empty one", () => {
    mount({ order: [{ key: "about", hidden: true }, ...DEFAULT_SETTINGS.sideSections.slice(1)], spaces: [] });
    expect(titles()).toEqual(["What others did with it", "Marks"]);
    expect(sectionHasContent("collections", props())).toBe(false);
  });

  it("keeps the About's line breaks, and lists Works in from the builds", () => {
    mount();
    const about = screen.getByTestId("profile-side-about");
    expect(about.querySelector("p")?.style.whiteSpace).toBe("pre-wrap");
    expect(within(about).getByTestId("profile-works-in").textContent).toBe("Works inClaude Code · Opus 5.5");
  });

  it("gives each space its standing, and Show all after five", () => {
    const spaces = Array.from({ length: 7 }, (_, n) => ({ slug: `s${n}`, name: `Space ${n}`, standing: "Member" }));
    mount({ spaces });
    const module = screen.getByTestId("profile-side-spaces");
    expect(within(module).getAllByRole("listitem")).toHaveLength(5);
    fireEvent.click(within(module).getByRole("button", { name: "Show all" }));
    expect(within(module).getAllByRole("listitem")).toHaveLength(7);
    expect(within(module).getAllByRole("link")[0].getAttribute("href")).toBe("/openbuilds/spaces/s0");
  });

  it("What others did with it: three lines, each gone at zero", () => {
    expect(othersLines("maya", { rebuiltFrom: 6, firstRebuildSlug: "x", stepsAdded: 11, topicsStarted: 4 }).map((line) => line.text)).toEqual([
      "Rebuilt from here 6 times",
      "Steps added to 11 other drafts",
      "Started 4 topics",
    ]);
    expect(othersLines("maya", { rebuiltFrom: 0, firstRebuildSlug: null, stepsAdded: 1, topicsStarted: 0 }).map((line) => line.text)).toEqual(["Steps added to 1 other draft"]);
  });

  it("draws the marks as plain type chips, with no tiers", () => {
    mount();
    const marks = screen.getByTestId("profile-side-marks");
    expect(marks.querySelectorAll('[data-ui="type-chip"]')).toHaveLength(1);
    expect(marks.textContent).not.toMatch(/rare|highest|common/i);
  });

  it("has no Recent section", () => {
    mount();
    expect(screen.queryByRole("heading", { name: /recent/i })).toBeNull();
  });

  it("on a phone is one collapsed About row that opens in place", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: !query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }));
    mount();
    const row = screen.getByRole("button", { name: /About/ });
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("profile-side")).toBeNull();
    fireEvent.click(row);
    expect(row.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("profile-side")).toBeInTheDocument();
  });
});

describe("the side column's read", () => {
  it("is one request, and reads every count, the level and the spaces", async () => {
    rpc.mockResolvedValue({
      data: { builds: 14, topics: 22, replies: 9, notes: 5, reproduced_by_others: 9, rebuilt_from: 6, first_rebuild_slug: "x", steps_added: 11, topics_started: 4, level: 7, works_in: ["Claude Code"], spaces: [{ slug: "evals", name: "Evals", standing: "created" }] },
      error: null,
    });
    const side = await getProfileSide("maya");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_profile_side", { p_username: "maya" });
    expect(side).toMatchObject({ counts: { builds: 14, topics: 22, replies: 9, notes: 5 }, level: 7, worksIn: ["Claude Code"], spaces: [{ standing: "created" }] });
  });

  it("answers nothing for a private profile, and no level when the owner hides it", () => {
    expect(toProfileSide(null)).toBeNull();
    expect(toProfileSide({ builds: 1, level: null })?.level).toBeNull();
  });
});
