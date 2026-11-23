// Test helpers for the Optional section (CA-28 P4): its fields are not drawn until the toggle row is pressed.

import { fireEvent, screen } from "@testing-library/react";

/** Press every closed toggle row, with a pointer, and leave it open. */
export function openOptional(): void {
  for (const toggle of screen.queryAllByTestId("optional-toggle")) {
    if (toggle.getAttribute("aria-expanded") !== "true") fireEvent.click(toggle, { detail: 1 });
  }
}

/** A field's label, as it reads on screen. */
export const titleOf = (field: Element): string | null => field.querySelector("[data-testid=optional-title]")?.textContent ?? null;

/** The fields drawn now (none while every section is closed). */
export const drawnFields = (): HTMLElement[] => screen.queryAllByTestId("optional-field");

/** Every field in label order: the sections are opened first. */
export function fieldNames(): (string | null)[] {
  openOptional();
  return drawnFields().map(titleOf);
}

/** The field with this label, opening its section if it is shut. */
export function fieldNamed(name: string): HTMLElement {
  openOptional();
  const found = drawnFields().find((field) => titleOf(field) === name);
  if (!found) throw new Error(`No optional field named "${name}"; there are: ${drawnFields().map(titleOf).join(", ")}`);
  return found;
}

/** Synth 09: a field by its label, wherever it stands: an Optional field (opening its section) or a main row of the window. */
export function placeNamed(name: string): HTMLElement {
  openOptional();
  const optional = drawnFields().find((field) => titleOf(field) === name);
  if (optional) return optional;
  const row = screen.queryAllByTestId("field-row").find((field) => field.querySelector("label, span")?.textContent === name);
  if (row) return row;
  const group = screen.queryAllByRole("group", { name })[0] ?? screen.queryAllByRole("radiogroup", { name })[0];
  if (!group) throw new Error(`No field, row or group named "${name}"`);
  return group;
}
