// CA-18b P3: colour and references at the foot of Details: a reference group (notes, members, linked text), a single
// colour, uncoloured with linked text, and nothing; all read only.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { shapeDetailsProps } from "@/dev/fixtures/shapes";
import { PARTS_S } from "@/dev/fixtures/parts";
import { REFS_COLOURS, REFS_LOGIN, REFS_LOGIN_NOTES, referencesMaking, referencesTree } from "@/dev/fixtures/references";
import type { RefEntry } from "@/lib/build/postRefs";
import { colourModelOf, groupTo, type ColourModel } from "@/lib/build/referenceGroups";

import { DetailsPanel } from "./DetailsPanel";
import { DetailsReferencesProvider, ColourReferences, type DetailsReferencesValue } from "./DetailsReferences";
import { DETAILS_REFS_COPY as COPY, componentWord, referenceSectionOf, type LinkedWords } from "./detailsReferences";
import { GroupLabelsProvider } from "./groupLabels";

afterEach(cleanup);

const entry = (to: string, kind: string, number: string, title: string, eyebrow = title): RefEntry =>
  ({ to, kind, number, title, eyebrow, depth: 0, colour: null, name: title.toLowerCase(), body: "", heading: title, id: to.split(":")[1] ?? to }) as RefEntry;

const SESSION2 = `session:${PARTS_S[1]}`;
const lookup = new Map<string, RefEntry>([
  [SESSION2, entry(SESSION2, "Session", "S2", "The whole session", "Session 2")],
  [`session:${PARTS_S[2]}`, entry(`session:${PARTS_S[2]}`, "Session", "S3", "The whole session", "Session 3")],
  ["node:rf-c4", entry("node:rf-c4", "Code", "4", "Send the link")],
  ["node:rf-k5", entry("node:rf-k5", "Check", "5", "Link opens once")],
  ["node:rf-m2", entry("node:rf-m2", "Manual step", "2", "Data model")],
  ["node:rf-m6", entry("node:rf-m6", "Manual step", "6", "Landing page")],
  ["node:rf-p1", entry("node:rf-p1", "Prompt", "1", "Plan the portal")],
  ["workstream:ws-a", entry("workstream:ws-a", "Part", "A", "The whole part", "Part A")],
]);
const nodes = referencesTree.map((node) => ({ id: node.id, colour: ((node.payload ?? {}) as { colour?: string }).colour ?? null }));
const model: ColourModel = colourModelOf(referencesMaking, nodes);
const LOGIN_LINK: LinkedWords = { words: "Signing in by email link", post: 2 };
const links: Record<string, LinkedWords> = { [groupTo(REFS_LOGIN)]: LOGIN_LINK, "node:rf-m2": { words: "the data model", post: 1 }, "node:rf-p1": { words: "the plan", post: 3 } };
const linked = (to: string) => links[to] ?? null;
const sectionFor = (to: string, over: Partial<{ model: ColourModel; linked: (to: string) => LinkedWords | null }> = {}) => referenceSectionOf({ to, model: over.model ?? model, lookup, linked: over.linked ?? linked });

const value = (over: Partial<DetailsReferencesValue> = {}): DetailsReferencesValue => ({ model, lookup, linked, onSelect: vi.fn(), onGoTo: vi.fn(), onOpenGroup: vi.fn(), ...over });
const draw = (to: string, v: DetailsReferencesValue = value(), clamp?: number, themed: ReactNode = null) => {
  const section = referenceSectionOf({ to, model: v.model, lookup: v.lookup, linked: v.linked });
  if (!section) throw new Error(`no section for ${to}`);
  return render(
    <ThemeProvider>
      {themed}
      <ColourReferences section={section} value={v} clamp={clamp} />
    </ThemeProvider>,
  );
};
const order = (root: HTMLElement, texts: string[]) => texts.map((text) => (root.textContent ?? "").indexOf(text));

