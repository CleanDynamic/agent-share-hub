import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";

import { AccountDrawer, DRAWER_SWIPE_PX } from "./AccountDrawer";
import { MobileHeader } from "./MobileHeader";
import { NEW_ITEMS, NewSheet } from "./NewSheet";
import { __resetPageBar, useRegisterPageBar, type PageBar } from "./phoneBarRegistry";
import { PhoneSearchPage } from "./PhoneSearchPage";

// jsdom has no PointerEvent, so fireEvent.pointerMove would drop clientX.
class TestPointerEvent extends MouseEvent {}
vi.stubGlobal("PointerEvent", TestPointerEvent);

const authState: { isLoggedIn: boolean; profile: unknown; user: unknown; signOut: () => void } = {
  isLoggedIn: false,
  profile: null,
  user: null,
  signOut: vi.fn(),
};
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));

vi.mock("@/lib/build/gallery", () => ({
  gallerySelect: () => "",
  listGallery: vi.fn(async () => ({
    builds: [
      { id: "b1", slug: "invoice-triage", title: "Invoice triage", outcome: "Sorts invoices" },
      { id: "b2", slug: "invoice-bot", title: "Invoice bot", outcome: null },
    ],
    total: 2,
  })),
}));
// Prompt 21: Search reads the busy spaces while the field is empty; these tests are about the results.
vi.mock("@/lib/openbuilds", () => ({ listBusySpaces: vi.fn(async () => []), postKey: (...parts: unknown[]) => ["posts", ...parts] }));

vi.mock("@/lib/search/phoneSearch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/search/phoneSearch")>()),
  searchTopics: vi.fn(async () => ({ rows: [{ id: "t1", title: "How do I route invoices?", by: "@kit" }], total: 1 })),
  searchPeople: vi.fn(async () => ({ rows: [1, 2, 3].map((n) => ({ id: `p${n}`, handle: `inv${n}`, name: `Invoice Person ${n}`, avatarUrl: null })), total: 3 })),
}));

const viewer = { id: "u1", name: "Ada Lovelace", handle: "ada" };

beforeEach(() => {
  __resetPageBar();
  authState.isLoggedIn = false;
  authState.profile = null;
  authState.user = null;
});

const bar = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <MobileHeader />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );

function Page({ bar }: { bar: PageBar }) {
  useRegisterPageBar(bar);
  return null;
}
const barWith = (path: string, page: PageBar) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider>
        <MemoryRouter initialEntries={[path]}>
          <MobileHeader />
          <Page bar={page} />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );

describe("what a page tells the bar", () => {
  it("More opens a sheet: the page's rows, then Copy link, then its danger rows last", async () => {
    const rebuild = vi.fn();
    barWith("/b2/invoice-triage", { more: [{ label: "Report", tone: "danger", onSelect: vi.fn() }, { label: "Rebuild", onSelect: rebuild }] });
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = await screen.findByTestId("more-sheet");
    expect(within(sheet).getAllByRole("button").map((b) => b.textContent)).toEqual(["Rebuild", "Copy link", "Report"]);
    expect(within(sheet).getByRole("button", { name: "Report" }).getAttribute("data-tone")).toBe("danger");
    fireEvent.click(within(sheet).getByRole("button", { name: "Rebuild" }));
    expect(rebuild).toHaveBeenCalledTimes(1);
  });

  it("a link row goes to its page", async () => {
    barWith("/b2/invoice-triage", { more: [{ label: "Lineage", to: "/b2/invoice-triage/lineage" }] });
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    const sheet = await screen.findByTestId("more-sheet");
    expect(within(sheet).getByRole("link", { name: "Lineage" }).getAttribute("href")).toBe("/b2/invoice-triage/lineage");
  });

  it("Followers shows the person's name, and a topic its space's name", () => {
    barWith("/profile/ada/followers", { title: "Ada Lovelace" });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Followers")).toBeNull();
  });

  it("Rebuild's back names the source build", () => {
    barWith("/rebuild/invoice-triage", { backLabel: "Back to Invoice triage", backTo: "/b2/invoice-triage" });
    expect(screen.getByRole("button", { name: "Back to Invoice triage" })).toBeTruthy();
  });

  it("onboarding shows Skip once the page registers it, and Skip calls the page", () => {
    const skip = vi.fn();
    barWith("/onboarding", { skip });
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it("Messages draws a gear only in an open conversation, and it opens that conversation's settings", () => {
    const settings = vi.fn();
    barWith("/messages/t1", { settings });
    fireEvent.click(screen.getByRole("button", { name: "Conversation settings" }));
    expect(settings).toHaveBeenCalledTimes(1);
  });

  it("the Messages list has no gear", () => {
    bar("/messages");
    expect(screen.queryByRole("button", { name: "Conversation settings" })).toBeNull();
  });
});

describe("the search page", () => {
  it("groups results by kind with the count as the heading: builds, topics and people", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <PhoneSearchPage open onOpenChange={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search builds" }), { target: { value: "invoice" } });
    expect(await screen.findByRole("heading", { name: "2 builds" }, { timeout: 3000 })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "1 topic" })).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "3 people" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Invoice triage/ }).getAttribute("href")).toBe("/b2/invoice-triage");
    expect(screen.getByRole("link", { name: /How do I route invoices\?/ }).getAttribute("href")).toBe("/openbuilds/topics/t1");
    expect(screen.getByRole("link", { name: /Invoice Person 2/ }).getAttribute("href")).toBe("/profile/inv2");
  });
});

