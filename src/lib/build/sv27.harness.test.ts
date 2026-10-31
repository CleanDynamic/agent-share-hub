// SV-27 Part 1: a session's or an agent's harness is called Harness on screen, and a setup `rule` is called Hook.
// Keys stay, words change: nothing stored is renamed.

import { describe, expect, it } from "vitest";

import { CHECKLIST_COPY, publishChecklist } from "@/lib/build/publishChecklist";
import { SETUP_KIND_LABEL } from "@/lib/build/setup";
import { NO_HARNESS } from "@/lib/build/harnessWords";
import { AGENT_SETUP_COPY } from "@/pages/site/compose/AgentSetupFields";
import { SESSION_DIALOG_COPY } from "@/pages/site/compose/SessionDialog";
import { MAP_COPY } from "@/pages/site/compose/SessionMap";
import { NO_APP } from "@/pages/site/compose/sourcesModel";

describe("SV-27 P1: Harness", () => {
  it("the Session window names the harness", () => {
    expect(SESSION_DIALOG_COPY.app).toBe("Harness");
    expect(SESSION_DIALOG_COPY.noApp).toBe("No harness chosen");
  });

  it("a session with no harness reads No harness chosen everywhere it shows", () => {
    expect(NO_HARNESS).toBe("No harness chosen");
    expect(NO_APP).toBe(NO_HARNESS);
    expect(MAP_COPY.noApp).toBe(NO_HARNESS);
    expect(SESSION_DIALOG_COPY.noApp).toBe(NO_HARNESS);
  });

  it("the publish checklist names sessions with no harness", () => {
    const list = publishChecklist({ ...CHECKLIST_EMPTY, appless: [{ key: "a", number: 2 }] });
    const item = list.recommended.find((entry) => entry.key === "apps");
    expect(item?.words).toBe("Sessions with no harness");
    expect(item?.detail).toBe("Session 2 has no harness");
    const two = publishChecklist({ ...CHECKLIST_EMPTY, appless: [{ key: "a", number: 2 }, { key: "b", number: 4 }] });
    expect(two.recommended.find((entry) => entry.key === "apps")?.detail).toBe("Sessions 2 and 4 have no harness");
    expect(CHECKLIST_COPY).toBeTruthy();
  });

  it("the agent tile names its harness, with Built in code for none", () => {
    expect(AGENT_SETUP_COPY.runsIn).toBe("Harness");
    expect(AGENT_SETUP_COPY.selectPlatform).toBe("Select a harness");
    expect(AGENT_SETUP_COPY.ownCode).toBe("Built in code (no harness)");
  });
});

describe("SV-27 P1: Hook", () => {
  it("a setup rule is called Hook, and its stored kind stays rule", () => {
    expect(SETUP_KIND_LABEL.rule).toBe("Hook");
    expect(Object.keys(SETUP_KIND_LABEL)).toContain("rule");
  });
});

const CHECKLIST_EMPTY: Parameters<typeof publishChecklist>[0] = {
  missing: [],
  title: "A build",
  description: "",
  cover: null,
  tiles: 1,
  blockers: [],
  threadHold: null,
  reminders: [],
  appless: [],
  cardFilled: true,
};
