// UX-15 P6: Your data. The download's states and size, the hourly limit's sentence, the delete window's statement and typing rule, the
// call that deletes, and the Privacy policy's new sentences. (The export's contents and the delete steps are in src/test/security.)

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sb = vi.hoisted(() => ({ invoke: vi.fn(), signOut: vi.fn(async () => ({ error: null })) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: sb.invoke }, auth: { signOut: sb.signOut }, rpc: vi.fn(), from: vi.fn() } }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));
const toasts = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: Object.assign(toasts, { error: toasts }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: { username: "ava" } }) }));

import { privacy } from "@/content/legal/privacy";
import { textsOf } from "@/content/legal/types";
import { DATA_COPY, DELETE_STATEMENT, deleteMyAccount, formatBytes, prepareExport, typingMatches, type PreparedExport } from "@/lib/settings/data";
import { SettingsError } from "@/lib/settings/useAction";

import { DataSection } from "./containers";
import { DataView } from "./DataView";

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

const file: PreparedExport = { fileName: "openbuilds-data-ava-2026-11-07.json", text: "{}", bytes: 1_400_000, incomplete: [] };

describe("the helpers", () => {
  it("matches the username in any case and ignores spaces round it, and never an empty one", () => {
    expect(typingMatches("Ava", "ava")).toBe(true);
    expect(typingMatches("  AVA ", "ava")).toBe(true);
    expect(typingMatches("av", "ava")).toBe(false);
    expect(typingMatches("", "")).toBe(false);
    expect(typingMatches("ava", null)).toBe(false);
  });

  it("shows a size", () => {
    expect(formatBytes(312)).toBe("312 bytes");
    expect(formatBytes(1)).toBe("1 byte");
    expect(formatBytes(820_000)).toBe("820 KB");
    expect(formatBytes(1_400_000)).toBe("1.4 MB");
  });

  it("states what deleting removes, matching the database", () => {
    expect(DELETE_STATEMENT).toBe(
      "Deleting your account removes your profile, your builds, drafts, topics, replies, comments, likes, follows, saves, collections and messages you sent. Rebuilds other people made from your builds stay, and say the original was removed. Replies in other people's topics are replaced by \"This reply was removed\" so the conversation still makes sense. This can't be undone.",
    );
  });

  it("turns the function's 429 into the sentence with the minutes, rounded up", async () => {
    sb.invoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: "rate_limited", waitSeconds: 1500 }), { status: 429 }) } });
    await expect(prepareExport()).rejects.toThrow("You can download again in 25 minutes.");
    expect(DATA_COPY.rateLimited(1)).toBe("You can download again in 1 minute.");
  });

  it("measures the file it was given", async () => {
    sb.invoke.mockResolvedValueOnce({ data: { fileName: "openbuilds-data-ava-2026-11-07.json", file: { incomplete: ["notifications"], data: {} } }, error: null });
    const prepared = await prepareExport();
    expect(prepared.fileName).toBe("openbuilds-data-ava-2026-11-07.json");
    expect(prepared.bytes).toBe(new TextEncoder().encode(prepared.text).length);
    expect(prepared.incomplete).toEqual(["notifications"]);
  });

  it("deletes with the typed username and clears this browser's session", async () => {
    sb.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await deleteMyAccount("ava");
    expect(sb.invoke).toHaveBeenCalledWith("delete-my-account", { method: "POST", body: { confirm: "ava" } });
    expect(sb.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("passes the function's sentence on when the delete is refused", async () => {
    sb.invoke.mockResolvedValueOnce({ data: null, error: { context: new Response(JSON.stringify({ error: "Type your username to confirm." }), { status: 400 }) } });
    await expect(deleteMyAccount("bob")).rejects.toThrow("Type your username to confirm.");
    expect(sb.signOut).not.toHaveBeenCalled();
  });
});

const view = (over: Partial<Parameters<typeof DataView>[0]> = {}) => (
  <MemoryRouter>
    <DataView username="ava" onPrepare={vi.fn(async () => file)} onSave={vi.fn()} onDelete={vi.fn(async () => undefined)} {...over} />
  </MemoryRouter>
);

describe("Download your data", () => {
  it("prepares the file, shows its name and size, and saves only when asked", async () => {
    const onPrepare = vi.fn(async () => file);
    const onSave = vi.fn();
    render(view({ onPrepare, onSave }));
    fireEvent.click(screen.getByRole("button", { name: "Download your data" }));
    expect(await screen.findByText("openbuilds-data-ava-2026-11-07.json · 1.4 MB")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save file" }));
    expect(onSave).toHaveBeenCalledWith(file);
  });

  it("says when to come back, in the form's error style, when the hour has not passed", async () => {
    const onPrepare = vi.fn(async () => { throw new SettingsError("You can download again in 25 minutes."); });
    render(view({ onPrepare }));
    fireEvent.click(screen.getByRole("button", { name: "Download your data" }));
    const message = await screen.findByText("You can download again in 25 minutes.");
    expect(message.getAttribute("data-testid")).toBe("field-message");
  });

  it("says the file is not whole when a source could not be read", async () => {
    render(view({ onPrepare: vi.fn(async () => ({ ...file, incomplete: ["messages_sent"] })) }));
    fireEvent.click(screen.getByRole("button", { name: "Download your data" }));
    expect(await screen.findByText(/this file is not whole: messages_sent/)).toBeTruthy();
  });
});

describe("Delete account", () => {
  it("is a box at the foot of the page, after the download", () => {
    render(view());
    const groups = screen.getAllByRole("region").map((g) => g.getAttribute("aria-label"));
    expect(groups).toEqual(["Download your data", "Delete account"]);
  });

  it("opens a window with the statement, and Delete my account stays off until the username is typed", async () => {
    const onDelete = vi.fn(async () => undefined);
    render(view({ onDelete }));
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const window = await screen.findByTestId("delete-account-window");
    expect(within(window).getByText(DELETE_STATEMENT)).toBeTruthy();
    const confirm = within(window).getByRole("button", { name: "Delete my account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(window).getByLabelText("Your username"), { target: { value: "av" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(window).getByLabelText("Your username"), { target: { value: "AVA" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("AVA"));
  });

  it("offers Download your data first, which saves the file before anything is deleted", async () => {
    const onPrepare = vi.fn(async () => file);
    const onSave = vi.fn();
    const onDelete = vi.fn(async () => undefined);
    render(view({ onPrepare, onSave, onDelete }));
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const window = await screen.findByTestId("delete-account-window");
    fireEvent.click(within(window).getByRole("button", { name: "Download your data first" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(file));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows a refusal and keeps the window open", async () => {
    const onDelete = vi.fn(async () => { throw new SettingsError("Couldn't finish deleting your account (rows). Try again: it carries on where it stopped."); });
    render(view({ onDelete }));
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const window = await screen.findByTestId("delete-account-window");
    fireEvent.change(within(window).getByLabelText("Your username"), { target: { value: "ava" } });
    fireEvent.click(within(window).getByRole("button", { name: "Delete my account" }));
    expect(await within(window).findByText(/Couldn't finish deleting your account/)).toBeTruthy();
    expect(screen.getByTestId("delete-account-window")).toBeTruthy();
  });
});

describe("the container", () => {
  it("lands on / and says Your account was deleted", async () => {
    sb.invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/settings/data"]}>
          <Routes>
            <Route path="/settings/data" element={<DataSection />} />
            <Route path="/" element={<span data-testid="home">home</span>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const window = await screen.findByTestId("delete-account-window");
    fireEvent.change(within(window).getByLabelText("Your username"), { target: { value: "ava" } });
    fireEvent.click(within(window).getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByTestId("home")).toBeTruthy();
    expect(toasts).toHaveBeenCalledWith("Your account was deleted.");
  });
});

describe("the Privacy policy", () => {
  const said = textsOf(privacy).join("\n");

  it("names both self-serve paths, Settings › Your data, beside the contact email", () => {
    expect(said).toContain("You can download your data and delete your account yourself, in Settings › Your data.");
    expect(said).toContain("email {{NEED: privacy contact email}}");
    expect(said).not.toContain("There is no button");
  });

  it("says deletion is immediate apart from backups", () => {
    expect(said).toContain("Deleting is immediate apart from backups");
  });
});
