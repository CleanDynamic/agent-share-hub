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

const rows = () => screen.getAllByTestId("optional-field");

function section(over: { notesSummary?: string | null; forceOpen?: boolean } = {}) {
  return render(
    <OptionalSection>
      <OptionalField name="Failure notes" description="What went wrong, and what changed before it ran again" summary={over.notesSummary} forceOpen={over.forceOpen}>
        <textarea aria-label="Failure notes field" />
      </OptionalField>
      <OptionalField name="Reviewer" description="Who judged it">
        <input aria-label="Reviewer field" />
      </OptionalField>
      {false}
      {null}
    </OptionalSection>,
  );
}

describe("OptionalSection (CA-15 P1)", () => {
  it("starts with every row closed, counts its fields in mono, and announces closed", () => {
    section();
    expect(screen.getByRole("heading", { name: "Optional" })).toBeTruthy();
    expect(screen.getByTestId("optional-count").textContent).toBe("2 fields");
    for (const row of rows()) {
      expect(within(row).getByRole("button").getAttribute("aria-expanded")).toBe("false");
    }
    expect(screen.queryByLabelText("Failure notes field")).toBeNull();
    expect(screen.getByText("Who judged it")).toBeTruthy();
  });

  it("opens a row from the keyboard, announces open, and moves focus into its field", () => {
    section();
    const head = within(rows()[0]).getByRole("button");
    // A keyboard press arrives as a click with no pointer (detail 0).
    fireEvent.click(head, { detail: 0 });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    const field = screen.getByLabelText("Failure notes field");
    expect(document.activeElement).toBe(field);
    expect(within(rows()[0]).getByRole("region")).toBeTruthy();
    // The other row stays closed; several can be open at once.
    fireEvent.click(within(rows()[1]).getByRole("button"), { detail: 1 });
    expect(head.getAttribute("aria-expanded")).toBe("true");
    expect(within(rows()[1]).getByRole("button").getAttribute("aria-expanded")).toBe("true");
    // A pointer opening does not pull focus.
    expect(document.activeElement).toBe(field);
  });

  it("closes again on a second press", () => {
    section();
    const head = within(rows()[0]).getByRole("button");
    fireEvent.click(head);
    fireEvent.click(head);
    expect(head.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Failure notes field")).toBeNull();
  });

  it("shows a filled row's value at the right, and keeps its description (CA-15b)", () => {
    section({ notesSummary: "The total showed 0.00" });
    const first = rows()[0];
    expect(within(first).getByTestId("optional-value").textContent).toBe("The total showed 0.00");
    expect(within(first).getByTestId("optional-line").textContent).toMatch(/What went wrong/);
    // An empty row still says what goes there.
    expect(within(rows()[1]).getByTestId("optional-line").textContent).toBe("Who judged it");
  });

  it("opens on its own when told to", () => {
    section({ forceOpen: true });
    expect(within(rows()[0]).getByRole("button").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Failure notes field")).toBeTruthy();
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
