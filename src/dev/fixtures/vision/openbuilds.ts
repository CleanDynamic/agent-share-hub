/* SV-14: the OpenBuilds vision board's sample data, as `OpenBuildsView` takes it.

   Copied from `design/reference/vision/dusk/openbuilds.html` and the release check's bars from the `<script
   type="text/x-dc">` block of `design/reference/vision/source/OpenWork.dc.html` (the same seeded heights). DEV ONLY (the
   dev page `vision-openbuilds` and the view's tests). Every name, number and sentence is sample content. */

import type { DesignState } from "@/dev/useDesignTheme";
import type { OpenBuildsViewProps, ReleaseCheckProps, RequestItem } from "@/pages/site/openbuilds/OpenBuildsView";
import { OPEN_BUILDS_SORTS, OPEN_BUILDS_TABS } from "@/pages/site/openbuilds/openBuildsModel";

const noop = () => undefined;

/** The board's 120 bars: 94 work, 11 fail, 15 not tested, at the source's seeded heights. */
function releaseBars(): ReleaseCheckProps["bars"] {
  const bars: { state: "works" | "fails" | "untested"; height: number }[] = [];
  let seed = 7;
  for (let i = 0; i < 120; i += 1) {
    seed = (seed * 9301 + 49297) % 233280;
    let height = 40 + Math.round((seed / 233280) * 60);
    if (i >= 94 && i < 105) height = 30 + (i % 3) * 8;
    if (i >= 105) height = 22;
    bars.push({ state: i < 94 ? "works" : i < 105 ? "fails" : "untested", height });
  }
  return bars;
}

export const visionOpenBuildsRequests: RequestItem[] = [
  {
    kind: "step",
    id: "r1",
    title: "Step 4 · Fetch from paywalled sources",
    reward: { text: "£40" },
    meta: ["Research brief agent", "@mira", "opened from a failed run", "6h"],
    problem: "Stops on the first paywalled result. A fallback to cached copies fails because the cache is empty for most sources.",
    strip: [
      { id: "t1", number: "1", kind: "Prompt", title: "Take the question", open: false },
      { id: "t2", number: "2", kind: "Prompt", title: "Search plan", open: false },
      { id: "t3", number: "3", kind: "Agent", title: "Fetch sources", open: false },
      { id: "t4", number: "4", kind: "Code", title: "Paywalled sources", open: true },
      { id: "t5", number: "5", kind: "Prompt", title: "Write the brief", open: false },
    ],
    facts: [
      { parts: [{ text: "Claimed by " }, { text: "@kit", tone: "text" }, { text: " · 2 days left" }] },
      { parts: [{ text: "3 failed runs on gpt-5" }] },
      { parts: [{ text: "1 answer" }] },
      { meToo: true },
      { parts: [{ text: "6 comments" }] },
    ],
    meToo: { count: 4, pressed: false, onToggle: noop },
    action: { label: "Answer", to: "#" },
  },
  {
    kind: "session",
    id: "r2",
    title: "Part A · Session 3 · Deploy the worker to Vercel",
    reward: { text: "No reward", muted: true },
    meta: ["Invoice chaser", "@suntzu", "1d"],
    sessions: [
      { key: "s1", label: "Session 1", detail: "4 prompts" },
      { key: "s2", label: "Session 2", detail: "7 prompts" },
      { key: "s3", label: "Session 3", detail: "Open", open: true },
    ],
    facts: [{ parts: [{ text: "Unclaimed" }] }, { parts: [{ text: "An offered session copies prompt text, model and source only" }] }],
    action: { label: "Offer a session", to: "#" },
  },
  {
    kind: "brief",
    id: "r3",
    title: "Book a dentist appointment from an email thread",
    reward: { text: "Any model", muted: true },
    meta: ["@dax", "4 open steps", "4d"],
    answersLine: "6 answers · 2 reproduced",
    compareTo: "#",
    answers: [
      { id: "a1", userId: "u-maya", handle: "@maya", detail: "6 steps · Opus 5.5", runs: 4, lit: true, hue: 0 },
      { id: "a2", userId: "u-kit", handle: "@kit", detail: "3 steps · GPT-5", runs: 1, lit: true, hue: 1 },
      { id: "a3", userId: "u-jay", handle: "@jay", detail: "9 steps · Sonnet 4.5", runs: 0, lit: false, hue: 2 },
    ],
    facts: [{ meToo: true }],
    meToo: { count: 9, pressed: false, onToggle: noop },
    action: { label: "Answer this brief", to: "#" },
  },
  {
    kind: "model-test",
    id: "r4",
    title: "Reproduce Call notes on Opus 5.5",
    meta: ["Call notes that write themselves", "@maya", "2d"],
    models: [
      { model: "Opus 5.5", state: "untested" },
      { model: "Sonnet 4.5", state: "worked", runs: 6, worked: 6 },
      { model: "GPT-5", state: "failed", runs: 3, worked: 1 },
    ],
    action: { label: "Reproduce on Opus 5.5", to: "#" },
  },
  {
    kind: "review",
    id: "r5",
    title: "Weekly report from Linear",
    meta: ["@luke", "held out of Builds until the review ends", "8h"],
    facts: [
      { parts: [{ text: "3 runs · " }, { text: "1 failed", tone: "breakage" }] },
      { parts: [{ text: "4 step comments" }] },
      { parts: [{ text: "1 step request opened from it" }] },
    ],
    action: { label: "Reproduce to review", to: "#" },
  },
];

