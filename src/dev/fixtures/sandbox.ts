/* UI-P63 — the composer frame's sample data, as `SandboxView` takes it.

   DEV ONLY. Two builds: the one-prompt fox poster (board S1) and the bakery
   homepage (S3). Both are Lists; the bakery has three sessions, so Map is
   available and the one-time line shows. */

import type { DesignState } from "@/dev/useDesignTheme";
import { composeViewProps } from "@/dev/fixtures/compose";
import { PUBLISH_WORDS } from "@/pages/site/compose/composeModel";
import type { SandboxViewProps } from "@/pages/site/compose/SandboxView";
import type { SessionGroup, Step } from "@/lib/build/graph";
import type { BuildListProps } from "@/pages/site/compose/BuildList";
import type { BuildMapProps } from "@/pages/site/compose/BuildMap";
import type { DetailsPanelProps, DetailsView } from "@/pages/site/compose/DetailsPanel";
import { dividers } from "@/pages/site/compose/buildListModel";
import type { SourcesPanelProps } from "@/pages/site/compose/SourcesPanel";

const noop = () => undefined;

export type SandboxFixture = "fox" | "bakery";

export function sandboxViewProps(which: SandboxFixture = "fox", state: DesignState = "populated"): SandboxViewProps {
  const base = composeViewProps(state);
  const fox = which === "fox";
  return {
    status: base.status,
    onRetry: noop,
    title: fox ? "A fox poster" : "Bakery homepage",
    onTitle: noop,
    description: fox ? "One prompt, one picture: a fox in a snowy wood." : "A warm homepage for a neighbourhood bakery, with opening hours and a menu.",
    onDescription: noop,
    audience: fox ? "designers" : "small businesses",
    onAudience: noop,
    audienceOptions: base.audienceOptions,
    cover: null,
    adding: null,
    mediaError: null,
    accept: base.accept,
    onFiles: noop,
    onRemoveCover: noop,
    madeWith: base.madeWith,
    onToggleMadeWith: noop,
    onAddMadeWith: noop,
    details: base.details,
    onDetail: noop,
    onGapSwitch: noop,

    save: "saved",
    onRetrySave: noop,
    missing: [{ key: "evidence", label: PUBLISH_WORDS.evidence }],
    slug: fox ? "a-fox-poster-k3f9x1" : "bakery-homepage-p2m8z4",
    published: null,
    publishing: false,
    onPublish: noop,

    counts: fox ? { sessions: 1, prompts: 1, files: 0 } : { sessions: 3, prompts: 12, files: 2 },
    lens: "list",
    onLens: noop,
    mapAvailable: !fox,
    mapHint: !fox,
  };
}

/** The Sources panel's rows for each build: the fox poster's one session, the bakery's three, two files and two waiting. */
export function sandboxSourcesProps(which: SandboxFixture = "fox", state: DesignState = "populated"): SourcesPanelProps {
  const fox = which === "fox";
  const empty = state === "empty";
  return {
    phone: false,
    fine: true,
    status: state === "loading" ? "loading" : state === "error" ? "error" : "ready",
    onRetry: noop,
    sessions: empty
      ? []
      : fox
        ? [{ key: "s1", number: 1, tool: "Claude", detail: "Opus 5.5 · 3 Mar", prompts: [{ id: "p1", number: "1", title: "Prompt 1", isDefault: true }] }]
        : [
            {
              key: "s1",
              number: 1,
              tool: "Claude",
              detail: "Opus 5.5 · 3 Mar",
              prompts: [
                { id: "p1", number: "1", title: "Write the homepage copy", isDefault: false },
                { id: "p2", number: "2", title: "Prompt 2", isDefault: true },
              ],
            },
            { key: "s2", number: 2, tool: "Claude Code", detail: "Sonnet 5.5 · 4 Mar", prompts: [{ id: "p3", number: "3", title: "Build the page", isDefault: false }] },
            { key: "typed-3", number: 3, tool: "ChatGPT", detail: "typed here", prompts: [{ id: "p4", number: "4", title: "Prompt 4", isDefault: true }] },
          ],
    files: empty || fox ? [] : [
      { id: "f1", name: "menu.pdf", note: "opened in session 1" },
      { id: "f2", name: "logo.png", note: "added by you" },
    ],
    library: empty || fox ? [] : [
      { id: "l1", label: "Claude", line: "1 Mar · 4 prompts", adding: false },
      { id: "l2", label: "Cursor", line: "28 Feb · 2 prompts", adding: false },
    ],
    selectedId: fox ? "p1" : "p3",
    onSelect: noop,
    onAddSession: noop,
    onDropFiles: noop,
    onPick: noop,
    connectHref: "/connect",
  };
}

