// UX-05 Part 3: Settings and Make a space, by role and accessible name.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSpaceCrowd = vi.fn();
const updateSpace = vi.fn();
const createSpace = vi.fn();
const listSpaces = vi.fn();
const listMySpaces = vi.fn();
const addModeratorByHandle = vi.fn();
let user: { id: string } | null = { id: "u1" };

vi.mock("@/lib/openbuilds", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/openbuilds")>()),
  getSpaceCrowd: (...args: unknown[]) => getSpaceCrowd(...args),
  updateSpace: (...args: unknown[]) => updateSpace(...args),
  createSpace: (...args: unknown[]) => createSpace(...args),
  listSpaces: (...args: unknown[]) => listSpaces(...args),
  listMySpaces: () => listMySpaces(),
  addModeratorByHandle: (...args: unknown[]) => addModeratorByHandle(...args),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user, loading: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { SpaceWindow } from "./SpaceWindow";

const space = {
  id: "s1",
  slug: "evals",
  name: "Evals",
  description: "Scoring work",
  rules: "Be kind.",
  creatorId: "u1",
  whoCanPost: "members",
  postOrder: "newest",
  defaultView: "thread",
  rewardsAllowed: true,
  reactions: [],
  createdAt: "2026-10-01T00:00:00Z",
};
const crowd = (role: string) => ({ space, creator: { id: "u1", handle: "sam" }, moderators: [{ id: "u1", handle: "sam", name: "Sam", avatarUrl: null }], members: 3, role });

let where = "";
function Where() {
  where = useLocation().pathname;
  return null;
}

function draw(props: { mode: "make" | "settings"; slug?: string }, onClose = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SpaceWindow {...props} onClose={onClose} />
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return onClose;
}

beforeEach(() => {
  user = { id: "u1" };
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("min-width"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  getSpaceCrowd.mockReset().mockResolvedValue(crowd("moderator"));
  updateSpace.mockReset().mockResolvedValue(space);
  createSpace.mockReset().mockImplementation(async (input: { slug: string }) => ({ ...space, slug: input.slug }));
  listSpaces.mockReset().mockResolvedValue({ spaces: [{ ...space, id: "s2", slug: "other", name: "Other space", whoCanPost: "invite", rules: "No ads.", postOrder: "pinned_first", defaultView: "wall", rewardsAllowed: false, reactions: ["rating"] }], next: null });
  listMySpaces.mockReset().mockResolvedValue([]);
  addModeratorByHandle.mockReset().mockResolvedValue({ id: "u2", handle: "ola" });
});

describe("Settings", () => {
  it("has every setting, by role and accessible name, and the footer's Cancel and Save", async () => {
    draw({ mode: "settings", slug: "evals" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Only you and your moderators see this")).toBeInTheDocument();
    const who = screen.getByRole("radiogroup", { name: "Who can post" });
    expect(within(who).getAllByRole("radio").map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)).toEqual(["Anyone", "Members", "Invite only"]);
    await waitFor(() => expect(within(who).getByRole("radio", { name: "Members" })).toBeChecked());
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Rules" })).toHaveValue("Be kind.");
    expect(within(screen.getByRole("radiogroup", { name: "Order posts by" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Newest", "Most replied", "Pinned first"]);
    expect(within(screen.getByRole("radiogroup", { name: "Open posts in" })).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["Thread", "Wall"]);
    expect(screen.getByRole("switch", { name: "Allow rewards on posts" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dislike" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Rating" })).not.toBeChecked();
    expect(screen.getByText("Off unless you turn them on")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start from another space's settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("saves what changed", async () => {
    const onClose = draw({ mode: "settings", slug: "evals" });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Members" })).toBeChecked());
    fireEvent.click(screen.getByRole("radio", { name: "Invite only" }));
    fireEvent.click(screen.getByRole("radio", { name: "Wall" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Rating" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Rules" }), { target: { value: "Be kind.\nShow the build." } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateSpace).toHaveBeenCalledWith("s1", { whoCanPost: "invite", rules: "Be kind.\nShow the build.", postOrder: "newest", defaultView: "wall", rewardsAllowed: true, reactions: ["rating"] }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("copies another space's settings, not its name, description or members", async () => {
    draw({ mode: "settings", slug: "evals" });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Members" })).toBeChecked());
    await waitFor(() => expect(listSpaces).toHaveBeenCalled());
    fireEvent.keyDown(screen.getByRole("button", { name: "Start from another space's settings" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Other space" }));
    expect(screen.getByRole("radio", { name: "Invite only" })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Rules" })).toHaveValue("No ads.");
    expect(screen.getByRole("radio", { name: "Wall" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Allow rewards on posts" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Rating" })).toBeChecked();
  });

  it("adds a moderator by @handle", async () => {
    draw({ mode: "settings", slug: "evals" });
    await waitFor(() => expect(screen.getByRole("radio", { name: "Members" })).toBeChecked());
    fireEvent.change(screen.getByRole("textbox", { name: "Moderator handle" }), { target: { value: "@ola" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(addModeratorByHandle).toHaveBeenCalledWith("s1", "@ola"));
    expect(await screen.findByRole("img", { name: "ola" })).toBeInTheDocument();
  });

  it("is read-only for a moderator who is not the creator: no Save, no roles, a line saying why", async () => {
    user = { id: "u2" };
    getSpaceCrowd.mockResolvedValue(crowd("moderator"));
    draw({ mode: "settings", slug: "evals" });
    expect(await screen.findByText("Only the person who made this space can change these.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Moderators" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Start from another space's settings" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Rules" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("Make a space", () => {
  it("asks for a name, a description and who can post, and nothing else", async () => {
    draw({ mode: "make" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Who can post" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Rules" })).toBeNull();
    expect(screen.getByRole("button", { name: "Make space" })).toBeInTheDocument();
  });

  it("asks for a name first", async () => {
    draw({ mode: "make" });
    fireEvent.click(await screen.findByRole("button", { name: "Make space" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Give the space a name.");
    expect(createSpace).not.toHaveBeenCalled();
  });

  it("makes the space with the defaults and lands the reader on it", async () => {
    const onClose = draw({ mode: "make" });
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), { target: { value: "Hiring tools" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Screeners and scorers" } });
    fireEvent.click(screen.getByRole("radio", { name: "Members" }));
    fireEvent.click(screen.getByRole("button", { name: "Make space" }));
    await waitFor(() => expect(createSpace).toHaveBeenCalledWith({ slug: "hiring-tools", name: "Hiring tools", description: "Screeners and scorers", whoCanPost: "members" }));
    await waitFor(() => expect(where).toBe("/openbuilds/spaces/hiring-tools"));
    expect(onClose).toHaveBeenCalled();
  });
});
