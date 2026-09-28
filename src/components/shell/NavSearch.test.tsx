import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { NavSearch } from "./NavSearch";

/* ────────────────────────────────────────────────────────────────────────────
   RC-P07 — the desktop search field.

   Rendered inside a router with a readout of the current address, so each
   test asserts where the reader ends up. jsdom does not submit a form when
   Enter is pressed in it, so "Enter" here submits the form, which is what
   Enter in a one-field form does in a browser.
   ──────────────────────────────────────────────────────────────────────────── */

function Address() {
  const location = useLocation();
  return <p data-testid="address">{location.pathname + location.search}</p>;
}

function renderAt(path = "/", extra: React.ReactNode = null) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NavSearch />
      {extra}
      <Routes>
        <Route path="*" element={<Address />} />
      </Routes>
    </MemoryRouter>,
  );
}

const field = () => screen.getByRole("searchbox", { name: "Search builds" });
const address = () => screen.getByTestId("address").textContent;

function enter(text: string) {
  fireEvent.change(field(), { target: { value: text } });
  fireEvent.submit(field().closest("form")!);
}

describe("NavSearch", () => {
  it("Enter with claude goes to /gallery?q=claude", () => {
    renderAt("/");
    enter("claude");
    expect(address()).toBe("/gallery?q=claude");
  });

  it("Enter with a single character does not navigate", () => {
    renderAt("/");
    enter("a");
    expect(address()).toBe("/");
  });

  it("sends the tidied query, encoded", () => {
    renderAt("/");
    enter("  inbox   triage & more ");
    expect(address()).toBe("/gallery?q=inbox%20triage%20%26%20more");
  });

  it('"/" focuses the field', () => {
    renderAt("/");
    const event = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(document.activeElement).toBe(field());
    expect(event.defaultPrevented).toBe(true);
  });

  it('"/" typed in another input stays in that input', () => {
    renderAt("/", <input aria-label="Another field" />);
    const other = screen.getByRole("textbox", { name: "Another field" });
    other.focus();
    const event = new KeyboardEvent("keydown", { key: "/", bubbles: true, cancelable: true });
    other.dispatchEvent(event);
    expect(document.activeElement).toBe(other);
    expect(event.defaultPrevented).toBe(false);
  });

  it("has the control radius, never a pill", () => {
    renderAt("/");
    expect(field().style.borderRadius).toBe("var(--r-control)");
  });

  it("shows the gallery's query on the gallery", () => {
    renderAt("/gallery?q=inbox%20triage");
    expect(field()).toHaveValue("inbox triage");
  });

  it("is one search landmark with a field that stops at 80 characters", () => {
    renderAt("/");
    expect(screen.getAllByRole("search")).toHaveLength(1);
    expect(field()).toHaveAttribute("maxLength", "80");
    expect(field()).toHaveAttribute("placeholder", "Search builds");
  });
});
