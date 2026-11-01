// SV-30 P10: the build page draws the SDLC fixture: a session's facts line, its output links under Show readers, each prompt's origin,
// the Check's measurement, and the code with the part it belongs to and where it runs.

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildStepsFixture } from "@/dev/fixtures/buildSteps";
import { sessionsSdlcMaking, sessionsSdlcTree } from "@/dev/fixtures/sessions/sdlc";
import type { Making } from "@/lib/build/making";
import { readerSteps } from "@/lib/build/readerSteps";

import { StepsList } from "./BuildSteps";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function page() {
  const view = buildStepsFixture("sessions-sdlc");
  render(
    <MemoryRouter>
      <StepsList view={view} phone={false} announce={() => undefined} />
    </MemoryRouter>,
  );
}

describe("SV-30: the SDLC session on the build page", () => {
  it("says the head in one line, and the rest as labelled lines of their own", () => {
    page();
    expect(screen.getByTestId("facts-line").textContent).toBe("Claude Opus 4.5 (claude-opus-4-5-20251101) · Reasoning effort: high · Cloud sandbox · Isolation: git worktree · Could install packages · Ran in the background");
    expect(screen.getAllByTestId("session-detail-line").map((node) => node.textContent)).toEqual([
      "Access: code (write) · tests (write) · run the app (write) · production logs (read) · deploy (write) · feature flags (write) · issues (write)",
      "Produced: 3 commits · 1 pull request",
      "Length: 3,714 messages · 2 compactions",
      "Human review: high-blast-radius files only (vm/boot.ts, db/migrations/0042_boot_cache.sql)",
    ]);
    expect(screen.getByTestId("goal-line").textContent).toContain("Worked until VM speed 2x · baseline 1x · reached 2.1x");
  });
  it("lists the output links, opening from the head, only because Show readers is ticked", () => {
    page();
    const outputs = screen.getByTestId("outputs");
    fireEvent.click(within(outputs).getByRole("button", { name: /Show the links/ }));
    expect(within(outputs).getAllByRole("link")).toHaveLength(4);
    expect(within(outputs).getAllByRole("link")[0].getAttribute("href")).toBe("https://github.com/acme/vm/commit/a1b2c3d");
  });
  it("hides the output links and their count from readers when Show readers is off", () => {
    const { showOutputs: _shown, ...meta } = sessionsSdlcMaking.sessions_meta[Object.keys(sessionsSdlcMaking.sessions_meta)[0]];
    const making = { ...sessionsSdlcMaking, sessions_meta: { [Object.keys(sessionsSdlcMaking.sessions_meta)[0]]: meta } } as unknown as Making;
    const chat = readerSteps(sessionsSdlcTree, making, new Map())[0].chat;
    expect(chat && chat.kind === "new" ? chat.outputs : "missing").toBeUndefined();
    expect(chat && chat.kind === "new" ? (chat.lines ?? []).join(" ") : "").not.toContain("commits");
  });
  it("shows each prompt's origin before its text, and what it asks for", () => {
    page();
    const origins = screen.getAllByTestId("prompt-origin").map((node) => node.textContent);
    expect(origins).toEqual(["Asks for an outcome", "Wake-up set by the agent · Asks for an outcome", "Heartbeat · daily 09:00 · Asks for a procedure"]);
  });
  it("shows the Check's measurement, and the code with its part and where it runs", () => {
    page();
    expect(screen.getAllByTestId("reader-facts").map((node) => node.textContent).join(" ")).toContain("Boot time · Before 120 ms · after 58 ms · 20 runs");
    expect(screen.getAllByTestId("code-part-line").map((node) => node.textContent)).toEqual(["App", "Eval harness · Terminal 2, in the harness folder", "CI configuration · GitHub Actions"]);
  });
});

