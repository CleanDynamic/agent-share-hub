// CA-19 P1: single colours and reference groups, the three states, every move and its undo, and the size rule.

import { describe, expect, it } from "vitest";

import { buildSteps, sessionGroups } from "./graph";
import {
  addToGroup,
  alsoUsedBy,
  applyWrites,
  clearAll,
  clearColour,
  colourModelOf,
  colourStateOf,
  deleteGroup,
  groupByMember,
  makeGroup,
  makingWithGroupColours,
  mergeGroups,
  orderGroups,
  orderMembers,
  orderSingles,
  pruneGroups,
  recolourGroup,
  referenceGroupsOf,
  referenceGroupsRefusal,
  removeFromGroup,
  renameGroup,
  saveGroup,
  setNotes,
  setSingleColour,
  singlesInOrder,
  stateIn,
  withGroupColours,
  type ColourModel,
  type ColourMove,
} from "./referenceGroups";
import type { NodeTree } from "./types";

const login = { id: "rg-login", colour: "#7FB88A", name: "Login flow", notes: "Email first.", members: ["session:s2", "node:c4", "node:k5"] };
const plum = { id: "rg-plum", colour: "#B79AD6", members: ["node:t1", "node:t2"] };

const making = (extra: Record<string, unknown> = {}) => ({
  sessions_meta: { s2: { tool: null, date: "", colour: "#D98C8C" }, s3: { tool: null, date: "", colour: "#7FA7D9" } },
  workstreams: [{ key: "ws-a", colour: "#C9A86B" }, { key: "ws-b" }],
  reference_groups: [login, plum],
  ...extra,
});
const nodes = [
  { id: "dm", colour: "#7FA7D9" },
  { id: "lp", colour: "#7FA7D9" },
  { id: "c4", colour: "#8FBFB8" },
  { id: "k5" },
  { id: "t1" },
  { id: "t2" },
];
const model = (): ColourModel => colourModelOf(making(), nodes);

/** Applying a move and then its undo leaves the model as it was. */
function roundTrip(start: ColourModel, move: ColourMove | null): ColourModel {
  expect(move).not.toBeNull();
  const after = applyWrites(start, (move as ColourMove).writes);
  expect(applyWrites(after, (move as ColourMove).undo)).toEqual(start);
  return after;
}

describe("what is stored", () => {
  it("reads groups in the maker's order, defensively, and never rewrites them", () => {
    const stored = making({ reference_groups: [login, { id: "nope", colour: "#000000", members: [] }, { ...plum, members: ["node:t1", "node:t1", "group:rg-login", "node:c4", "node:t2"] }, { id: "rg-login", colour: "#FFFFFF", members: [] }] });
    const before = JSON.stringify(stored);
    expect(referenceGroupsOf(stored).map((group) => [group.id, group.members])).toEqual([
      ["rg-login", ["session:s2", "node:c4", "node:k5"]],
      // A repeat, a group ref and a component already in an earlier group are left out.
      ["rg-plum", ["node:t1", "node:t2"]],
    ]);
    expect(JSON.stringify(stored)).toBe(before);
  });

  it("refuses a group that cannot be saved", () => {
    expect(referenceGroupsRefusal([login, plum])).toBeNull();
    expect(referenceGroupsRefusal([{ ...plum, members: ["node:t1"] }])).toBe("A group needs two or more components");
    expect(referenceGroupsRefusal([{ ...plum, name: "x".repeat(41) }])).toBe("A group name is 1 to 40 characters.");
    expect(referenceGroupsRefusal([{ ...plum, notes: "x".repeat(2001) }])).toBe("Notes are at most 2,000 characters.");
    expect(referenceGroupsRefusal([login, { ...plum, members: ["node:t1", "node:c4"] }])).toBe("A component is in one group at most.");
  });
});

