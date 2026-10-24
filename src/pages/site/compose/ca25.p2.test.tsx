// CA-25 P2: Confirm, the last look before Publish.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sandboxViewProps } from "@/dev/fixtures/sandbox";
import { confirmRows, publishChecklist, type ConfirmInput } from "@/lib/build/publishChecklist";

import { PublishConfirm } from "./PublishConfirm";
import { SandboxView, type SandboxViewProps } from "./SandboxView";

const FIXTURE: ConfirmInput = {
  post: { words: 240, links: 3 },
  parts: 2,
  sessions: 4,
  tiles: 18,
  files: ["menu.pdf", "logo.png", "homepage.html"],
  card: ["Website", "Content"],
};

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
afterEach(cleanup);

describe("confirmRows", () => {
  it("reads each row's value from the fixture", () => {
    expect(confirmRows(FIXTURE).map((row) => [row.name, row.value])).toEqual([
      ["Post", "240 words, 3 links"],
      ["Build", "2 parts, 4 sessions, 18 tiles"],
      ["Files", "menu.pdf, logo.png, homepage.html"],
      ["Classification Card", "Website, Content"],
    ]);
  });

  it("leaves parts out at 1, and says one link, one session and one tile in the singular", () => {
    const rows = confirmRows({ ...FIXTURE, parts: 1, post: { words: 1, links: 1 }, sessions: 1, tiles: 1 });
    expect(rows[0].value).toBe("1 word, 1 link");
    expect(rows[1].value).toBe("1 session, 1 tile");
  });

  it("leaves out links when the post has none", () => {
    expect(confirmRows({ ...FIXTURE, post: { words: 12, links: 0 } })[0].value).toBe("12 words");
  });

  it("names up to 3 files, then +N", () => {
    expect(confirmRows({ ...FIXTURE, files: ["a.pdf", "b.png", "c.html", "d.txt", "e.md"] })[2].value).toBe("a.pdf, b.png, c.html +2");
    expect(confirmRows({ ...FIXTURE, files: ["a.pdf", "b.png", "c.html", "d.txt"] })[2].value).toBe("a.pdf, b.png, c.html +1");
    expect(confirmRows({ ...FIXTURE, files: ["a.pdf"] })[2].value).toBe("a.pdf");
    expect(confirmRows({ ...FIXTURE, files: [] })[2].value).toBe("None");
  });

  it("says Not filled when the Card has no categories", () => {
    expect(confirmRows({ ...FIXTURE, card: [] })[3].value).toBe("Not filled");
  });
});

describe("the Confirm window", () => {
  const open = (over: Partial<Parameters<typeof PublishConfirm>[0]> = {}) => {
    const props = { open: true, title: "Bakery homepage", rows: confirmRows(FIXTURE), onCancel: vi.fn(), onPublish: vi.fn(), ...over };
    render(<PublishConfirm {...props} />);
    return props;
  };

  it("has its title, its line, Public with four rows, and Private with its one line", () => {
    open();
    const window = screen.getByTestId("publish-confirm");
    expect(within(window).getByText("Publish Bakery homepage?")).toBeTruthy();
    expect(within(window).getByTestId("confirm-line").textContent).toBe("Visible to anyone with the link.");
    expect(within(window).getByRole("region", { name: "Public" })).toBeTruthy();
    expect(within(window).getByRole("region", { name: "Private" })).toBeTruthy();
    expect(within(window).getByTestId("confirm-post-value").textContent).toBe("240 words, 3 links");
    expect(within(window).getByTestId("confirm-build-value").textContent).toBe("2 parts, 4 sessions, 18 tiles");
    expect(within(window).getByTestId("confirm-files-value").textContent).toBe("menu.pdf, logo.png, homepage.html");
    expect(within(window).getByTestId("confirm-card-value").textContent).toBe("Website, Content");
    expect(within(window).getByTestId("confirm-private").textContent).toBe("Your sessions not in the build, Recently removed");
  });

  it("cuts a long value to one line", () => {
    open({ rows: confirmRows({ ...FIXTURE, card: ["A very long category", "Another long category", "And a third one"] }) });
    const style = screen.getByTestId("confirm-card-value").getAttribute("style") ?? "";
    expect(style).toContain("text-overflow: ellipsis");
    expect(style).toContain("white-space: nowrap");
  });

  it("Cancel closes it without publishing", () => {
    const props = open();
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("Publish closes it and runs the publish once", () => {
    const props = open();
    fireEvent.click(screen.getByTestId("confirm-publish"));
    expect(props.onPublish).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("Confirm from the page's Publish", () => {
  function view() {
    const props = {
      ...sandboxViewProps("bakery"),
      onPublish: vi.fn(),
      onLens: vi.fn(),
      publish: {
        checklist: publishChecklist({ missing: [], title: "Bakery homepage", description: "d", cover: "image", tiles: 18, blockers: [], threadHold: null, reminders: [], appless: [], cardFilled: true }),
        confirm: () => FIXTURE,
        onShowApps: vi.fn(),
      },
    } as SandboxViewProps;
    render(
      <MemoryRouter>
        <SandboxView {...props} />
      </MemoryRouter>,
    );
    return props;
  }
  const press = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    });
  };

  it("opens on Publish with nothing open, reads the window from the data, and publishes on its Publish", async () => {
    const props = view();
    await press();
    expect(screen.getByText("Publish Bakery homepage?")).toBeTruthy();
    expect(screen.getByTestId("confirm-post-value").textContent).toBe("240 words, 3 links");
    expect(props.onPublish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("confirm-publish"));
    expect(props.onPublish).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("publish-confirm")).toBeNull();
  });

  it("Cancel leaves the build a draft: nothing is published", async () => {
    const props = view();
    await press();
    fireEvent.click(screen.getByTestId("confirm-cancel"));
    expect(screen.queryByTestId("publish-confirm")).toBeNull();
    expect(props.onPublish).not.toHaveBeenCalled();
  });

  it("is 480 wide, in the window recipe", async () => {
    view();
    await press();
    const style = screen.getByTestId("publish-confirm").getAttribute("style") ?? "";
    expect(style).toContain("width: 480px");
    expect(style).toContain("var(--window-shadow)");
  });
});