describe("the three states", () => {
  it("a tile, a session and a part in a group: the group, its others, its members", () => {
    for (const to of ["node:rf-c4", SESSION2, "node:rf-k5"]) {
      const section = sectionFor(to);
      expect(section).toMatchObject({ state: "group", others: 2 });
      expect(section && "members" in section ? section.members.map((m) => m.to) : []).toEqual([SESSION2, "node:rf-c4", "node:rf-k5"]);
    }
    // A part in a group, with a model of its own.
    const partModel: ColourModel = { groups: [{ id: "rg-x", colour: "#7FB88A", members: ["workstream:ws-a", "node:rf-c4"] }], singles: {} };
    expect(sectionFor("workstream:ws-a", { model: partModel })).toMatchObject({ state: "group", others: 1 });
  });

  it("a single colour on a tile, a session and a part, and who else has it, not grouped", () => {
    const singles: ColourModel = { groups: [], singles: { "node:rf-m2": "#7FA7D9", [`session:${PARTS_S[2]}`]: "#7FA7D9", "workstream:ws-a": "#7FA7D9", SESSION2: "#112233" } };
    expect(sectionFor("node:rf-m2", { model: singles })).toMatchObject({ state: "single", colour: "#7FA7D9", word: "tile", alsoUsedBy: ["Session 3", "Part A"] });
    expect(sectionFor(`session:${PARTS_S[2]}`, { model: singles })).toMatchObject({ state: "single", word: "session" });
    expect(sectionFor("workstream:ws-a", { model: singles })).toMatchObject({ state: "single", word: "part" });
  });

  it("uncoloured: a Linked text section with linked words, else nothing", () => {
    expect(sectionFor("node:rf-p1")).toMatchObject({ state: "linked", linked: { words: "the plan", post: 3, to: "node:rf-p1" } });
    expect(sectionFor("node:rf-p1", { linked: () => null })).toBeNull();
  });

  it("names each kind of component for its own words", () => {
    expect(["node:x", "session:y", "workstream:z"].map(componentWord)).toEqual(["tile", "session", "part"]);
  });
});