describe("the three states", () => {
  it("reads uncoloured, a single colour and a group", () => {
    expect(colourStateOf("node:k5", making(), nodes)).toEqual({ state: "group", colour: "#7FB88A", group: login });
    expect(colourStateOf("node:dm", making(), nodes)).toEqual({ state: "single", colour: "#7FA7D9" });
    expect(colourStateOf("workstream:ws-a", making(), nodes)).toEqual({ state: "single", colour: "#C9A86B" });
    expect(colourStateOf("workstream:ws-b", making(), nodes)).toEqual({ state: "none", colour: null });
  });

  it("shows a member in its group's colour, even with an old single colour still stored", () => {
    expect(model().singles["node:c4"]).toBe("#8FBFB8");
    expect(stateIn(model(), "node:c4").colour).toBe("#7FB88A");
    expect(stateIn(model(), "session:s2").colour).toBe("#7FB88A");
  });

  it("never gives a tile its session's or its part's colour", () => {
    const tree = [{ id: "x", build_id: "b", parent_id: null, position: 1, type: "prompt", title: "X", note: null, payload: { text: "x", session: "s3" }, source_ref: null, event_id: null, is_gap: false, created_at: "", children: [] }] as unknown as NodeTree[];
    const steps = buildSteps(tree);
    const drawn = withGroupColours(steps, sessionGroups(steps, [], {}, {}), making({ reference_groups: [{ id: "rg-s", colour: "#7FB88A", members: ["session:s3", "workstream:ws-b"] }] }));
    expect(drawn.steps[0].colour).toBeUndefined();
  });

  it("draws members in their group's colour everywhere a single colour is drawn", () => {
    const shown = makingWithGroupColours(making({ reference_groups: [{ id: "rg-p", colour: "#7FB88A", members: ["workstream:ws-b", "node:t1"] }] })) as { workstreams: { colour?: string }[] };
    expect(shown.workstreams.map((part) => part.colour)).toEqual(["#C9A86B", "#7FB88A"]);
    expect([...groupByMember(making()).keys()]).toEqual(["session:s2", "node:c4", "node:k5", "node:t1", "node:t2"]);
  });

  it("names the others with the same single colour", () => {
    expect(alsoUsedBy(model(), "#7fa7d9", "node:dm")).toEqual(["node:lp", "session:s3"]);
    // A member is not "using" the colour on its own.
    expect(alsoUsedBy(model(), "#7FB88A", "node:dm")).toEqual([]);
  });

  it("orders single colours by the maker's order, then the build's", () => {
    const ordered = colourModelOf(making({ single_colour_order: ["session:s3", "node:gone"] }), nodes);
    expect(singlesInOrder(ordered, ["workstream:ws-a", "node:dm", "node:lp", "session:s3", "node:c4"])).toEqual(["session:s3", "workstream:ws-a", "node:dm", "node:lp"]);
  });
});

