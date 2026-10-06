import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";

import { Breadcrumb } from "./Breadcrumb";
import { trailFor } from "./breadcrumbTrail";
import { SiteFooterView } from "./SiteFooter";
import { CrumbTitleProvider, useCrumbTitle } from "./useBreadcrumb";

const labels = (path: string, title: string | null = "Invoice triage agent") =>
  trailFor(path, title).map((c) => c.label);

describe("trailFor", () => {
  it.each([
    ["/", ["Home"]],
    ["/gallery", ["Home", "Gallery"]],
    ["/b2/invoice", ["Home", "Gallery", "Invoice triage agent"]],
    ["/b2/invoice/lineage", ["Home", "Gallery", "Invoice triage agent", "Lineage"]],
    ["/rebuild/invoice", ["Home", "Gallery", "Invoice triage agent", "Rebuild"]],
    ["/import", ["Home", "New build", "Import"]],
    ["/drafts", ["Home", "Drafts"]],
    ["/drafts/posts", ["Home", "Drafts", "Older post drafts"]],
    ["/compose/new", ["Home", "Drafts", "Invoice triage agent"]],
    ["/compose/abc", ["Home", "Drafts", "Invoice triage agent"]],
    ["/bounties", ["Home", "Bounties"]],
    ["/bounties/solvers", ["Home", "Bounties", "Solvers"]],
    ["/profile/maya", ["Home", "Invoice triage agent"]],
    ["/notifications", ["Home", "Activity"]],
    ["/library", ["Home", "Library"]],
  ])("%s", (path, expected) => {
    expect(labels(path)).toEqual(expected);
  });

  it("the current crumb never has an href; a titled ancestor links back to the record", () => {
    const lineage = trailFor("/b2/invoice/lineage", "T");
    expect(lineage[lineage.length - 1].href).toBeUndefined();
    expect(lineage[2].href).toBe("/b2/invoice");
  });

  it("carries a null label while the title loads", () => {
    expect(trailFor("/b2/invoice", null).at(-1)?.label).toBeNull();
  });
});

function Page({ title }: { title: string | null }) {
  useCrumbTitle(title);
  return null;
}

describe("Breadcrumb", () => {
  const at = (path: string, title: string | null) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <CrumbTitleProvider>
          <Breadcrumb />
          <Routes>
            <Route path="/b2/:slug" element={<Page title={title} />} />
            <Route path="*" element={null} />
          </Routes>
        </CrumbTitleProvider>
      </MemoryRouter>,
    );

  it("renders ancestors as links and the current page as aria-current", () => {
    at("/b2/x", "Invoice triage agent");
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.textContent).toBe("Home/Gallery/Invoice triage agent");
    expect(screen.getByRole("link", { name: "Gallery" }).getAttribute("href")).toBe("/gallery");
    expect(screen.getByText("Invoice triage agent").getAttribute("aria-current")).toBe("page");
  });

  it("shows a skeleton until the page supplies its title", () => {
    at("/b2/x", null);
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });
});

describe("SiteFooterView", () => {
  const footer = (signedIn: boolean, onSignOut = vi.fn(), onConnect = vi.fn()) =>
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SiteFooterView signedIn={signedIn} onSignOut={onSignOut} onConnect={onConnect} />
        </ThemeProvider>
      </MemoryRouter>,
    );

  it("signed out: the four links, Sign in last", () => {
    footer(false);
    const links = screen.getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toEqual([
      ["buildgallery", "/"],
      ["About", "/about"],
      ["API docs", "/api-docs"],
      ["Solvers", "/bounties/solvers"],
      ["Sign in", "/login"],
    ]);
  });

  it("Connect a tool is a button that opens the guide", () => {
    const onConnect = vi.fn();
    footer(false, vi.fn(), onConnect);
    fireEvent.click(screen.getByRole("button", { name: "Connect a tool" }));
    expect(onConnect).toHaveBeenCalled();
  });

  it("signed in: Sign out is a button", () => {
    const onSignOut = vi.fn();
    footer(true, onSignOut);
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalled();
  });
});

describe("ThemeSegmented", () => {
  it("persists the choice under bg-theme and offers System", () => {
    window.localStorage.removeItem("bg-theme");
    render(
      <ThemeProvider>
        <ThemeSegmented />
      </ThemeProvider>,
    );
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Noon", "Dusk", "System"]);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Dusk" }));
    });
    expect(window.localStorage.getItem("bg-theme")).toBe("dusk");
    expect(document.documentElement.dataset.theme).toBe("dusk");
    expect(screen.getByRole("button", { name: "Dusk" }).getAttribute("aria-pressed")).toBe("true");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "System" }));
    });
    expect(window.localStorage.getItem("bg-theme")).toBe("system");
  });
});
