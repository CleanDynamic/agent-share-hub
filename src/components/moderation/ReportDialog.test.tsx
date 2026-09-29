// RC-P17b — the report dialog, rendered.
//
// The claims: five reasons as radios, in the order Spam, Doesn't work,
// Harmful, Not theirs, Something else, none chosen; one filled button, and it
// says "Send report"; nothing is sent until a reason is chosen; what is sent is
// the target, the reason and the note; once sent the dialog says "Thanks. An
// admin will look at it."; a refusal is one sentence and the reader's note
// stays where it was, in the box and nowhere else. The data layer is stubbed at
// src/lib/moderation; the dialog is real.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reportTarget = vi.fn();
vi.mock("@/lib/moderation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/moderation")>()),
  reportTarget: (...args: unknown[]) => reportTarget(...args),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { ReportDialog } from "@/components/moderation/ReportDialog";
import { SocialError } from "@/lib/social";

// jsdom has no ResizeObserver, and Radix's radio measures itself with one.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

function open(target: { type: "build" | "comment"; id: string } = { type: "comment", id: "comment-9" }) {
  const onClose = vi.fn();
  render(<ReportDialog target={target} onClose={onClose} />);
  return { dialog: screen.getByTestId("report-dialog"), onClose };
}

const filled = (dialog: HTMLElement) => [...dialog.querySelectorAll('[data-visual-slot="btn-primary"]')];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ReportDialog", () => {
  it("names what is reported", () => {
    const { dialog } = open({ type: "build", id: "build-1" });
    expect(within(dialog).getByRole("heading", { name: "Report this build" })).toBeTruthy();
  });

  it("offers five reasons in order, none chosen, and one filled button that says Send report", () => {
    const { dialog } = open();

    expect(within(dialog).getByRole("heading", { name: "Report this comment" })).toBeTruthy();
    const radios = within(dialog).getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-label"))).toEqual([
      "Spam",
      "Doesn't work",
      "Harmful",
      "Not theirs",
      "Something else",
    ]);
    expect(radios.every((radio) => radio.getAttribute("aria-checked") === "false")).toBe(true);

    expect(filled(dialog).map((button) => button.textContent)).toEqual(["Send report"]);
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "OK" })).toBeNull();
  });

  it("sends nothing until a reason is chosen, then the target, the reason and the note", async () => {
    reportTarget.mockResolvedValue(undefined);
    const { dialog } = open();
    const send = within(dialog).getByRole("button", { name: "Send report" }) as HTMLButtonElement;

    expect(send.disabled).toBe(true);
    fireEvent.click(send);
    expect(reportTarget).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Harmful" }));
    fireEvent.change(within(dialog).getByLabelText("Anything to add? (optional)"), {
      target: { value: "It names a person." },
    });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);

    await waitFor(() =>
      expect(reportTarget).toHaveBeenCalledWith({
        targetType: "comment",
        targetId: "comment-9",
        reason: "harmful",
        note: "It names a person.",
      }),
    );
    expect(await within(dialog).findByText("Thanks. An admin will look at it.")).toBeTruthy();
    expect(filled(dialog)).toHaveLength(0);
  });

  it("holds the note to 500 characters", () => {
    const { dialog } = open();
    expect(within(dialog).getByLabelText("Anything to add? (optional)").getAttribute("maxlength")).toBe("500");
  });

  it("says a refusal in one sentence and keeps the note in the box, and only there", async () => {
    const note = "the maker is Jordan Pike";
    reportTarget.mockRejectedValue(new SocialError("reportTarget", "no_access", { commentId: "comment-9" }, "42501", 403));
    const { dialog } = open();

    fireEvent.click(within(dialog).getByRole("radio", { name: "Something else" }));
    fireEvent.change(within(dialog).getByLabelText("Anything to add? (optional)"), { target: { value: note } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Send report" }));

    const alert = await within(dialog).findByRole("alert");
    expect(alert.textContent).toBe("You don't have access to this.");
    expect((within(dialog).getByLabelText("Anything to add? (optional)") as HTMLTextAreaElement).value).toBe(note);
    expect(alert.textContent).not.toContain("Jordan");
  });

  it("closes on Cancel without sending", () => {
    const { dialog, onClose } = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(reportTarget).not.toHaveBeenCalled();
  });
});
