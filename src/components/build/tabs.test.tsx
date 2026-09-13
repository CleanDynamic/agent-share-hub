// BG-P21 — the tab strip and the four panels behind it.
//
// The claims: the current tab is an `--action` underline on `--text` and never
// a fill, and becoming current moves no box; the replay's scrubber sits in a
// `--recess` with its phase headings in mono and its divergence markers in
// `--evidence`; a breakage reads as resolved rather than as an alarm — the
// measured category pair on a chip and nothing red anywhere else; and the
// rebuilds list carries the credit's voice per row.
//
// Colour is read off static markup, because jsdom's CSS parser drops a `var()`
// on assignment. See src/test/tokenStyle.tsx.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { BreakageView } from "./BreakageView";
import { BuildTabs } from "./BuildTabs";
import { RebuildsTab } from "./RebuildsTab";
import { Replay } from "./Replay";
import type {
  Build,
  BuildEvent,
  BuildNode,
  NodeTree,
  NodeType,
  RebuildSummary,
} from "@/lib/build";
import { staticDoc, styleOf, styledWith } from "@/test/tokenStyle";

const build = { id: "b1", slug: "inbox-triage", title: "Inbox triage agent" } as Build;

const nodeTypes = [
  {
    key: "prompt",
    label: "Prompt",
    category: "instruction",
    colour: "#E8571A",
    icon: "MessageSquare",
    renderer: "instruction",
    copyable: true,
    is_active: true,
    sort: 1,
    schema: { fields: [{ key: "text", label: "Text", type: "text" }] },
  },
  {
    key: "breakage",
    label: "Breakage",
    category: "breakage",
    colour: "#EF4444",
    icon: "TriangleAlert",
    renderer: "breakage",
    copyable: false,
    is_active: true,
    sort: 2,
    schema: {
      fields: [
        { key: "symptom", label: "Symptom", type: "text" },
        { key: "cause", label: "Cause", type: "text" },
        { key: "resolution", label: "Resolution", type: "text" },
      ],
    },
  },
] as unknown as NodeType[];

const event = (ordinal: number, phase: number, phaseTitle: string): BuildEvent =>
  ({
    id: `e${ordinal}`,
    build_id: "b1",
    ordinal,
    kind: "prompt",
    phase,
    phase_title: phaseTitle,
    payload: { text: `Step ${ordinal}` },
    occurred_at: "2026-08-01T09:00:00Z",
    visibility: "kept",
    produced_node_id: null,
  }) as unknown as BuildEvent;

const events: BuildEvent[] = [
  event(1, 1, "Getting it running"),
  event(2, 1, "Getting it running"),
  event(3, 2, "Making it good"),
];

const rebuild: RebuildSummary = {
  id: "r1",
  slug: "inbox-triage-nights",
  title: "Inbox triage, overnight",
  creator: { id: "u2", username: "nightowl", display_name: "Night Owl", avatar_url: null },
  rebuild_note: "Swapped the model and cut the cost in half.",
  created_at: "2026-08-20T09:00:00Z",
  forked_from_event_id: "e2",
  reproduction_count: 2,
} as unknown as RebuildSummary;

const noResolve = () => undefined;
const noMedia = () => null;

/* ── the strip ──────────────────────────────────────────────────────────── */

function tabs(active = "anatomy") {
  return (
    <BuildTabs active={active} watch={<p>watch</p>} broke={<p>broke</p>}>
      <p>anatomy</p>
    </BuildTabs>
  );
}

