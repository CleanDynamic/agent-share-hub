// CA-25 P1: the checklist's items, their words and what is open.

import { describe, expect, it } from "vitest";

import { PUBLISH_ORDER } from "@/pages/site/compose/composeModel";

import { publishChecklist, type ChecklistInput } from "./publishChecklist";

const base: ChecklistInput = {
  missing: [],
  title: "Bakery homepage",
  description: "A warm homepage for a bakery.",
  cover: "image",
  tiles: 18,
  blockers: [],
  threadHold: null,
  reminders: [],
  appless: [],
  cardFilled: true,
};

const keys = (items: readonly { key: string }[]) => items.map((item) => item.key);

describe("publishChecklist required items", () => {
  it("lists the four in PUBLISH_ORDER with their words, details and actions when all are open", () => {
    const out = publishChecklist({ ...base, missing: [...PUBLISH_ORDER] });
    expect(keys(out.required)).toEqual([...PUBLISH_ORDER]);
    expect(out.required.map((item) => [item.words, item.detail, item.action?.label])).toEqual([
      ["Cover picture or video", "None added", "Add cover"],
      ["Title", "None added", "Add title"],
      ["Description", "None added", "Add description"],
      ["Prompt", "None added", "Add prompt"],
    ]);
    expect(out.required.map((item) => item.action?.id)).toEqual(["add_cover", "add_title", "add_description", "add_prompt"]);
    expect(out.canPublish).toBe(false);
    expect(out.note).toBe("Complete 4 required items to publish");
  });

  it("shows the value of a done item, and gives it no action", () => {
    const out = publishChecklist(base);
    expect(out.required.map((item) => [item.done, item.detail, item.action])).toEqual([
      [true, "Picture", undefined],
      [true, "Bakery homepage", undefined],
      [true, "A warm homepage for a bakery.", undefined],
      [true, "18 tiles", undefined],
    ]);
    expect(out.canPublish).toBe(true);
    expect(out.note).toBeNull();
  });

  it("reads a video cover, and one tile, in the singular", () => {
    const out = publishChecklist({ ...base, cover: "video", tiles: 1 });
    expect(out.required[0].detail).toBe("Video");
    expect(out.required[3].detail).toBe("1 tile");
    expect(publishChecklist({ ...base, missing: ["title"] }).note).toBe("Complete 1 required item to publish");
  });

  it("adds each blocker and the post's hold as a required item with Go to it", () => {
    const out = publishChecklist({
      ...base,
      blockers: [{ line: "Decision 'Pick' needs at least two options for 'a'", stepId: "n1" }],
      threadHold: "Post 3 is over 1,000 characters",
    });
    expect(keys(out.required).slice(4)).toEqual(["blocker-0", "thread"]);
    expect(out.required[4]).toMatchObject({ words: "Decision 'Pick' needs at least two options for 'a'", detail: null, done: false, stepId: "n1", action: { id: "go_to", label: "Go to it" } });
    expect(out.required[5]).toMatchObject({ words: "Post text", detail: "Post 3 is over 1,000 characters", action: { id: "go_to", label: "Go to it" }, stepId: null });
    expect(out.openRequired).toBe(2);
    expect(out.canPublish).toBe(false);
  });
});

describe("publishChecklist recommended items", () => {
  it("names the sessions with no app, the Card when it is not filled and each reminder", () => {
    const out = publishChecklist({
      ...base,
      appless: [
        { key: "a", number: 2 },
        { key: "b", number: 4 },
      ],
      cardFilled: false,
      reminders: [{ line: "People copying this will get a request, not your code.", stepId: "n2" }],
    });
    expect(out.recommended.map((item) => [item.words, item.detail, item.action?.label])).toEqual([
      ["Apps for 2 sessions", "Sessions 2 and 4 have no app", "Show"],
      ["Classification", "Not filled", "Open Classification"],
      ["People copying this will get a request, not your code.", null, "Go to it"],
    ]);
    expect(out.recommended[0].sessions).toEqual(["a", "b"]);
    expect(out.recommended.every((item) => item.section === "recommended")).toBe(true);
    expect(out.canPublish).toBe(true);
  });

  it("says one session in the singular and three in a list", () => {
    const one = publishChecklist({ ...base, appless: [{ key: "a", number: 3 }] }).recommended[0];
    expect([one.words, one.detail]).toEqual(["Apps for 1 session", "Session 3 has no app"]);
    const three = publishChecklist({ ...base, appless: [1, 2, 4].map((number) => ({ key: `s${number}`, number })) }).recommended[0];
    expect(three.detail).toBe("Sessions 1, 2 and 4 have no app");
  });
});

describe("publishChecklist line and need", () => {
  it("counts what is open, and leaves out a part with none", () => {
    expect(publishChecklist({ ...base, missing: ["evidence", "title"], cardFilled: false, appless: [{ key: "a", number: 1 }] }).line).toBe("2 required · 2 recommended");
    expect(publishChecklist({ ...base, cardFilled: false, appless: [{ key: "a", number: 1 }] }).line).toBe("2 recommended");
    expect(publishChecklist({ ...base, missing: ["title"] }).line).toBe("1 required");
  });

  it("is needed while anything required or recommended is open, and not otherwise", () => {
    expect(publishChecklist(base).needed).toBe(false);
    expect(publishChecklist({ ...base, missing: ["title"] }).needed).toBe(true);
    expect(publishChecklist({ ...base, cardFilled: false }).needed).toBe(true);
    expect(publishChecklist(base).line).toBe("");
  });
});
