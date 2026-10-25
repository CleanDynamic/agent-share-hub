// CA-27 P1: "/" is the header search's key anywhere it is not taken; the build page takes it for Find in build, and the header leaves it.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import { HeaderSearch } from "./HeaderSearch";
import { NavSearch } from "./NavSearch";

afterEach(cleanup);

const press = () => fireEvent.keyDown(document.body, { key: "/" });

describe.each([
  ["HeaderSearch", () => <HeaderSearch onSubmit={() => undefined} />],
  ["NavSearch", () => <NavSearch />],
])("%s", (_name, make) => {
  it("takes the focus on /", () => {
    render(<MemoryRouter>{make()}</MemoryRouter>);
    press();
    expect(document.activeElement).toBe(screen.getByRole("searchbox", { hidden: true }) ?? screen.getByRole("textbox"));
  });

  it("leaves the key to a page that has already taken it", () => {
    render(<MemoryRouter>{make()}</MemoryRouter>);
    const taken = (event: KeyboardEvent) => event.preventDefault();
    document.addEventListener("keydown", taken);
    try {
      press();
    } finally {
      document.removeEventListener("keydown", taken);
    }
    expect(document.activeElement).toBe(document.body);
  });
});