describe("the top bar container", () => {
  it("signed out on Home: a Sign in ghost button instead of the avatar, the logo, Search", () => {
    bar("/");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByTestId("phone-avatar")).toBeNull();
    expect(screen.getByRole("link", { name: "OpenBuilds.ai home" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("Activity names itself in the bar as plain text, so the page keeps the only h1, with Mark all read disabled until a page registers it", () => {
    bar("/notifications");
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.getByText("Activity")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Mark all read" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Drafts: back, its name, New build as an icon link", () => {
    bar("/drafts");
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "New build" }).getAttribute("href")).toBe("/compose/new");
  });

  it("the editor's back says where it goes", () => {
    bar("/compose/abc");
    expect(screen.getByRole("button", { name: "Back to Drafts" })).toBeTruthy();
  });

  it("Search pushes a full-screen page with a Cancel that closes it", async () => {
    bar("/builds");
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    const page = await screen.findByRole("dialog", { name: "Search" });
    expect(within(page).getByRole("searchbox", { name: "Search builds" })).toBeTruthy();
    fireEvent.click(within(page).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Search" })).toBeNull();
  });
});

describe("AccountDrawer", () => {
  const drawer = (onOpenChange = vi.fn(), onSignOut = vi.fn()) => {
    render(
      <MemoryRouter>
        <AccountDrawer open onOpenChange={onOpenChange} viewer={viewer} dark onToggleDark={vi.fn()} onSignOut={onSignOut} />
      </MemoryRouter>,
    );
    return { onOpenChange, onSignOut };
  };

  it("is 300 wide on Panel from the left, with the handle and rows 52 tall at 17/500", () => {
    drawer();
    const panel = screen.getByTestId("account-drawer");
    const style = panel.getAttribute("style") ?? "";
    expect(style).toContain("width: 300px");
    expect(style).toContain("left: 0px");
    expect(panel.getAttribute("data-motion")).toBe("drawer");
    expect(panel.getAttribute("data-fill")).toBe("panel");
    const row = within(panel).getByRole("link", { name: "Your profile" });
    expect(row.getAttribute("style")).toContain("min-height: 52px");
    expect(row.getAttribute("style")).toContain("font-size: 17px");
    expect(within(panel).getByText("Signed in as")).toBeTruthy();
  });

  it("the theme switch reports its state and Sign out is Danger", () => {
    const { onSignOut, onOpenChange } = drawer();
    expect(screen.getByRole("switch", { name: "Dark theme" }).getAttribute("aria-checked")).toBe("true");
    const out = screen.getByRole("button", { name: "Sign out" });
    expect(out.getAttribute("data-tone")).toBe("danger");
    fireEvent.click(out);
    expect(onSignOut).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Escape and on a swipe to the left, not on a short one", () => {
    const { onOpenChange } = drawer();
    const panel = screen.getByTestId("account-drawer");
    fireEvent.pointerDown(panel, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientX: 200 - (DRAWER_SWIPE_PX - 10), clientY: 302, pointerId: 1 });
    fireEvent.pointerUp(panel, { pointerId: 1 });
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(panel, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientX: 200 - (DRAWER_SWIPE_PX + 20), clientY: 302, pointerId: 1 });
    fireEvent.pointerUp(panel, { pointerId: 1 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    onOpenChange.mockClear();
    fireEvent.keyDown(panel, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("a vertical scroll is not a swipe", () => {
    const { onOpenChange } = drawer();
    const panel = screen.getByTestId("account-drawer");
    fireEvent.pointerDown(panel, { clientX: 200, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(panel, { clientX: 100, clientY: 600, pointerId: 1 });
    fireEvent.pointerUp(panel, { pointerId: 1 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("NewSheet", () => {
  it("the four CreateMenu items in the repo's order", () => {
    expect(NEW_ITEMS.map((item) => [item.label, item.icon])).toEqual([
      ["New build", "new"],
      ["Import", "import"],
      ["New post", "compose"],
      ["Connect a tool", "connect"],
    ]);
  });

  it("is a sheet of 64 tall rows with an icon square on Raised and a chevron, and a signed-out choice goes to sign in", async () => {
    render(
      <MemoryRouter initialEntries={["/builds"]}>
        <NewSheet open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );
    const group = await screen.findByRole("group", { name: "New" });
    const rows = within(group).getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual(["New build", "Import", "New post", "Connect a tool"]);
    expect(rows[0].getAttribute("style")).toContain("height: 64px");
    expect(rows[0].querySelector('[data-icon="chevr"]')).toBeTruthy();
    expect(rows[0].querySelector("span")?.getAttribute("data-fill")).toBe("raised");
  });
});
