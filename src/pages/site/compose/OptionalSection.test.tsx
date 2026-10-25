import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalForm, ModalShell, missingLabels, requiredLine } from "./ModalFrame";
import { OptionalField, OptionalSection, summaryOf } from "./OptionalSection";

let phone = false;
beforeEach(() => {
  phone = false;
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: phone && /max-width/.test(query), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rows = () => screen.queryAllByTestId("optional-field");
const toggle = () => screen.getByTestId("optional-toggle");

function section(over: { notesSummary?: string | null; forceOpen?: boolean } = {}) {
  return render(
    <OptionalSection>
      <OptionalField name="Failure notes" description="What went wrong, and what changed before it ran again" summary={over.notesSummary} forceOpen={over.forceOpen}>
        <textarea aria-label="Failure notes field" />
      </OptionalField>
      <OptionalField name="Reviewer">
        <input aria-label="Reviewer field" />
      </OptionalField>
      {false}
      {null}
    </OptionalSection>,
  );
}

describe("OptionalSection (CA-28 P4)", () => {
  it("opens closed: one toggle row with the count, a chevron, and no field drawn", () => {
    section();
    const row = toggle();
    expect(row.tagName).toBe("BUTTON");
    expect(row.getAttribute("aria-expanded")).toBe("false");
    expect(row.getAttribute("aria-controls")).toBe(screen.getByTestId("optional-region").id);
    expect(screen.getByTestId("optional-count").textContent).toBe("2 fields");
    expect(row.textContent).toContain("Optional");
    expect(rows()).toHaveLength(0);
    expect(screen.queryByLabelText("Failure notes field")).toBeNull();
    expect(screen.getByTestId("optional-region").hidden).toBe(true);
  });

  it("counts the fields that hold something: 'Optional · 2 fields · 1 filled'", () => {
    section({ notesSummary: "The total showed 0.00" });
    expect(screen.getByTestId("optional-count").textContent).toBe("2 fields · 1 filled");
  });

  it("opens on a press and shows the fields directly: label, then the hint when there is one, then the input; no per-field row", () => {
    section();
    fireEvent.click(toggle(), { detail: 1 });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(rows()).toHaveLength(2);
    expect(within(rows()[0]).getByTestId("optional-title").textContent).toBe("Failure notes");
    expect(within(rows()[0]).getByTestId("optional-line").textContent).toMatch(/What went wrong/);
    expect(within(rows()[1]).queryByTestId("optional-line")).toBeNull();
    expect(screen.getByLabelText("Failure notes field")).toBeTruthy();
    // Nothing in a field is a button that opens it.
    expect(within(rows()[0]).queryByRole("button")).toBeNull();
    expect(screen.getByTestId("optional-region").hidden).toBe(false);
    // A pointer press does not pull focus into the fields.
    expect(document.activeElement).not.toBe(screen.getByLabelText("Failure notes field"));
  });

  it("opened from the keyboard it moves focus to the first field; closing leaves it on the toggle", () => {
    section();
    toggle().focus();
    fireEvent.click(toggle(), { detail: 0 });
    expect(document.activeElement).toBe(screen.getByLabelText("Failure notes field"));
    fireEvent.click(toggle(), { detail: 0 });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
    expect(rows()).toHaveLength(0);
  });

  it("closes on a second press", () => {
    section();
    fireEvent.click(toggle(), { detail: 1 });
    fireEvent.click(toggle(), { detail: 1 });
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Failure notes field")).toBeNull();
  });

  it("opens by itself when a field holds a value", () => {
    section({ notesSummary: "The total showed 0.00" });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(rows()).toHaveLength(2);
  });

  it("opens by itself when a field starts to hold a value while it is shut (an import filled it)", () => {
    const { rerender } = section();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    rerender(
      <OptionalSection>
        <OptionalField name="Failure notes" summary="Filled by an import">
          <textarea aria-label="Failure notes field" />
        </OptionalField>
        <OptionalField name="Reviewer">
          <input aria-label="Reviewer field" />
        </OptionalField>
      </OptionalSection>,
    );
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
  });

  it("when an error points into a field it opens, and the field takes focus", () => {
    section({ forceOpen: true });
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Failure notes field"));
  });

  it("an error that arrives later opens a shut section, scrolls to the field and focuses it", () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { rerender } = section();
    rerender(
      <OptionalSection>
        <OptionalField name="Failure notes" forceOpen>
          <textarea aria-label="Failure notes field" />
        </OptionalField>
        <OptionalField name="Reviewer">
          <input aria-label="Reviewer field" />
        </OptionalField>
      </OptionalSection>,
    );
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByLabelText("Failure notes field"));
    expect(scroll).toHaveBeenCalled();
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it("is at least 44 tall on a phone", () => {
    phone = true;
    section();
    expect(parseInt(toggle().style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it("draws nothing when it has no field", () => {
    render(<OptionalSection>{null}</OptionalSection>);
    expect(screen.queryByTestId("optional-section")).toBeNull();
  });

  it("joins what a row holds into one line", () => {
    expect(summaryOf("Manual", null, "", "  ")).toBe("Manual");
    expect(summaryOf(["a", " b ", ""], 3)).toBe("a, b · 3");
    expect(summaryOf("line one\nline two")).toBe("line one, line two");
    expect(summaryOf(null, undefined, "")).toBeNull();
  });
});

describe("the modal frame (CA-15 P1)", () => {
  it("says the first thing missing, or that all is complete", () => {
    expect(requiredLine("a URL")).toBe("Required: a URL");
    expect(requiredLine(null)).toBe("Required fields complete");
    expect(missingLabels([[true, "Name"], [false, "URL"], [false, "File"]])).toBe("URL, File");
    expect(missingLabels([[true, "Name"]])).toBeNull();
  });

  function shell(over: { missing: string | null; onSubmit?: () => void; onOpenChange?: (open: boolean) => void }) {
    const onSubmit = over.onSubmit ?? vi.fn();
    const onOpenChange = over.onOpenChange ?? vi.fn();
    render(
      <ModalShell open onOpenChange={onOpenChange} title="Add a thing" subtitle="What the thing is for" testId="add-thing-dialog">
        <ModalForm phone={phone} onSubmit={onSubmit} onCancel={() => onOpenChange(false)} missing={over.missing}>
          <input aria-label="Name" />
        </ModalForm>
      </ModalShell>,
    );
    return { onSubmit, onOpenChange };
  }

  it("has a titled header with its grey line, a body and a footer with the status", () => {
    shell({ missing: "a name" });
    expect(screen.getByRole("dialog", { name: "Add a thing" })).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("What the thing is for");
    expect(screen.getByTestId("modal-status").textContent).toBe("Required: a name");
    expect(screen.getByTestId("modal-body").contains(screen.getByLabelText("Name"))).toBe(true);
    expect(screen.getByTestId("modal-footer").contains(screen.getByRole("button", { name: "Add" }))).toBe(true);
  });

  it("keeps Add disabled until nothing is missing, and does not submit while it is", () => {
    const { onSubmit } = shell({ missing: "a name" });
    const add = screen.getByRole("button", { name: "Add" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.submit(add.closest("form") as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("adds when complete, and Cancel and the close button close it", () => {
    const { onSubmit, onOpenChange } = shell({ missing: null });
    expect(screen.getByTestId("modal-status").textContent).toBe("Required fields complete");
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: /^Close/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it("is a bottom sheet on a phone", () => {
    phone = true;
    shell({ missing: null });
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(screen.getByTestId("modal-subtitle").textContent).toBe("What the thing is for");
  });
});
