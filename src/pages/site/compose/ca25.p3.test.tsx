// CA-25 P3: a published build's status line, title row, menu and the Unpublish window.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { publishedWords, unpublishFailure } from "@/lib/build/publishChecklist";

import { BuildHistoryContext, type BuildHistoryApi } from "./useBuildHistory";
import { SandboxView, type SandboxViewProps } from "./SandboxView";

const NOW = new Date(2026, 9, 24, 15, 0, 0);
const daysAgo = (days: number) => new Date(2026, 9, 24 - days, 9, 0, 0).toISOString();

describe("publishedWords", () => {
  it("reads today, yesterday, then N days ago to 30", () => {
    expect(publishedWords(daysAgo(0), NOW)).toBe("Published today");
    expect(publishedWords(daysAgo(1), NOW)).toBe("Published yesterday");
    expect(publishedWords(daysAgo(2), NOW)).toBe("Published 2 days ago");
    expect(publishedWords(daysAgo(30), NOW)).toBe("Published 30 days ago");
  });

  it("reads the day and month after 30 days, with the year once it is not this year", () => {
    expect(publishedWords(new Date(2026, 8, 20, 9).toISOString(), NOW)).toBe("Published 20 Sep");
    expect(publishedWords(new Date(2026, 0, 3, 9).toISOString(), NOW)).toBe("Published 3 Jan");
    expect(publishedWords(new Date(2025, 9, 3, 9).toISOString(), NOW)).toBe("Published 3 Oct 2025");
  });

  it("goes by calendar days, not hours", () => {
    expect(publishedWords(new Date(2026, 9, 23, 23, 59).toISOString(), new Date(2026, 9, 24, 0, 1))).toBe("Published yesterday");
  });

  it("says only Published when there is no date", () => {
    expect(publishedWords(null, NOW)).toBe("Published");
    expect(publishedWords("not a date", NOW)).toBe("Published");
  });
});

describe("unpublishFailure", () => {
  it("is a refusal when the database says no, and a failure a try can mend otherwise", () => {
    expect(unpublishFailure({ code: "42501", message: "row-level security", status: 403 })).toBe("refused");
    expect(unpublishFailure({ code: "23514", message: "check", status: 400 })).toBe("refused");
    expect(unpublishFailure({ status: 503 })).toBe("failed");
    expect(unpublishFailure(new TypeError("Failed to fetch"))).toBe("failed");
  });
});

function stubWidth(px: number) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const matches = min ? px >= Number(min[1]) : max ? px <= Number(max[1]) : false;
    return { matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined };
  });
}

beforeEach(() => {
  stubWidth(1440);
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: 1440 });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: 900 });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const PUBLISHED = { slug: "bakery-homepage-p2m8z4", inGallery: true, shortfall: "" };

function Harness({ onUnpublish, start = true, notify, extra }: { onUnpublish?: SandboxViewProps["onUnpublish"]; start?: boolean; notify?: BuildHistoryApi["notify"]; extra?: Partial<SandboxViewProps> }) {
  const [published, setPublished] = useState<SandboxViewProps["published"]>(start ? PUBLISHED : null);
  const props = {
    ...sandboxViewProps("bakery"),
    onPublish: vi.fn(),
    onLens: vi.fn(),
    published,
    publishedAt: new Date().toISOString(),
    onUnpublish:
      onUnpublish &&
      (async () => {
        const result = await onUnpublish();
        if (result === "done") setPublished(null);
        return result;
      }),
    ...extra,
  } as SandboxViewProps;
  const history = { notify: notify ?? vi.fn() } as unknown as BuildHistoryApi;
  return (
    <MemoryRouter>
      <BuildHistoryContext.Provider value={history}>
        <SandboxView {...props} />
      </BuildHistoryContext.Provider>
    </MemoryRouter>
  );
}

const openMenu = () => fireEvent.keyDown(screen.getByRole("button", { name: "Published build options" }), { key: "Enter" });