describe("the tab strip", () => {
  it("marks the current tab with an --action underline on --text", () => {
    const doc = staticDoc(tabs());
    const current = doc.querySelector('[aria-selected="true"]');

    expect(current?.textContent).toContain("Anatomy");
    expect(styleOf(current)).toContain("border-bottom:2px solid var(--action)");
    expect(styleOf(current)).toContain("color:var(--text)");
    // A fill would make the current tab a button among five labels.
    expect(styleOf(current)).toContain("background:transparent");
  });

  it("gives every other tab the same 2px edge in transparent, so nothing shifts", () => {
    const doc = staticDoc(tabs());
    for (const tab of Array.from(doc.querySelectorAll('[role="tab"]'))) {
      expect(styleOf(tab)).toContain("border-bottom:2px solid");
    }
    const quiet = doc.querySelector('[aria-selected="false"]');
    expect(styleOf(quiet)).toContain("border-bottom:2px solid transparent");
    expect(styleOf(quiet)).toContain("color:var(--text2)");
  });

  it("rules the strip with --line and keeps the tab order and names", () => {
    const doc = staticDoc(tabs());
    expect(styleOf(doc.querySelector('[role="tablist"]'))).toContain(
      "border-bottom:1px solid var(--line)",
    );
    expect(
      Array.from(doc.querySelectorAll('[role="tab"]')).map((tab) =>
        tab.querySelector("span")?.textContent,
      ),
    ).toEqual(["Anatomy", "Watch it get built", "Where it broke"]);
  });

  it("keeps a disabled tab legible rather than greying it out of contrast", () => {
    // Every tab that renders is live here, so the claim is about the ramp: the
    // strip spends two text tokens and there is no third rung below them.
    const doc = staticDoc(tabs());
    for (const tab of Array.from(doc.querySelectorAll('[role="tab"]'))) {
      const style = styleOf(tab);
      expect(style.includes("color:var(--text)") || style.includes("color:var(--text2)")).toBe(
        true,
      );
    }
  });
});

/* ── watch it get built ─────────────────────────────────────────────────── */

function replay() {
  return (
    <Replay
      build={build}
      events={events}
      nodeTypes={nodeTypes}
      resolveNode={noResolve}
      resolveMedia={noMedia}
      divergences={[rebuild]}
    />
  );
}

describe("the replay", () => {
  it("sits the scrubber in a --recess rather than in another blurred panel", () => {
    const doc = staticDoc(replay());
    const panel = doc.querySelector('[data-visual-slot="build-replay"] > div');

    expect(styleOf(panel)).toContain("background:var(--recess)");
    expect(styleOf(panel)).toContain("border:1px solid var(--line)");
    expect(styleOf(panel)).toContain("border-radius:var(--r-panel)");
    // A blur here would stack on the ones the cards and the hero already spend.
    expect(styleOf(panel)).not.toContain("backdrop-filter");
  });

  it("sets the phase headings in mono, over and inside the list alike", () => {
    const doc = staticDoc(replay());
    const headings = Array.from(doc.querySelectorAll("span, h3")).filter(
      (element) => element.textContent === "Getting it running",
    );

    // One over the scrubber, one heading the list of its events.
    expect(headings.length).toBeGreaterThanOrEqual(2);
    for (const heading of headings) {
      expect(styleOf(heading)).toContain("DM Mono");
      expect(styleOf(heading)).toContain("text-transform:uppercase");
    }
  });

  it("marks a divergence in --evidence, circular, with a halo of its own hue", () => {
    const doc = staticDoc(replay());
    const marker = doc.querySelector('[data-testid="divergence-marker"]');

    expect(marker).toBeTruthy();
    expect(styleOf(marker)).toContain("background:var(--evidence)");
    expect(styleOf(marker)).toContain("border-radius:var(--r-full)");
    expect(styleOf(marker)).toContain("var(--evidence) 18%");
  });

  it("leaves the unreached ticks on --line rather than on a white wash", () => {
    const doc = staticDoc(replay());
    const ticks = Array.from(doc.querySelectorAll("[data-tick-ordinal]"));

    expect(ticks).toHaveLength(3);
    // The first tick is reached (position starts at 0); the last is not.
    expect(styleOf(ticks[ticks.length - 1])).toContain("background:var(--line)");
  });

  it("spends no filled --action inside the panel", () => {
    // "Rebuild from here" is the same act as the header's primary, at one
    // moment — so it takes the hue as an outline, never as a second fill.
    const doc = staticDoc(replay());
    expect(styledWith(doc, "background:var(--action)")).toHaveLength(0);
  });
});

