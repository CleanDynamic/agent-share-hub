// UX-06 Part 4: the Add to a draft menu. Eight most recently edited drafts then New draft; choosing one copies the step through
// addStepToDraft and the toast says `Added to <draft title>.` with Open draft; signed out it goes to sign in and back.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listDraftsWithSessions = vi.fn();
const addStepToDraft = vi.fn();
const createBuild = vi.fn();
let user: { id: string } | null = { id: "me" };
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));

vi.mock("@/lib/build/drafts", () => ({ listDraftsWithSessions: (id: string) => listDraftsWithSessions(id) }));
vi.mock("@/lib/build/builds", () => ({ createBuild: (input: unknown) => createBuild(input) }));
vi.mock("@/lib/openbuilds/addToDraft", () => ({
  addStepToDraft: (id: string, snapshot: unknown) => addStepToDraft(id, snapshot),
  stepSnapshotFor: async (step: { kind: string; snapshot?: unknown }) => (step.kind === "copy" ? step.snapshot : { type: "prompt" }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { AddToDraftButton } from "./AddToDraft";

let where = "";
function Where() {
  const location = useLocation();
  where = `${location.pathname}${location.search}`;
  return null;
}

function draw() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/openbuilds/topics/p1"]}>
        <Routes>
          <Route path="*" element={<><AddToDraftButton step={{ kind: "copy", snapshot: { type: "prompt", title: "Score" } }} /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const open = () => fireEvent.keyDown(screen.getByRole("button", { name: "Add to a draft" }), { key: "Enter" });

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  user = { id: "me" };
  toast.mockReset();
  addStepToDraft.mockReset().mockResolvedValue(undefined);
  createBuild.mockReset().mockResolvedValue({ id: "d-new", title: "Untitled build" });
  listDraftsWithSessions.mockReset().mockResolvedValue(Array.from({ length: 10 }, (_, n) => ({ id: `d${n + 1}`, title: n === 2 ? "" : `Draft ${n + 1}`, updatedAt: "", sessionCount: 1 })));
});

describe("Add to a draft", () => {
  it("lists the eight most recently edited drafts, then New draft", async () => {
    draw();
    open();
    await screen.findByRole("menuitem", { name: "Draft 1" });
    expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Draft 1", "Draft 2", "Untitled build", "Draft 4", "Draft 5", "Draft 6", "Draft 7", "Draft 8", "New draft"]);
  });

  it("copies the step into the chosen draft and says so, with Open draft", async () => {
    draw();
    open();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Draft 2" }));
    await waitFor(() => expect(addStepToDraft).toHaveBeenCalledWith("d2", { type: "prompt", title: "Score" }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const [message, options] = toast.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }];
    expect(message).toBe("Added to Draft 2.");
    expect(options.action.label).toBe("Open draft");
    options.action.onClick();
    await waitFor(() => expect(where).toBe("/compose/d2"));
  });

  it("makes a new draft for New draft and copies the step into it", async () => {
    draw();
    open();
    fireEvent.click(await screen.findByRole("menuitem", { name: "New draft" }));
    await waitFor(() => expect(addStepToDraft).toHaveBeenCalledWith("d-new", expect.anything()));
    expect(createBuild).toHaveBeenCalledWith({ title: "Untitled build" });
  });

  it("goes to sign in and back, signed out", () => {
    user = null;
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Add to a draft" }));
    expect(where).toBe(`/login?redirect=${encodeURIComponent("/openbuilds/topics/p1")}`);
  });
});