const step = (over: Partial<Step> & Pick<Step, "id" | "number" | "text">): Step => ({
  kind: "prompt",
  title: null,
  defaultTitle: `Prompt ${over.number}`,
  words: over.text.split(/\s+/).length,
  model: null,
  sessionId: null,
  tool: null,
  runs: null,
  uses: [],
  children: [],
  ...over,
});

const FOX_TEXT = "A fox standing in a snowy wood at dusk, poster layout, a wide title across the top, soft grain, muted blues and one warm orange accent on the fox.";
const BRIEF = "Write the homepage copy for a neighbourhood bakery called Plum & Rye: warm, short sentences, opening hours, a menu of six items, and a line about the sourdough that has been going since 2014. Keep every section under sixty words and finish with one clear way to order.";

/** The sessions of each build, as `sessionGroups` would give them. */
export function sandboxGroups(which: SandboxFixture = "fox"): SessionGroup[] {
  const fox = which === "fox";
  return fox
    ? [{ sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1"] }]
    : [
        { sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"] },
        { sessionId: "s2", number: 2, tool: "Claude Code", model: "Sonnet 5.5", startedAt: "2026-03-04T10:00:00", stepNumbers: ["3"] },
        { sessionId: null, number: 3, tool: "ChatGPT", model: null, startedAt: "typed here", stepNumbers: ["4"] },
      ];
}

/** The List's rows for each build: the fox poster's one card, the bakery's sessions, an agent, a team and a result. */
export function sandboxListProps(which: SandboxFixture = "fox"): BuildListProps {
  const fox = which === "fox";
  const steps: Step[] = fox
    ? [step({ id: "p1", number: "1", text: FOX_TEXT, sessionId: "s1", model: "opus-5-5" })]
    : [
        step({ id: "p1", number: "1", title: "Homepage copy", text: BRIEF, sessionId: "s1", model: "opus-5-5" }),
        step({ id: "p2", number: "2", text: "Turn that copy into a single HTML page with a sticky header and a menu grid.", sessionId: "s1", model: "opus-5-5", uses: [{ kind: "output", node_id: "p1" }] }),
        step({ id: "p3", number: "3", title: "Fix the mobile layout", text: "The menu grid overflows on a phone. Stack it to one column below 600px and keep the header sticky.", sessionId: "s2", model: "sonnet-5-5", uses: [{ kind: "output", node_id: "p2" }, { kind: "file", node_id: "f1" }] }),
        step({ id: "p4", number: "4", text: "Add the opening hours as a small table under the hero.", tool: "ChatGPT" }),
        step({
          id: "a5",
          number: "5",
          kind: "agent",
          title: "Order checker",
          text: "",
          model: "opus-5-5",
          runs: { how: "until", detail: "every item has a price" },
          children: [step({ id: "a5:instructions", number: "5.1", defaultTitle: "Instructions", text: "Check the menu and reply with any item that has no price." })],
        }),
      ];
  const groups = sandboxGroups(which);
  return {
    phone: false,
    steps,
    dividers: dividers(steps, groups),
    names: { f1: "menu.pdf" },
    suggestions: fox ? [] : [{ stepId: "p4", use: { kind: "output", node_id: "p1" }, label: "Output of 1 · Homepage copy", reason: "38 words match" }],
    intoResult: new Set(fox ? ["p1"] : ["a5"]),
    results: [{ id: "r1", title: fox ? "fox-poster.png" : "plumandrye.example", holds: fox ? "a picture" : "a link", from: fox ? "1" : "5" }],
    selectedId: fox ? "p1" : "p3",
    onSelect: noop,
    onRename: noop,
    onMove: noop,
    onRemove: noop,
    onAccept: noop,
    onDismiss: noop,
    onAddPrompt: () => Promise.resolve(true),
    focusAdd: 0,
    onAddAgentPrompt: () => Promise.resolve(true),
    onAddAgentTo: noop,
  };
}

export type SandboxDetails = "prompt" | "session" | "agent" | "file" | "tool" | "result";

/** The Details panel for each kind of selection: a prompt of the bakery (V2), its session, the order checker (S4), a file, a tool, the result. */
export function sandboxDetailsProps(kind: SandboxDetails = "prompt", which: SandboxFixture = "fox"): DetailsPanelProps {
  const handlers = {
    onRename: noop,
    onModel: noop,
    onAddUse: noop,
    onRemoveUse: noop,
    onRuns: noop,
    onRemoveInside: noop,
    onToggleSessionPrompt: noop,
    onDownload: noop,
    onFields: noop,
    onAddPicture: noop,
    onUseAsCover: noop,
  };
  const fox = which === "fox";
  const views: Record<SandboxDetails, DetailsView> = {
    prompt: fox
      ? { kind: "prompt", id: "p1", number: "1", title: null, defaultTitle: "Prompt 1", editable: true, sessionLine: "Session 1 · Claude", detailLine: "Opus 5.5 · 3 Mar · prompt 1 of 1", typed: false, model: "Opus 5.5", text: FOX_TEXT, words: 27, uses: [], options: [], goesInto: [{ id: "result", label: "Result" }] }
      : {
          kind: "prompt",
          id: "p3",
          number: "3",
          title: "Fix the mobile layout",
          defaultTitle: "Prompt 3",
          editable: true,
          sessionLine: "Session 2 · Claude Code",
          detailLine: "Sonnet 5.5 · 4 Mar · prompt 3 of 4",
          typed: false,
          model: "Sonnet 5.5",
          text: "The menu grid overflows on a phone. Stack it to one column below 600px and keep the header sticky.",
          words: 19,
          uses: [
            { use: { kind: "output", node_id: "p2" }, label: "Output of 2", sub: "Prompt 2 · Session 1" },
            { use: { kind: "file", node_id: "f1" }, label: "menu.pdf", sub: "File · opened in session 1" },
          ],
          options: [{ key: "output:p1", use: { kind: "output", node_id: "p1" }, label: "Output of 1", sub: "Homepage copy · Session 1" }],
          goesInto: [{ id: "p4", label: "4 · Prompt 4" }],
        },
    session: { kind: "session", key: "s1", number: 1, tool: "Claude", model: "Opus 5.5", date: "3 Mar", inBuild: 2, total: 3, status: "ready", checklist: [{ ordinal: 0, label: "Write the homepage copy", stepId: "p1" }, { ordinal: 1, label: "Prompt 2", stepId: "p2" }, { ordinal: 2, label: "Add a footer with the address", stepId: null }] },
    agent: { kind: "agent", id: "a5", number: "5", name: "Order checker", defaultName: "Agent 5", model: "Opus 5.5", runs: { how: "until", detail: "every item has a price" }, inside: "1 prompt", insideRows: [{ id: "a5:p", label: "5.2 · Prompt 5.2" }], instructions: "Check the menu and reply with any item that has no price.", parent: null, uses: [{ use: { kind: "output", node_id: "p1" }, label: "Output of 1", sub: "Homepage copy · Session 1" }], options: [], goesInto: [{ id: "result", label: "Result" }] },
    file: { kind: "file", id: "f1", name: "menu.pdf", from: "opened in session 1", size: "212 KB", canDownload: true, usedBy: [{ id: "p3", label: "3 · Fix the mobile layout" }] },
    tool: { kind: "tool", id: "t1", service: "Gmail", scopes: "read, label, draft", usedBy: [{ id: "a5", label: "5 · Order checker" }] },
    result: { kind: "result", id: "r1", summary: fox ? "fox-poster.png" : "The finished homepage", url: fox ? "" : "https://plumandrye.example", pictures: fox ? [{ id: "m1", name: "fox-poster.png" }] : [] },
  };
  return { phone: false, view: views[kind], ...handlers };
}

export type SandboxMapFixture = SandboxFixture | "big";

/** The Map for each build; `big` is 60 steps over six sessions, for the long-task measurement. */
export function sandboxMapProps(which: SandboxMapFixture = "fox"): BuildMapProps {
  const base = {
    suggestions: [],
    onSelect: noop,
    onClear: noop,
    onConnect: noop,
  };
  if (which === "big") {
    const steps: Step[] = Array.from({ length: 60 }, (_, at) =>
      step({ id: `b${at}`, number: String(at + 1), sessionId: `s${at % 6}`, text: "Write the next part of the page, keeping the voice of the earlier parts.", model: "opus-5-5", uses: at > 0 ? [{ kind: "output", node_id: `b${at - 1}` }] : [] }),
    );
    const groups: SessionGroup[] = Array.from({ length: 6 }, (_, at) => ({
      sessionId: `s${at}`,
      number: at + 1,
      tool: "Claude",
      model: "Opus 5.5",
      startedAt: `2026-03-0${at + 1}T10:00:00`,
      stepNumbers: steps.filter((candidate) => candidate.sessionId === `s${at}`).map((candidate) => candidate.number),
    }));
    return { ...base, steps, groups, files: [], tools: [], results: [{ id: "r1", title: "The finished site", fromId: "b59" }], selectedId: "b30" };
  }
  const list = sandboxListProps(which);
  const fox = which === "fox";
  return {
    ...base,
    steps: list.steps,
    groups: sandboxGroups(which),
    files: fox ? [] : [{ id: "f1", name: "menu.pdf" }],
    tools: fox ? [] : [{ id: "t1", name: "Gmail" }],
    results: [{ id: "r1", title: list.results[0].title, fromId: fox ? "p1" : "a5" }],
    suggestions: fox ? [] : [{ stepId: "p4", use: { kind: "output", node_id: "p1" }, label: "Output of 1" }],
    selectedId: fox ? "p1" : "p3",
    onSelect: noop,
    onClear: noop,
    onConnect: noop,
  };
}

/**
 * The team build (board S5 and V5-TeamMap): two prompts from one chat, then a
 * team of four agents (a researcher, a writer run three at once, a checker that
 * sends work back until it is approved, and a finisher), then a prompt that uses
 * the team, and the result. The writer has two prompts of its own.
 */
export function sandboxTeamFixture(): { list: BuildListProps; map: BuildMapProps } {
  const agent = (id: string, number: string, title: string | null, text: string, extra: Partial<Step> = {}) =>
    step({ id, number, kind: "agent", title, defaultTitle: `Agent ${number}`, text, model: "opus-5-5", ...extra });
  const out = (id: string) => ({ kind: "output" as const, node_id: id });
  const researcher = agent("t3a", "3.1", "Researcher", "Find what other neighbourhood bakeries put on their homepage.", { uses: [{ kind: "file", node_id: "f1" }] });
  const writer = agent("t3b", "3.2", "Writer", "Write the homepage copy from the research.", {
    runs: { how: "parallel", count: 3 },
    uses: [out("t3a"), out("t3c")],
    children: [
      step({ id: "t3b:instructions", number: "3.2.1", defaultTitle: "Instructions", text: "Write the homepage copy from the research." }),
      step({ id: "t3b-p2", number: "3.2.2", text: "Keep every section under sixty words." }),
      step({ id: "t3b-p3", number: "3.2.3", text: "Finish with one clear way to order." }),
    ],
  });
  const checker = agent("t3c", "3.3", "Checker", "Reply approved, or send it back with what to change.", { runs: { how: "until", detail: "approved" }, uses: [out("t3b")] });
  const finisher = agent("t3d", "3.4", "Finisher", "Format the approved copy as a single HTML page.", { uses: [out("t3c")] });
  const steps: Step[] = [
    step({ id: "p1", number: "1", title: "Brand brief", text: BRIEF, sessionId: "s1", model: "opus-5-5" }),
    step({ id: "p2", number: "2", text: "List the sections the homepage needs.", sessionId: "s1", model: "opus-5-5", uses: [out("p1")] }),
    step({ id: "t3", number: "3", kind: "team", title: "Copy team", defaultTitle: "Team 3", text: "", uses: [out("p2")], children: [researcher, writer, checker, finisher] }),
    step({ id: "p4", number: "4", text: "Put the finished copy into the page.", tool: "Claude Code", uses: [out("t3")] }),
  ];
  const groups: SessionGroup[] = [
    { sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2"] },
    { sessionId: null, number: 2, tool: "Claude Code", model: null, startedAt: "typed here", stepNumbers: ["4"] },
  ];
  const list: BuildListProps = {
    phone: false,
    steps,
    dividers: dividers(steps, groups),
    names: { f1: "menu.pdf" },
    suggestions: [],
    intoResult: new Set(["t3"]),
    results: [{ id: "r1", title: "plumandrye.example", holds: "a link", from: "3" }],
    selectedId: "t3",
    onSelect: noop,
    onRename: noop,
    onMove: noop,
    onRemove: noop,
    onAccept: noop,
    onDismiss: noop,
    onAddPrompt: () => Promise.resolve(true),
    focusAdd: 0,
    onAddAgentPrompt: () => Promise.resolve(true),
    onAddAgentTo: noop,
  };
  const map: BuildMapProps = {
    steps,
    groups,
    files: [{ id: "f1", name: "menu.pdf" }],
    tools: [],
    results: [{ id: "r1", title: "plumandrye.example", fromId: "t3" }],
    suggestions: [],
    selectedId: "t3",
    onSelect: noop,
    onClear: noop,
    onConnect: noop,
    onOpenContainer: noop,
    onBack: noop,
    onLeave: noop,
  };
  return { list, map };
}

/**
 * The manual step build (board D2 option B): two prompts from one chat, a manual
 * step between them (laying out the hero in Figma, with a screenshot), and a
 * prompt that uses its output.
 */
export function sandboxManualFixture(): { list: BuildListProps; map: BuildMapProps } {
  const out = (id: string) => ({ kind: "output" as const, node_id: id });
  const steps: Step[] = [
    step({ id: "p1", number: "1", title: "Brand brief", text: BRIEF, sessionId: "s1", model: "opus-5-5" }),
    step({ id: "p2", number: "2", text: "List the sections the homepage needs.", sessionId: "s1", model: "opus-5-5", uses: [out("p1")] }),
    step({ id: "m3", number: "3", kind: "manual", defaultTitle: "Manual step 3", tool: "Figma", text: "Laid out the hero and the menu grid from the copy, then exported the frames.", mediaId: "media-1", words: 0, uses: [out("p2")] }),
    step({ id: "p4", number: "4", text: "Build the page from the frames in the attached export.", sessionId: "s1", model: "opus-5-5", uses: [out("m3")] }),
  ];
  const groups: SessionGroup[] = [{ sessionId: "s1", number: 1, tool: "Claude", model: "Opus 5.5", startedAt: "2026-03-03T10:00:00", stepNumbers: ["1", "2", "4"] }];
  const list: BuildListProps = {
    phone: false,
    steps,
    dividers: dividers(steps, groups),
    names: {},
    suggestions: [],
    intoResult: new Set(["p4"]),
    results: [],
    selectedId: "m3",
    onSelect: noop,
    onRename: noop,
    onMove: noop,
    onRemove: noop,
    onAccept: noop,
    onDismiss: noop,
    onAddPrompt: () => Promise.resolve(true),
    focusAdd: 0,
    onAddAgentPrompt: () => Promise.resolve(true),
    onAddAgentTo: noop,
  };
  const map: BuildMapProps = { steps, groups, files: [], tools: [], results: [], suggestions: [], selectedId: "m3", onSelect: noop, onClear: noop, onConnect: noop };
  return { list, map };
}
