// CA-17 P5 — the @ picker with parts: the search and the button say part, session or tile; a part's row leads its
// sessions, which step in a level; searching finds a part by its title.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionGroup, Step } from "@/lib/build/graph";
import { refGroups } from "@/lib/build/postRefs";

import { REFERENCE_COPY, ReferencePicker } from "./ReferencePicker";

afterEach(cleanup);

const step = (id: string, number: string): Step =>
  ({ id, kind: "prompt", number, title: null, defaultTitle: `Prompt ${number}`, text: "Words", words: 1, model: null, sessionId: null, tool: null, runs: null, uses: [], children: [] }) as Step;
const group = (key: string, number: number): SessionGroup =>
  ({ key, kind: "typed", sessionId: null, number, tool: "Claude", model: null, startedAt: "2026-10-09", stepNumbers: [String(number)] }) as SessionGroup;

const steps = [step("a", "1"), step("b", "2")];
const groups = [group("typed-1", 1), group("typed-2", 2)];
const making = {
  part_labels: "letters",
  workstreams: [{ key: "ws-a", name: "Tenant portal", colour: "#8FBFB8" }, { key: "ws-b", name: "Support agent" }],
  sessions_meta: { "typed-1": { tool: null, date: "2026-10-09" }, "typed-2": { tool: null, date: "2026-10-09", workstream: "ws-b" } },
};

function mount(withParts: boolean, phone = false) {
  const onChoose = vi.fn();
  render(<ReferencePicker open groups={refGroups({ steps, groups, making: withParts ? making : undefined })} current={null} anchor={{ top: 10, left: 10 }} phone={phone} onChoose={onChoose} onRemove={vi.fn()} onClose={vi.fn()} />);
  return onChoose;
}

describe("the picker's words", () => {
  it("say 'Find a part, session or tile' with parts, and as they were without", () => {
    mount(true);
    expect(screen.getByRole("combobox", { name: REFERENCE_COPY.searchWithParts })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: REFERENCE_COPY.buttonWithParts })).toBeTruthy();
    cleanup();
    mount(false);
    expect(screen.getByRole("combobox", { name: REFERENCE_COPY.search })).toBeTruthy();
    expect(screen.getByRole("listbox", { name: REFERENCE_COPY.button })).toBeTruthy();
  });
  it("are 'Link to a part, session or tile' on the sheet a phone gets", () => {
    mount(true, true);
    expect(screen.getAllByText(REFERENCE_COPY.buttonWithParts).length).toBeGreaterThan(0);
  });
});

describe("the rows", () => {
  it("lead with a part's row (its letter, 'The whole part · name', kind Part, a bar for its colour), then its sessions a level in", () => {
    mount(true);
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.getAttribute("data-ref-option"))).toEqual(["workstream:ws-a", "session:typed-1", "node:a", "workstream:ws-b", "session:typed-2", "node:b"]);
    const part = options[0];
    expect(part.textContent).toContain("A");
    expect(part.textContent).toContain("The whole part · Tenant portal");
    expect(part.textContent).toContain("Part");
    expect(part.querySelector("[data-colour-bar]")).toBeTruthy();
    expect(options[3].querySelector("[data-colour-bar]")).toBeNull();
    // A session steps in 12, as a nested tile does.
    expect(options[1].style.paddingLeft).toBe("20px");
    expect(options[0].style.paddingLeft).toBe("8px");
  });
  it("choose a part, and find one by its title", () => {
    const onChoose = mount(true);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "support" } });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    fireEvent.click(options[0]);
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ to: "workstream:ws-b", kind: "Part" }));
    expect(within(screen.getByRole("listbox")).queryByText("Nothing has that name")).toBeNull();
  });
});