describe("a reference group", () => {
  it("heads the section with the group's other components, then one panel with a 3px bar in the group's colour", () => {
    draw("node:rf-c4");
    expect(screen.getByRole("heading", { name: COPY.groupHead })).toBeTruthy();
    expect(screen.getByTestId("details-refs-sub").textContent).toBe("Shares its colour with 2 other components");
    const panel = screen.getByTestId("details-refs-panel");
    expect(panel.getAttribute("style")).toContain("inset 3px 0 0");
    expect(panel.getAttribute("style")).toContain("padding: 14px 16px");
    expect(screen.getAllByTestId("details-refs-panel")).toHaveLength(1);
  });

  it("says 1 other component for a pair", () => {
    const pair: ColourModel = { groups: [{ id: "rg-p", colour: "#B79AD6", members: ["node:rf-m2", "node:rf-m6"] }], singles: {} };
    draw("node:rf-m2", value({ model: pair }));
    expect(screen.getByTestId("details-refs-sub").textContent).toBe("Shares its colour with 1 other component");
    expect(screen.getByTestId("details-refs-name").textContent).toBe(COPY.noName);
  });

  it("orders the panel: the top row, Notes, Components, Linked text", () => {
    draw("node:rf-c4");
    const parts = [
      screen.getByTestId("details-refs-name"),
      screen.getByText(COPY.notes),
      screen.getByTestId("details-refs-notes"),
      screen.getByText(COPY.componentsLabel),
      screen.getAllByTestId("details-refs-member")[0] as HTMLElement,
      screen.getByText(COPY.linkedText),
      screen.getByTestId("details-refs-words"),
    ];
    parts.slice(1).forEach((part, at) => expect(parts[at]?.compareDocumentPosition(part) & Node.DOCUMENT_POSITION_FOLLOWING, String(at)).toBeTruthy());
    const top = screen.getByTestId("details-refs-name").parentElement as HTMLElement;
    expect(within(top).getByText("· 3 components")).toBeTruthy();
    expect(within(top).getByRole("button", { name: COPY.openGroup })).toBeTruthy();
  });

  it("leaves out Notes with none, and Linked text with none", () => {
    const bare: ColourModel = { groups: [{ id: "rg-b", colour: "#B79AD6", members: ["node:rf-m2", "node:rf-m6"] }], singles: {} };
    const { container } = draw("node:rf-m2", value({ model: bare, linked: () => null }));
    expect(container.textContent).not.toContain(COPY.notes);
    expect(container.textContent).not.toContain(COPY.linkedText);
    expect(container.textContent).toContain(COPY.componentsLabel);
  });

  it("lists one 36 tall row per member, in the group's order, with the shown component as This tile / session / part", () => {
    draw("node:rf-c4");
    const rows = screen.getAllByTestId("details-refs-member");
    expect(rows.map((row) => row.textContent)).toEqual(["S2Session 2Session", "4Send the linkThis tile", "5Link opens onceCheck"]);
    expect(rows.every((row) => row.getAttribute("style")?.includes("height: 36px"))).toBe(true);
    expect(rows[1]?.getAttribute("data-current")).toBe("true");
    expect((rows[2] as HTMLElement).style.borderTopWidth).toBe("1px");
    expect((rows[2] as HTMLElement).style.borderBottomWidth).toBe("0px");
    expect((rows[0] as HTMLElement).style.borderTopWidth).toBe("0px");
    cleanup();
    draw(SESSION2);
    expect(within(screen.getAllByTestId("details-refs-member")[0] as HTMLElement).getByText(COPY.this("session"))).toBeTruthy();
    cleanup();
    draw("workstream:ws-a", value({ model: { groups: [{ id: "rg-w", colour: "#7FB88A", members: ["workstream:ws-a", "node:rf-c4"] }], singles: {} }, linked: () => null }));
    expect(within(screen.getAllByTestId("details-refs-member")[0] as HTMLElement).getByText(COPY.this("part"))).toBeTruthy();
  });

  it("a row selects its component", () => {
    const v = value();
    draw("node:rf-c4", v);
    fireEvent.click(screen.getAllByTestId("details-refs-member")[2] as HTMLElement);
    expect(v.onSelect).toHaveBeenCalledWith("node:rf-k5");
  });

  it("shows the group's linked words, their post, and Go to it", () => {
    const v = value();
    draw("node:rf-c4", v);
    expect(screen.getByTestId("details-refs-words").textContent).toBe("Signing in by email link");
    expect(screen.getByText("Post 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: COPY.goTo }));
    expect(v.onGoTo).toHaveBeenCalledWith(groupTo(REFS_LOGIN));
  });

  it("Open group opens the group", () => {
    const v = value();
    draw("node:rf-c4", v);
    fireEvent.click(screen.getByRole("button", { name: COPY.openGroup }));
    expect(v.onOpenGroup).toHaveBeenCalledWith(REFS_LOGIN);
  });

  it("shows the notes in full, and cut past Details' height with Read all, which opens the group", () => {
    const v = value();
    const { unmount } = draw("node:rf-c4", v);
    expect(screen.getByTestId("details-refs-notes").getAttribute("style")).not.toContain("max-height");
    expect(screen.queryByRole("button", { name: COPY.readAll })).toBeNull();
    unmount();
    draw("node:rf-c4", v, 60);
    expect(screen.getByTestId("details-refs-notes").getAttribute("style")).toContain("max-height: 60px");
    fireEvent.click(screen.getByRole("button", { name: COPY.readAll }));
    expect(v.onOpenGroup).toHaveBeenCalledWith(REFS_LOGIN);
  });

  it("has nothing in it that can be typed into", () => {
    const { container } = draw("node:rf-c4");
    expect(container.querySelectorAll("input, textarea, select, [contenteditable]")).toHaveLength(0);
  });
});

describe("a single colour", () => {
  const single: ColourModel = { groups: [], singles: { "node:rf-m2": "#7FA7D9", "node:rf-m6": "#7FA7D9" } };

  it("heads it Colour, says where it is set, and shows the swatch, the name and the code in one panel", () => {
    draw("node:rf-m2", value({ model: single }));
    expect(screen.getByRole("heading", { name: COPY.colourHead })).toBeTruthy();
    expect(screen.getByTestId("details-refs-sub").textContent).toBe("Set on this tile only");
    const panel = screen.getByTestId("details-refs-panel");
    expect(panel.textContent).toContain("Single colour");
    expect(panel.textContent).toContain("#7FA7D9");
    expect(panel.getAttribute("style")).toContain("padding: 14px 16px");
    expect(panel.getAttribute("style")).not.toContain("inset 3px");
  });

  it("shows the linked text, and who else has the colour, not grouped", () => {
    const v = value({ model: single });
    draw("node:rf-m2", v);
    expect(screen.getByTestId("details-refs-words").textContent).toBe("the data model");
    expect(screen.getByTestId("details-refs-also").textContent).toBe("Also used by Manual step 6, not grouped");
    fireEvent.click(screen.getByRole("button", { name: COPY.goTo }));
    expect(v.onGoTo).toHaveBeenCalledWith("node:rf-m2");
  });

  it("leaves out Linked text and Also used by when there is none", () => {
    draw("node:rf-m2", value({ model: { groups: [], singles: { "node:rf-m2": "#7FA7D9" } }, linked: () => null }));
    expect(screen.queryByTestId("details-refs-linked")).toBeNull();
    expect(screen.queryByTestId("details-refs-also")).toBeNull();
  });
});

describe("uncoloured", () => {
  it("with linked text: a Linked text section only, with Go to it", () => {
    const v = value();
    draw("node:rf-p1", v);
    expect(screen.getByTestId("details-refs").getAttribute("data-state")).toBe("linked");
    expect(screen.queryByTestId("details-refs-panel")).toBeNull();
    expect(screen.getByTestId("details-refs-words").textContent).toBe("the plan");
    fireEvent.click(screen.getByRole("button", { name: COPY.goTo }));
    expect(v.onGoTo).toHaveBeenCalledWith("node:rf-p1");
  });

  it("with neither: no section at all", () => {
    expect(sectionFor("node:rf-p1", { linked: () => null })).toBeNull();
  });
});

describe("in Details", () => {
  const source = { tree: referencesTree, making: referencesMaking, selected: "rf-c4" };
  const details = (id: string, over: Partial<DetailsReferencesValue> = {}, bare = false) => (
    <ThemeProvider>
      <GroupLabelsProvider making={referencesMaking}>
        <DetailsReferencesProvider value={value(over)}>
          <DetailsPanel {...shapeDetailsProps("one-sitting", id, source)} phone={false} colour={{ what: id, colour: bare ? null : REFS_COLOURS.login, to: `node:${id}`, onPick: () => undefined }} />
        </DetailsReferencesProvider>
      </GroupLabelsProvider>
    </ThemeProvider>
  );

  it("ends the panel: after its own sections and after the Not set line, with a rule above", () => {
    render(details("rf-c4"));
    const panel = screen.getByTestId("details-panel");
    const notSet = screen.getByTestId("details-not-set");
    const refs = screen.getByTestId("details-refs");
    expect(notSet.compareDocumentPosition(refs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.lastElementChild?.contains(refs) || panel.querySelector('[data-testid="details-refs"]') === refs).toBe(true);
    // The rule is the sections' own (SECTION_BREAK): 22, a 1px hairline, 22. jsdom drops a shorthand with a variable, so the rule itself is checked in the browser.
    expect(refs.style.marginTop).toBe("22px");
    expect(refs.style.paddingTop).toBe("22px");
    for (const section of screen.getAllByTestId("details-section")) expect(section.compareDocumentPosition(refs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a tile with no colour and no linked text has no section", () => {
    render(details("rf-k5", { model: { groups: [], singles: {} }, linked: () => null }, true));
    expect(screen.queryByTestId("details-refs")).toBeNull();
  });

  it("has no section when the page gives no references", () => {
    render(
      <ThemeProvider>
        <DetailsPanel {...shapeDetailsProps("one-sitting", "rf-c4", source)} phone={false} colour={{ what: "Code 4", colour: REFS_COLOURS.login, to: "node:rf-c4", onPick: () => undefined }} />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId("details-refs")).toBeNull();
  });

  it("the head says In Login flow only for a named group", () => {
    const { unmount } = render(details("rf-c4"));
    expect(screen.getByTestId("details-group-label").textContent).toBe("In Login flow");
    unmount();
    // An unnamed group (Prompts 7 and 8) says nothing in the head.
    render(details("rf-p7"));
    expect(screen.queryByTestId("details-group-label")).toBeNull();
  });
});
