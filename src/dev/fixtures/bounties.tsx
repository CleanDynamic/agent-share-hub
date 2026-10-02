/* UI-P37 — the Bounties board's sample data, as `BountiesView` takes it (the board has no reference image yet, so this
   page is for looking at the four states and for the tier-1 spec to drive; it is registered as `bounty-board`).

   DEV ONLY. Nothing here reaches a production bundle. */

import { CoverFallback } from "@/components/brand/CoverFallback";
import type { DesignState } from "@/dev/useDesignTheme";
import type { BountiesViewProps, FrameView, SolverView } from "@/pages/site/bounties/BountiesView";

import { fixtures } from "../designFixtures";

const noop = () => undefined;

const REWARDS = [400, 250, 150, 120, 90, 60];
const PARTS = ["Duplicate detector", "Currency table", "Escalation rule", "Tone guide", "Eval set", "Retry policy"];

const frames = (): FrameView[] =>
  REWARDS.map((reward, i) => {
    const b = fixtures.builds[i % fixtures.builds.length];
    return {
      id: `sample-bounty-${i}`,
      title: b.title,
      part: PARTS[i],
      reward: `£${reward}`,
      solutions: (i * 3) % 5,
      meToo: 14 - i * 2,
      to: `/bounties/sample-bounty-${i}/solve`,
      cover: <CoverFallback seed={b.id} radius={0} sky={b.cover_sky} />,
      closesIn: i % 2 ? `${9 + i} days` : null,
      closes: "12 Oct",
      problem: "The model drops the second line item whenever two invoices share a purchase order.",
    };
  });

const solvers = (): SolverView[] => [
  { id: "s1", handle: "ines", solved: 9, avatarUrl: null },
  { id: "s2", handle: "ren", solved: 6, avatarUrl: null },
  { id: "s3", handle: "tomo", solved: 4, avatarUrl: null },
];

export function bountiesFixture(state: DesignState = "populated"): Omit<BountiesViewProps, "fit"> {
  const list = frames();
  const base: Omit<BountiesViewProps, "fit"> = {
    frames: { status: "ready", data: list },
    solvers: { status: "ready", data: solvers() },
    selectedId: list[0].id,
    onSelect: noop,
    sort: "newest",
    onSortChange: noop,
    meToo: { pressed: false, count: list[0].meToo, onToggle: noop },
    onNavigate: noop,
  };
  if (state === "loading") return { ...base, frames: { status: "loading" }, solvers: { status: "loading" }, meToo: undefined };
  if (state === "empty") return { ...base, frames: { status: "ready", data: [] }, solvers: { status: "ready", data: [] }, meToo: undefined };
  if (state === "error") {
    const failure = { onRetry: noop };
    return { ...base, frames: { status: "error", ...failure }, solvers: { status: "error", ...failure }, meToo: undefined };
  }
  return base;
}