export function visionOpenBuildsProps(state: DesignState = "populated"): OpenBuildsViewProps {
  const status = state === "loading" ? "loading" : state === "error" ? "error" : "ready";
  const items = state === "empty" ? [] : visionOpenBuildsRequests;
  return {
    release: {
      model: "Opus 5.5",
      works: 94,
      total: 120,
      fails: 11,
      untested: 15,
      released: "released 3 days ago",
      bars: releaseBars(),
      to: "#",
      runTo: "#",
    },
    requests: {
      tabs: OPEN_BUILDS_TABS,
      tab: "all",
      onTab: noop,
      sorts: OPEN_BUILDS_SORTS,
      sort: "needed",
      onSort: noop,
      status,
      onRetry: noop,
      items,
    },
    yourRequests: {
      status,
      onRetry: noop,
      meta: "2 answers to review",
      to: "#",
      rows: [
        { id: "y1", label: "Invoice chaser · Session 3", detail: "@dax", to: "#" },
        { id: "y2", label: "gbngd · Step 2", detail: "@kit · 3 steps", to: "#" },
      ],
    },
    yourClaims: {
      status,
      onRetry: noop,
      meta: "Expire after 3 days without a change",
      to: "#",
      rows: [{ id: "c1", label: "Pitch deck · Part B", detail: "2 days left", to: "#" }],
    },
    record: {
      status,
      onRetry: noop,
      meta: "From runs and accepted contributions",
      to: "#",
      rows: [
        { label: "Builds reproduced", value: "40" },
        { label: "Answers accepted", value: "6", detail: "4 confirmed" },
        { label: "Builds contributed to", value: "3" },
        { label: "Builds maintained", value: "1" },
      ],
    },
    groups: {
      status,
      onRetry: noop,
      meta: "From the field and tools of your builds",
      to: "#",
      rows: [
        { id: "g1", label: "Sales automation · Claude Code", detail: "12 open", to: "#" },
        { id: "g2", label: "Research agents", detail: "5 open", to: "#" },
      ],
    },
    contributors: {
      status,
      onRetry: noop,
      meta: "Accepted answers, last 30 days",
      to: "#",
      rows: [
        { id: "u-kit", handle: "@kit", count: 9, to: "#", hue: 3 },
        { id: "u-dax", handle: "@dax", count: 5, to: "#", hue: 1 },
        { id: "u-mira", handle: "@mira", count: 3, to: "#", hue: 4 },
      ],
    },
    week: { percent: 60, closed: 18, goal: 30 },
  };
}