describe("a published build's title row", () => {
  it("says when it was published, in place of Draft", () => {
    render(<Harness />);
    expect(screen.getByTestId("sandbox-status").textContent).toMatch(/^Published today/);
  });

  it("has Card, then View live (a link to /b2/{slug}), then the options button, and no Preview or Publish", () => {
    render(<Harness onUnpublish={async () => "done"} />);
    const row = screen.getByTestId("sandbox-tabrow");
    const names = within(row)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);
    expect(names.indexOf("Classification")).toBeGreaterThan(-1);
    expect(names.indexOf("Classification")).toBeLessThan(names.indexOf("Published build options"));
    const live = within(row).getByRole("link", { name: "View live" });
    expect(live.getAttribute("href")).toBe("/b2/bakery-homepage-p2m8z4");
    expect(within(row).queryByRole("link", { name: "Preview" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Publish" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Published" })).toBeNull();
    const options = within(row).getByRole("button", { name: "Published build options" });
    expect(options.getAttribute("style")).toContain("width: 28px");
    expect(options.getAttribute("style")).toContain("height: 28px");
  });

  it("leaves a draft's title row as it was: Card, Preview and Publish", () => {
    render(<Harness start={false} />);
    const row = screen.getByTestId("sandbox-tabrow");
    expect(within(row).getByRole("link", { name: "Preview" })).toBeTruthy();
    expect(within(row).getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(within(row).queryByRole("link", { name: "View live" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Published build options" })).toBeNull();
    expect(screen.getByTestId("sandbox-status").textContent).toMatch(/^Draft/);
  });
});

describe("the menu", () => {
  it("offers Copy link, a rule and Unpublish… in the danger colour, 200 wide", async () => {
    render(<Harness onUnpublish={async () => "done"} />);
    openMenu();
    const copy = await screen.findByTestId("published-copy-link");
    const menu = screen.getByRole("menu");
    expect(menu.getAttribute("style")).toContain("width: 200px");
    expect(copy.textContent).toBe("Copy link");
    expect(within(menu).getByRole("separator")).toBeTruthy();
    const unpublish = within(menu).getByRole("menuitem", { name: "Unpublish…" });
    expect(unpublish.getAttribute("data-tone")).toBe("danger");
  });

  it("copies the full live address and says Link copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const notify = vi.fn();
    render(<Harness onUnpublish={async () => "done"} notify={notify} />);
    openMenu();
    fireEvent.click(await screen.findByTestId("published-copy-link"));
    await waitFor(() => expect(notify).toHaveBeenCalledWith("Link copied", { undo: false }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/b2/bakery-homepage-p2m8z4`);
  });
});

describe("the Unpublish window", () => {
  const ask = async () => {
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unpublish…" }));
    return screen.findByTestId("unpublish-window");
  };

  it("is 420 wide with its title, its body, Cancel and Unpublish in the danger colour", async () => {
    render(<Harness onUnpublish={async () => "done"} extra={{ title: "Bakery homepage" }} />);
    const window = await ask();
    expect(window.getAttribute("style")).toContain("width: 420px");
    expect(within(window).getByText("Unpublish Bakery homepage?")).toBeTruthy();
    expect(within(window).getByTestId("unpublish-body").textContent).toBe("The link stops working. The draft stays.");
    expect(within(window).getByTestId("unpublish-cancel").textContent).toBe("Cancel");
    const confirm = within(window).getByTestId("unpublish-confirm");
    expect(confirm.textContent).toBe("Unpublish");
    expect(confirm.getAttribute("data-tone")).toBe("danger");
  });

  it("Cancel leaves the build published", async () => {
    const onUnpublish = vi.fn(async () => "done" as const);
    render(<Harness onUnpublish={onUnpublish} />);
    await ask();
    fireEvent.click(screen.getByTestId("unpublish-cancel"));
    expect(screen.queryByTestId("unpublish-window")).toBeNull();
    expect(onUnpublish).not.toHaveBeenCalled();
    expect(screen.getByTestId("sandbox-status").textContent).toMatch(/^Published/);
  });

  it("Unpublish returns the page to a draft: Draft in the status line, Preview and Publish in the row", async () => {
    const onUnpublish = vi.fn(async () => "done" as const);
    render(<Harness onUnpublish={onUnpublish} />);
    await ask();
    fireEvent.click(screen.getByTestId("unpublish-confirm"));
    await waitFor(() => expect(screen.getByTestId("sandbox-status").textContent).toMatch(/^Draft/));
    expect(onUnpublish).toHaveBeenCalledTimes(1);
    const row = screen.getByTestId("sandbox-tabrow");
    expect(within(row).getByRole("button", { name: "Publish" })).toBeTruthy();
    expect(within(row).getByRole("link", { name: "Preview" })).toBeTruthy();
  });

  it("a refusal leaves the build published and takes Unpublish… out of the menu", async () => {
    render(<Harness onUnpublish={async () => "refused"} />);
    await ask();
    fireEvent.click(screen.getByTestId("unpublish-confirm"));
    await waitFor(() => expect(screen.queryByTestId("unpublish-window")).toBeNull());
    expect(screen.getByTestId("sandbox-status").textContent).toMatch(/^Published/);
    openMenu();
    await screen.findByTestId("published-copy-link");
    expect(screen.queryByRole("menuitem", { name: "Unpublish…" })).toBeNull();
  });

  it("a failure a try can mend keeps the item", async () => {
    render(<Harness onUnpublish={async () => "failed"} />);
    await ask();
    fireEvent.click(screen.getByTestId("unpublish-confirm"));
    await waitFor(() => expect(screen.queryByTestId("unpublish-window")).toBeNull());
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "Unpublish…" })).toBeTruthy();
  });

  it("is not offered when the page cannot unpublish", async () => {
    render(<Harness />);
    openMenu();
    await screen.findByTestId("published-copy-link");
    expect(screen.queryByRole("menuitem", { name: "Unpublish…" })).toBeNull();
  });
});
