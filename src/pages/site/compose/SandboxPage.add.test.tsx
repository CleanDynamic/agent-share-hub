// CA-10 Part 3 — the composer, mounted for real (SandboxPage behind supabase-js, only the network faked by CA-08's
// fakeSupabase), on a draft and on /compose/new, at a computer's width and a phone's. Press Add, then Prompt: the
// add-prompt field is document.activeElement straight away and still is 600 ms later, it was scrolled to the middle
// in the same tap, and it is ringed. Every other Add item opens its dialog or draws its tile. jsdom draws nothing, so
// where on the screen it lands is measured in the browser by docs/audits/ca-10/scripts/add-items.mjs.

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => (await import("@/lib/build/__audit__/fakeSupabase")).clientModule);

import { ConnectorDialogProvider } from "@/components/connect/ConnectorDialog";
import { AuthProvider } from "@/contexts/AuthContext";
import { PG, REPO_SCHEMA, startAuditBackend, type Fault } from "@/lib/build/__audit__/fakeSupabase";
import { toast } from "sonner";

import { SandboxPage } from "./SandboxPage";

const DRAFT = "0d0d0d0d-0000-4000-8000-000000000001";

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined };
  });
}

const scrolled: { element: Element; options: unknown }[] = [];

beforeEach(() => {
  scrolled.length = 0;
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element, options?: unknown) {
    scrolled.push({ element: this, options });
  };
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(path: string, faults: Fault[] = []) {
  startAuditBackend({ schema: REPO_SCHEMA, faults });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={client}>
        <HelmetProvider>
          <AuthProvider>
            <ConnectorDialogProvider>
              <Routes>
                <Route path="/compose/new" element={<SandboxPage />} />
                <Route path="/compose/:buildId" element={<SandboxPage />} />
              </Routes>
            </ConnectorDialogProvider>
          </AuthProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const field = () => screen.getByRole("textbox", { name: "Add a prompt" });

async function openAdd(phone: boolean) {
  const add = await screen.findByTestId("sandbox-add", undefined, { timeout: 10_000 });
  if (phone) {
    fireEvent.click(add);
    return within(await screen.findByRole("dialog", { name: "Add" }));
  }
  fireEvent.keyDown(add, { key: "Enter" });
  await screen.findByRole("menu");
  return null;
}

async function choose(phone: boolean, name: RegExp) {
  const sheet = await openAdd(phone);
  if (sheet) fireEvent.click(sheet.getByRole("button", { name }));
  else fireEvent.click(await screen.findByRole("menuitem", { name }));
}

const cases = [
  { where: "a draft", path: `/compose/${DRAFT}` },
  { where: "a new post", path: "/compose/new" },
];

describe.each([
  { device: "a computer", width: 1280, phone: false },
  { device: "a phone", width: 390, phone: true },
])("CA-10 · Add › Prompt on $device", ({ width, phone }) => {
  it.each(cases)("on $where: the add field has the caret at 0 ms and at 600 ms, was scrolled to the middle in the tap, and is ringed", async ({ path }) => {
    stubWidth(width);
    mount(path);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    await choose(phone, /^Prompt/);
    // 0 ms: in the same tap.
    expect(document.activeElement).toBe(field());
    expect(scrolled.some((call) => call.element === field() && (call.options as { block?: string })?.block === "center")).toBe(true);
    expect(screen.getByTestId("add-prompt").getAttribute("data-lit")).toBe("true");
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(document.activeElement).toBe(field());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Add" })).toBeNull();
  });
});

describe.each([
  { device: "a computer", width: 1280, phone: false },
  { device: "a phone", width: 390, phone: true },
])("CA-10 · every other Add item visibly does something, on $device", ({ width, phone }) => {
  const dialogs: [RegExp, RegExp][] = [
    [/^New session/, /session/i],
    [/^Agent or team/, /agent/i],
    [/^Tool/, /tool/i],
    [/^Manual step/, /manual|step/i],
    [/^Code/, /code/i],
  ];
  it.each(dialogs)("%s opens its dialog", async (item, title) => {
    stubWidth(width);
    mount(`/compose/${DRAFT}`);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    await choose(phone, item);
    const dialog = await screen.findByRole("dialog", { name: title }, { timeout: 5_000 });
    expect(dialog).toBeTruthy();
  });

  it.each(cases)("Result on $where draws a tile at once, scrolls it into view, then rings the new Result", async ({ path }) => {
    stubWidth(width);
    mount(path);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    const before = screen.queryAllByTestId("result-card").length;
    await choose(phone, /^Result/);
    // In the tap: the stand-in tile, scrolled to.
    const pending = screen.getByTestId("add-pending");
    expect(pending.textContent).toContain("Adding a result");
    expect(scrolled.some((call) => call.element === pending && (call.options as { block?: string })?.block === "center")).toBe(true);
    await waitFor(() => expect(screen.getAllByTestId("result-card").length).toBe(before + 1), { timeout: 10_000 });
    expect(screen.queryByTestId("add-pending")).toBeNull();
    const added = screen.getAllByTestId("result-card").at(-1) as HTMLElement;
    await waitFor(() => expect(scrolled.some((call) => call.element === added)).toBe(true));
    expect(added.style.outlineStyle).toBe("solid");
  });

  it("File opens the file picker", async () => {
    stubWidth(width);
    const picked = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    mount(`/compose/${DRAFT}`);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    await choose(phone, /^File/);
    expect(picked).toHaveBeenCalled();
    expect((picked.mock.contexts[0] as HTMLInputElement).type).toBe("file");
  });

  it("Check opens its dialog, or is shown disabled saying why", async () => {
    stubWidth(width);
    mount(`/compose/${DRAFT}`);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    const sheet = await openAdd(phone);
    const row = sheet ? sheet.getByRole("button", { name: /^Check/ }) : await screen.findByRole("menuitem", { name: /^Check/ });
    const disabled = row.hasAttribute("disabled") || row.getAttribute("aria-disabled") === "true";
    if (disabled) {
      expect(row.textContent).toContain("Add an agent or code first");
    } else {
      fireEvent.click(row);
      expect(await screen.findByRole("dialog", { name: /check/i })).toBeTruthy();
    }
  });

  it("Session offers the waiting sessions, and choosing it draws a tile at once, scrolled to", async () => {
    stubWidth(width);
    mount(`/compose/${DRAFT}`);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    const sheet = await openAdd(phone);
    let waiting: HTMLElement;
    if (sheet) {
      fireEvent.click(sheet.getByRole("button", { name: /^Session/ }));
      waiting = await waitFor(() => sheet.getByRole("button", { name: /\d+ prompts?$/ }));
    } else {
      const trigger = await screen.findByRole("menuitem", { name: /^Session/ });
      fireEvent.keyDown(trigger, { key: "ArrowRight" });
      waiting = await screen.findByRole("menuitem", { name: /\d+ prompts?$/ }, { timeout: 5_000 });
    }
    fireEvent.click(waiting);
    const pending = screen.getByTestId("add-pending");
    expect(pending.textContent).toContain("Adding a session");
    expect(scrolled.some((call) => call.element === pending)).toBe(true);
    await waitFor(() => expect(screen.queryByTestId("add-pending")).toBeNull(), { timeout: 10_000 });
  });
});

describe("CA-10 · a new post whose draft cannot be made says so once (CA-08 F6)", () => {
  it.each([
    ["Result", /^Result/],
    ["Session", /^Session/],
  ])("Add › %s on /compose/new, with the draft refused: exactly one toast", async (_name, item) => {
    stubWidth(1280);
    const said = vi.spyOn(toast, "error");
    mount("/compose/new", [{ method: "POST", path: /^\/rest\/v1\/builds(\?|$)/, answer: PG.rlsInsert("builds") }]);
    await screen.findByRole("textbox", { name: "Add a prompt" }, { timeout: 10_000 });
    if (item.source === "^Session") {
      fireEvent.keyDown(await screen.findByTestId("sandbox-add"), { key: "Enter" });
      fireEvent.keyDown(await screen.findByRole("menuitem", { name: item }), { key: "ArrowRight" });
      fireEvent.click(await screen.findByRole("menuitem", { name: /\d+ prompts?$/ }, { timeout: 5_000 }));
    } else {
      await choose(false, item);
    }
    await waitFor(() => expect(said).toHaveBeenCalled(), { timeout: 5_000 });
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(said.mock.calls.map(([line]) => line)).toEqual(["Couldn't start your draft. Try again."]);
  });
});