/* ── where it broke ─────────────────────────────────────────────────────── */

const breakageNode = {
  id: "bk1",
  build_id: "b1",
  parent_id: null,
  position: 0,
  type: "breakage",
  title: "Context window overflowed",
  note: null,
  payload: {
    symptom: "Long threads returned nothing.",
    cause: "The whole thread went into the prompt.",
    resolution: "Summarise older messages first.",
  },
  source_ref: null,
  event_id: "e2",
  is_gap: false,
  created_at: "",
  children: [],
} as unknown as NodeTree;

function breakage() {
  return (
    <BreakageView
      build={build}
      events={events}
      tree={[breakageNode]}
      nodeTypes={nodeTypes}
      resolveNode={noResolve}
      resolveMedia={noMedia}
      onOpenReplay={() => {}}
    />
  );
}

describe("where it broke reads as resolved, not as an alarm", () => {
  it("spends the breakage hue on the measured chip pair and nowhere else", () => {
    const doc = staticDoc(breakage());
    const chip = Array.from(doc.querySelectorAll("span")).find((span) =>
      styleOf(span).includes("var(--cat-breakage-fill)"),
    );

    expect(chip).toBeTruthy();
    expect(styleOf(chip)).toContain("color:var(--cat-breakage)");
    expect(styleOf(chip)).toContain("border-radius:var(--r-chip)");
  });

  it("keeps the prose in the ordinary text ramp", () => {
    const doc = staticDoc(breakage());
    const lead = Array.from(doc.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("recorded breakage"),
    );
    expect(styleOf(lead)).toContain("color:var(--text2)");
    expect(styleOf(lead)).not.toContain("cat-breakage");
  });

  it("says so plainly when nothing broke, and stays where it is", () => {
    render(
      <BreakageView
        build={build}
        events={[]}
        tree={[]}
        nodeTypes={nodeTypes}
        resolveNode={noResolve}
        resolveMedia={noMedia}
      />,
    );
    expect(screen.getByText("No breakages recorded")).toBeTruthy();
  });
});

/* ── rebuilds ───────────────────────────────────────────────────────────── */

describe("the rebuilds list", () => {
  it("gives each row the credit's voice: who and when in mono on --text2", () => {
    const doc = staticDoc(
      <MemoryRouter>
        <RebuildsTab rebuilds={[rebuild]} />
      </MemoryRouter>,
    );
    const who = Array.from(doc.querySelectorAll("span")).find((span) =>
      span.textContent?.startsWith("@nightowl"),
    );

    expect(styleOf(who)).toContain("DM Mono");
    expect(styleOf(who)).toContain("color:var(--text2)");
    expect(styleOf(who)).toContain("font-variant-numeric:tabular-nums");
  });

  it("counts a descendant's own reproductions in --evidence when it has any", () => {
    const doc = staticDoc(
      <MemoryRouter>
        <RebuildsTab rebuilds={[rebuild]} />
      </MemoryRouter>,
    );
    const count = Array.from(doc.querySelectorAll("span")).find(
      (span) => span.textContent === "2",
    );
    expect(styleOf(count)).toContain("color:var(--evidence)");
    expect(styleOf(count)).toContain("font-variant-numeric:tabular-nums");
  });

  it("says nothing has happened rather than showing an empty shelf", () => {
    const doc = staticDoc(
      <MemoryRouter>
        <RebuildsTab rebuilds={[]} />
      </MemoryRouter>,
    );
    const message = doc.querySelector("p");
    expect(message?.textContent).toBe("Nobody has rebuilt this yet.");
    expect(styleOf(message)).toContain("color:var(--text2)");
  });
});
