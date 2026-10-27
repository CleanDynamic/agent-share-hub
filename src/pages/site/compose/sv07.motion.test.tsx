// SV-07 P4: every change in this prompt's paths tells SV-06's animator what it is about to do, with its keys, before the model
// changes; and nothing in them scrolls by itself but through SV-06's helper. On the real page.

import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { MotionChannel, type MotionLabel } from "./listMotion";
import { CHATS, making, mount, partKeys, pickChat, settled, setUp, tearDown } from "./sv07Harness";

vi.setConfig({ testTimeout: 120_000 });

beforeEach(setUp);
afterEach(tearDown);

const enabled = (testId: string) => waitFor(() => expect((screen.getByTestId(testId) as HTMLButtonElement).disabled).toBe(false), { timeout: 15_000 });
const order = () => ((making() as { session_order?: string[] } | undefined)?.session_order ?? []);

/** Opens a session's options menu and chooses an item, or an item of its submenu. */
async function sessionMenu(number: number, item: string, sub?: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Session ${number} options` }), { key: "Enter" });
  const row = await screen.findByRole("menuitem", { name: new RegExp(`^${item}`) });
  if (!sub) return act(() => fireEvent.click(row));
  fireEvent.keyDown(row, { key: "ArrowRight" });
  const inner = await screen.findByRole("menuitem", { name: sub });
  act(() => fireEvent.click(inner));
}

describe("SV-07 P4 · each action labels its change for the animator", () => {
  it("import, Add a part, Start a new session, Move to part, Move up, remove, Undo and Redo", async () => {
    const labels: MotionLabel[] = [];
    const real = MotionChannel.prototype.expect;
    vi.spyOn(MotionChannel.prototype, "expect").mockImplementation(function (this: MotionChannel, label: MotionLabel) {
      labels.push(label);
      return real.call(this, label);
    });
    /** The label the action ended on: the newest wins (SV-06). */
    const last = () => labels.at(-1);
    mount([]);

    fireEvent.click(screen.getByTestId("empty-build-chats"));
    await pickChat(CHATS[0].name);
    expect(last()).toMatchObject({ kind: "add", keys: [CHATS[0].id] });
    await settled(1);

    act(() => fireEvent.click(screen.getByTestId("add-part-row")));
    expect(last()?.kind).toBe("part");
    await waitFor(() => expect(partKeys()).toHaveLength(2), { timeout: 15_000 });
    expect(last()?.keys).toEqual([partKeys()[1]]);
    await enabled("add-part-row");

    fireEvent.click(screen.getByTestId("add-session-row"));
    act(() => fireEvent.click(screen.getByRole("button", { name: /Start a new session/ })));
    expect(last()?.kind).toBe("add");
    const started = last()?.keys[0] as string;
    expect(started).toMatch(/^typed-/);
    await settled(2);
    expect(order()).toContain(started);

    await sessionMenu(2, "Move to part…", "Part 1");
    expect(last()).toMatchObject({ kind: "move", keys: [started] });
    await waitFor(() => expect(order()).toEqual([CHATS[0].id, started]), { timeout: 15_000 });

    await sessionMenu(2, "Move up");
    expect(last()).toMatchObject({ kind: "move", keys: [started] });
    await waitFor(() => expect(order()).toEqual([started, CHATS[0].id]), { timeout: 15_000 });

    await sessionMenu(1, "Remove session");
    expect(last()).toMatchObject({ kind: "remove", keys: [started] });
    await waitFor(() => expect(order()).toEqual([CHATS[0].id]), { timeout: 15_000 });

    act(() => fireEvent.keyDown(document.body, { key: "z", ctrlKey: true }));
    await waitFor(() => expect(last()?.kind).toBe("undo"), { timeout: 15_000 });
    await waitFor(() => expect(order()).toContain(started), { timeout: 15_000 });
    act(() => fireEvent.keyDown(document.body, { key: "z", ctrlKey: true, shiftKey: true }));
    await waitFor(() => expect(last()?.kind).toBe("redo"), { timeout: 15_000 });
    await waitFor(() => expect(order()).toEqual([CHATS[0].id]), { timeout: 15_000 });
  });
});

describe("SV-07 P4 · no scroll of its own in these paths", () => {
  const source = (file: string) => readFileSync(join(process.cwd(), "src/pages/site/compose", file), "utf8");

  it("nothing scrolls to the top, and no scrollIntoView is left in the add, part and move paths", () => {
    for (const file of ["useSessionEdits.ts", "AddSessionRow.tsx", "WorkstreamHead.tsx", "SessionHead.tsx", "sessionModel.ts", "arrival.tsx"]) {
      expect(source(file), file).not.toMatch(/scrollIntoView|scrollTo\(\s*0|top:\s*0,\s*behavior/);
    }
    const page = source("SandboxPage.tsx");
    for (const name of ["insertSession", "onStartSession", "onAddSession", "onJump"]) {
      const at = page.indexOf(`const ${name} = `);
      expect(at, name).toBeGreaterThan(-1);
      expect(page.slice(at, page.indexOf("\n  );", at) > 0 ? page.indexOf("\n  );", at) : at + 4000), name).not.toMatch(/scrollIntoView|scrollTo\(/);
    }
    // The session just added is scrolled to through the helper alone.
    const ringed = page.slice(page.indexOf("if (!ringedSession) return;"), page.indexOf("}, [ringedSession]);"));
    expect(ringed).toMatch(/scrollToShow\(/);
    expect(ringed).not.toMatch(/scrollIntoView/);
  });
});
