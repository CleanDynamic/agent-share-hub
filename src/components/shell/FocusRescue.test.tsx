// G17: after something is removed, focus goes to the next item, else the previous, else the list's heading; a dialog that
// closes with no trigger to go back to hands focus to the page's h1. It never falls to the body.

import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { FocusRescue } from "./FocusRescue";

function Drafts({ start }: { start: string[] }) {
  const [items, setItems] = useState(start);
  return (
    <main>
      <h1>Page</h1>
      <h2>Drafts</h2>
      {items.length ? (
        <ul>
          {items.map((name) => (
            <li key={name}>
              <a href={`#${name}`}>{name}</a>
              <button type="button" onClick={() => setItems((all) => all.filter((n) => n !== name))}>
                {`Delete ${name}`}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No drafts.</p>
      )}
    </main>
  );
}

// Past the moment FocusRescue leaves for focus to be given back (HAND_BACK_MS).
const flush = () => act(async () => new Promise((resolve) => setTimeout(resolve, 120)));

async function remove(name: string) {
  const button = screen.getByRole("button", { name: `Delete ${name}` });
  button.focus();
  await act(async () => button.click());
  await flush();
}

describe("G17: focus after a removal", () => {
  it("goes to the same control of the next item", async () => {
    render(<><FocusRescue /><Drafts start={["a", "b", "c"]} /></>);
    await remove("b");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete c" }));
  });

  it("goes to the previous item when the last is removed", async () => {
    render(<><FocusRescue /><Drafts start={["a", "b"]} /></>);
    await remove("b");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Delete a" }));
  });

  it("goes to the list's heading when nothing is left", async () => {
    render(<><FocusRescue /><Drafts start={["a"]} /></>);
    await remove("a");
    const heading = screen.getByRole("heading", { name: "Drafts" });
    expect(document.activeElement).toBe(heading);
    expect(heading.tabIndex).toBe(-1);
  });

  it("a dialog with no trigger to go back to hands focus to the page's h1", async () => {
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <main>
          <h1>Home</h1>
          <h2>Later</h2>
          {open ? (
            <div role="dialog" aria-label="Sign in">
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          ) : null}
        </main>
      );
    }
    render(<><FocusRescue /><Page /></>);
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    await act(async () => close.click());
    await flush();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Home" }));
  });

  it("leaves focus alone when something else placed it", async () => {
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <main>
          <h1>Home</h1>
          <button type="button" id="opener">
            Opener
          </button>
          {open ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                document.getElementById("opener")?.focus();
              }}
            >
              Close
            </button>
          ) : null}
        </main>
      );
    }
    render(<><FocusRescue /><Page /></>);
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    await act(async () => close.click());
    await flush();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Opener" }));
  });

  it("waits for a dialog that hands focus back a moment after it closes (Radix does so on a timer)", async () => {
    function Page() {
      const [open, setOpen] = useState(true);
      return (
        <main>
          <h1>Home</h1>
          <button type="button" id="opener">
            Opener
          </button>
          {open ? (
            <div role="dialog" aria-label="Step">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  // As the editor's windows do (returnFocus): give focus back only if nobody else has placed it.
                  window.setTimeout(() => {
                    if (document.activeElement === document.body) document.getElementById("opener")?.focus();
                  }, 0);
                }}
              >
                Close
              </button>
            </div>
          ) : null}
        </main>
      );
    }
    render(<><FocusRescue /><Page /></>);
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    await act(async () => close.click());
    await act(async () => new Promise((resolve) => setTimeout(resolve, 150)));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Opener" }));
  });
});
