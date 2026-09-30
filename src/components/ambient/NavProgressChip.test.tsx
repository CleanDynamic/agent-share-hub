// RC-P28 — reputation is parked (src/lib/progress/flags.ts). The level chip's
// flyout drew a Reputation row whenever a score was passed; it now draws only
// while REPUTATION_ENABLED is true, so no mount brings the parked feature back
// by passing a number. The flag is read through a getter so one test can turn
// it on; every other test sees it as it ships, false.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ reputation: false }));
vi.mock("@/lib/progress/flags", () => ({
  GUILDS_ENABLED: false,
  LEADERBOARDS_ENABLED: false,
  get REPUTATION_ENABLED() {
    return flags.reputation;
  },
}));

import NavProgressChip from "./NavProgressChip";
import { parkedEntryPoints } from "@/test/parkedEntryPoints";

beforeEach(() => {
  flags.reputation = false;
});

const chip = () => render(<NavProgressChip level={3} xpIntoLevel={40} xpForLevel={100} totalXp={412} reputation={78} />);

describe("NavProgressChip while reputation is parked", () => {
  it("draws no Reputation row in the flyout, even when a score is passed", () => {
    const { container } = chip();

    expect(screen.getByRole("tooltip")).toHaveTextContent("Lifetime XP");
    expect(screen.queryByText("Reputation")).toBeNull();
    expect(screen.queryByText("78")).toBeNull();
    expect(parkedEntryPoints(container)).toEqual([]);
  });

  it("draws the row only once the flag is turned on", () => {
    flags.reputation = true;
    chip();

    expect(screen.getByText("Reputation")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
  });
});
