// G16: toasts are said politely, errors assertively, once each; none takes focus; an action is a real button.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { toast as sonner } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toaster as SonnerToaster } from "./sonner";
import { Toast, ToastProvider, ToastTitle, ToastViewport } from "./toast";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));

afterEach(() => {
  act(() => {
    sonner.dismiss();
  });
});

const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

describe("G16: the sonner toaster", () => {
  it("says a toast politely and an error toast assertively, once each, and its own region is not live", async () => {
    render(<SonnerToaster />);
    const before = document.activeElement;
    await act(async () => {
      sonner("New build started.", { action: { label: "Open", onClick: () => undefined } });
    });
    await flush();
    expect(screen.getByTestId("toast-polite").textContent).toBe("New build started.");
    await act(async () => {
      sonner.error("Couldn't publish the build. Try again.");
    });
    await flush();
    expect(screen.getByTestId("toast-assertive").textContent).toBe("Couldn't publish the build. Try again.");
    expect(screen.getByTestId("toast-assertive").getAttribute("aria-live")).toBe("assertive");
    expect(screen.getByTestId("toast-polite").getAttribute("aria-live")).toBe("polite");
    const region = document.querySelector('section[aria-label^="Notifications"]');
    expect(region?.getAttribute("aria-live")).toBe("off");
    expect(document.activeElement).toBe(before);
  });

  it("an action is a button that works with Enter", async () => {
    const onOpen = vi.fn();
    render(<SonnerToaster />);
    await act(async () => {
      sonner("Replied.", { action: { label: "Open topic", onClick: onOpen } });
    });
    await flush();
    const action = screen.getByRole("button", { name: "Open topic" });
    action.focus();
    fireEvent.keyDown(action, { key: "Enter" });
    fireEvent.click(action);
    expect(onOpen).toHaveBeenCalled();
  });
});

describe("G16: the radix toaster", () => {
  it("is polite by default and assertive for the destructive variant", async () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Saved.</ToastTitle>
        </Toast>
        <Toast open variant="destructive">
          <ToastTitle>Couldn&apos;t save. Try again.</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );
    // Radix announces each toast through a live region of its own, in the toasts' order (jsdom does not run the frame that
    // fills the words in, so the regions' politeness is what is read here).
    await flush();
    const live = Array.from(document.querySelectorAll("[aria-live]")).map((el) => el.getAttribute("aria-live"));
    expect(live).toEqual(["polite", "assertive"]);
  });
});