describe("the moves", () => {
  it("sets and clears a single colour", () => {
    const after = roundTrip(model(), setSingleColour(model(), "workstream:ws-b", "abc"));
    expect(stateIn(after, "workstream:ws-b")).toEqual({ state: "single", colour: "#AABBCC" });
    const cleared = roundTrip(model(), clearColour(model(), "node:dm"));
    expect(stateIn(cleared, "node:dm").state).toBe("none");
  });

  it("takes a member out of its group for a single colour", () => {
    const after = roundTrip(model(), setSingleColour(model(), "node:k5", "#D98C8C"));
    expect(stateIn(after, "node:k5")).toEqual({ state: "single", colour: "#D98C8C" });
    expect(after.groups[0].members).toEqual(["session:s2", "node:c4"]);
  });

  it("makes a group of one that is not saved until it has two", () => {
    const draft = makeGroup(model(), "node:dm", undefined, "rg-new");
    expect(draft).toEqual({ id: "rg-new", colour: "#7FA7D9", members: ["node:dm"] });
    expect(saveGroup(model(), draft)).toBeNull();
    const after = roundTrip(model(), saveGroup(model(), { ...draft, name: "  Data  ", members: ["node:dm", "node:lp"] }));
    expect(after.groups.at(-1)).toEqual({ id: "rg-new", colour: "#7FA7D9", name: "Data", members: ["node:dm", "node:lp"] });
    // Their single colours are replaced, with Undo.
    expect(after.singles["node:dm"]).toBeUndefined();
  });

  it("adds to a group: the single colour goes, and it leaves any other group", () => {
    const after = roundTrip(model(), addToGroup(model(), "rg-login", "node:dm"));
    expect(stateIn(after, "node:dm").group?.id).toBe("rg-login");
    expect(after.singles["node:dm"]).toBeUndefined();
    const moved = roundTrip(model(), addToGroup(model(), "rg-login", "node:t1"));
    // The plum group fell to one member, so it folds: the tile left keeps its colour.
    expect(moved.groups.map((group) => group.id)).toEqual(["rg-login"]);
    expect(stateIn(moved, "node:t2")).toEqual({ state: "single", colour: "#B79AD6" });
  });

  it("removes from a group: the component becomes uncoloured", () => {
    const after = roundTrip(model(), removeFromGroup(model(), "rg-login", "node:c4"));
    expect(stateIn(after, "node:c4").state).toBe("none");
    expect(after.groups[0].members).toEqual(["session:s2", "node:k5"]);
  });

  it("renames, recolours, writes notes and orders members", () => {
    expect(roundTrip(model(), renameGroup(model(), "rg-plum", "  Plum  ")).groups[1].name).toBe("Plum");
    expect(roundTrip(model(), renameGroup(model(), "rg-login", " ")).groups[0].name).toBeUndefined();
    expect(roundTrip(model(), recolourGroup(model(), "rg-login", "#c9a86b")).groups[0].colour).toBe("#C9A86B");
    expect(roundTrip(model(), setNotes(model(), "rg-plum", "Two tiles.")).groups[1].notes).toBe("Two tiles.");
    expect(roundTrip(model(), orderMembers(model(), "rg-login", ["node:k5", "session:s2"])).groups[0].members).toEqual(["node:k5", "session:s2", "node:c4"]);
    expect(roundTrip(model(), orderGroups(model(), ["rg-plum"])).groups.map((group) => group.id)).toEqual(["rg-plum", "rg-login"]);
    expect(roundTrip(model(), orderSingles(model(), ["node:lp", "node:dm"])).order).toEqual(["node:lp", "node:dm"]);
  });

  it("deletes a group: members become uncoloured and its linked text plain", () => {
    const move = deleteGroup(model(), "rg-login");
    const after = roundTrip(model(), move);
    expect(after.groups.map((group) => group.id)).toEqual(["rg-plum"]);
    expect(stateIn(after, "node:c4").state).toBe("none");
    expect(move?.links).toEqual({ drop: ["group:rg-login"] });
  });

  it("merges: into keeps its name and colour, and from's notes go under into's after a blank line", () => {
    const start = colourModelOf(making({ reference_groups: [login, { ...plum, notes: "Plum notes." }] }), nodes);
    const move = mergeGroups(start, "rg-plum", "rg-login");
    const after = roundTrip(start, move);
    expect(after.groups).toEqual([{ ...login, notes: "Email first.\n\nPlum notes.", members: [...login.members, "node:t1", "node:t2"] }]);
    expect(move?.links).toEqual({ drop: ["group:rg-plum"] });
    expect(mergeGroups(start, "rg-plum", "rg-login", "from")?.links).toEqual({ drop: ["group:rg-login"], retarget: [{ from: "group:rg-plum", to: "group:rg-login" }] });
  });

  it("clears everything", () => {
    const move = clearAll(model(), ["node:dm"]);
    const after = roundTrip(model(), move);
    expect(after.groups).toEqual([]);
    expect(after.singles).toEqual({});
    expect(move?.links?.drop).toEqual(["node:dm", "group:rg-login", "group:rg-plum"]);
  });
});

describe("the size rule", () => {
  it("folds a group fallen to one member into that member's single colour, name and notes gone", () => {
    const move = removeFromGroup(model(), "rg-plum", "node:t1");
    const after = roundTrip(model(), move);
    expect(after.groups.map((group) => group.id)).toEqual(["rg-login"]);
    expect(stateIn(after, "node:t2")).toEqual({ state: "single", colour: "#B79AD6" });
    expect(stateIn(after, "node:t1").state).toBe("none");
    expect(move?.folded?.map((group) => group.id)).toEqual(["rg-plum"]);
    // Its linked text points at the one component left.
    expect(move?.links?.retarget).toEqual([{ from: "group:rg-plum", to: "node:t2" }]);
  });

  it("folds a group whose member was deleted elsewhere, in one step", () => {
    const move = pruneGroups(model(), (ref) => ref !== "node:t2");
    const after = roundTrip(model(), move);
    expect(after.groups.map((group) => group.id)).toEqual(["rg-login"]);
    expect(stateIn(after, "node:t1")).toEqual({ state: "single", colour: "#B79AD6" });
    expect(pruneGroups(model(), () => true)).toBeNull();
  });

  it("shows a stored group of one as its member's single colour until it is folded", () => {
    const stored = colourModelOf(making({ reference_groups: [{ ...plum, members: ["node:t1"] }] }), nodes);
    expect(stateIn(stored, "node:t1")).toEqual({ state: "single", colour: "#B79AD6" });
  });
});
