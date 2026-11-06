// UX-12 P5: the 404 page.
import fs from "node:fs";
import path from "node:path";

import { fireEvent, render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reportError = vi.fn();
vi.mock("@/lib/errors/report", () => ({ reportError: (...args: unknown[]) => reportError(...args) }));

import NotFoundPage, { NotFoundHere } from "./NotFoundPage";
import { NotFoundView } from "./NotFoundView";
import { hintFor, NOT_FOUND_LINE, NOT_FOUND_TITLE, shownPath } from "./notFoundModel";

beforeEach(() => reportError.mockClear());

const page = (at: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[at]}>
        <NotFoundPage />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("the model", () => {
  it("names a build or a profile from the path, and nothing else", () => {
    expect(hintFor("/b/abc")).toBe("If you were looking for a build, it may have been made private or deleted.");
    expect(hintFor("/u/maren")).toBe("If you were looking for a profile, the username may have changed.");
    expect(hintFor("/this-does-not-exist")).toBeNull();
  });
  it("cuts the shown path to 60 characters", () => {
    expect([...shownPath("/" + "a".repeat(200))].length).toBe(60);
    expect(shownPath("/short")).toBe("/short");
  });
});

describe("the page", () => {
  it("says the copy, with one primary button and two quiet links, and the path once", () => {
    page("/this-does-not-exist");
    expect(screen.getByRole("heading", { level: 1, name: NOT_FOUND_TITLE })).toBeInTheDocument();
    expect(screen.getByText(NOT_FOUND_LINE)).toBeInTheDocument();
    expect(screen.queryByTestId("not-found-hint")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Go to Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse builds" })).toHaveAttribute("href", "/builds");
    expect(screen.getByRole("link", { name: "OpenBuilds" })).toHaveAttribute("href", "/openbuilds");
    expect(screen.getAllByText("/this-does-not-exist")).toHaveLength(1);
  });

  it.each([
    ["/b/gone", "If you were looking for a build, it may have been made private or deleted."],
    ["/u/gone", "If you were looking for a profile, the username may have changed."],
  ])("adds a sentence for %s", (at, sentence) => {
    page(at);
    expect(screen.getByTestId("not-found-hint")).toHaveTextContent(sentence);
  });

  it("moves focus to the h1", () => {
    page("/nope");
    expect(screen.getByRole("heading", { level: 1 })).toHaveFocus();
  });

  it("is noindex and titled", async () => {
    page("/nope");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.title).toBe("Page not found · OpenBuilds.ai");
    expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  });

  it("is ready at once", () => {
    page("/nope");
    expect(document.documentElement.getAttribute("data-page-ready")).toBe("notfound");
  });

  it("still reports the error once per path, with the original source and context", () => {
    const { unmount } = page("/one");
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith("/one", { source: "console", context: "404 Error: User attempted to access non-existent route:" });
    unmount();
    page("/two");
    expect(reportError).toHaveBeenCalledTimes(2);
    expect(reportError).toHaveBeenLastCalledWith("/two", expect.objectContaining({ source: "console" }));
  });

  it("goes Home from the button", () => {
    const onHome = vi.fn();
    render(<MemoryRouter><NotFoundView path="/x" onHome={onHome} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Go to Home" }));
    expect(onHome).toHaveBeenCalled();
  });
});

describe("another page's own state", () => {
  it("says its own sentence and does not report", () => {
    render(<MemoryRouter initialEntries={["/project/1"]}><NotFoundHere sentence="If you were looking for a project, it may have been removed." /></MemoryRouter>);
    expect(screen.getByTestId("not-found-hint")).toHaveTextContent("If you were looking for a project, it may have been removed.");
    expect(reportError).not.toHaveBeenCalled();
  });
});

describe("the repository", () => {
  it("has no Oops left under src/", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(entry.name) && full !== __filename && /\bOops\b/.test(fs.readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk(path.resolve(__dirname, "../../.."));
    expect(hits).toEqual([]);
  });
});
