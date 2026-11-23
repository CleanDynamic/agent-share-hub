import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/contexts/ThemeContext";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";

import { Breadcrumb, BreadcrumbView } from "./Breadcrumb";
import { trailFor } from "./breadcrumbTrail";
import { SiteFooterView } from "./SiteFooter";
import { CrumbTitleProvider, useCrumbTitle } from "./useBreadcrumb";

const labels = (path: string, title: string | null = "Invoice triage agent") =>
  trailFor(path, title).map((c) => c.label);

describe("trailFor", () => {
  it.each([
    ["/", ["Home"]],
    ["/builds", ["Home", "Builds"]],
    ["/gallery", ["Home", "Builds"]],
    ["/b2/invoice", ["Home", "Builds", "Invoice triage agent"]],
    ["/b2/invoice/lineage", ["Home", "Builds", "Invoice triage agent", "Lineage"]],
    ["/rebuild/invoice", ["Home", "Builds", "Invoice triage agent", "Rebuild"]],
    ["/import", ["Home", "New build", "Import"]],
    ["/drafts", ["Home", "Drafts"]],
    ["/compose/new", ["Home", "Drafts", "Invoice triage agent"]],
    ["/compose/abc", ["Home", "Drafts", "Invoice triage agent"]],
    ["/openbuilds", ["Home", "OpenBuilds"]],
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

  it("draws only the parent, as one link above the h1", () => {
    at("/b2/x", "Invoice triage agent");
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.textContent).toBe("Builds");
    expect(screen.getByRole("link", { name: "Builds" }).getAttribute("href")).toBe("/builds");
    expect(screen.queryByText("Invoice triage agent")).toBeNull();
    expect(screen.queryByText("Home")).toBeNull();
  });

  it("draws nothing for a page that sits straight under Home", () => {
    at("/builds", null);
    expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).toBeNull();
  });

  it("shows a skeleton while the parent's name loads (the build's name above Lineage)", () => {
    at("/b2/x/lineage", null);
    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  });
});

describe("SiteFooterView", () => {
  it("hides unreviewed legal and safety links", () => {
    render(<MemoryRouter><SiteFooterView /></MemoryRouter>);
    expect(screen.getAllByRole("link").map(a=>a.getAttribute("href"))).toEqual(["/", "/about", "/connect"]);
  });
  it("offers all reviewed links in the approved order", () => {
    render(<MemoryRouter initialEntries={["/privacy"]}><SiteFooterView showPrivacy showTerms showFooterPages /></MemoryRouter>);
    expect(screen.getAllByRole("link").map(a=>a.getAttribute("href"))).toEqual(["/", "/about", "/privacy", "/terms", "/rules", "/report", "/contact", "/connect"]);
    expect(screen.getByRole("link",{name:"Privacy"}).getAttribute("aria-current")).toBe("page");
  });
  it("ends with Sign in, or Sign out when signed in, underlined in the text colour", () => {
    const out = vi.fn();
    const view = render(<MemoryRouter><SiteFooterView signedIn onSignOut={out} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(out).toHaveBeenCalledOnce();
    view.unmount();
    const signIn = vi.fn();
    render(<MemoryRouter><SiteFooterView onSignIn={signIn} /></MemoryRouter>);
    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button.getAttribute("style")).toContain("underline");
    fireEvent.click(button);
    expect(signIn).toHaveBeenCalledOnce();
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
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Light", "Dark", "System"]);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    });
    expect(window.localStorage.getItem("bg-theme")).toBe("dusk");
    expect(document.documentElement.dataset.theme).toBe("dusk");
    expect(screen.getByRole("button", { name: "Dark" }).getAttribute("aria-pressed")).toBe("true");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "System" }));
    });
    expect(window.localStorage.getItem("bg-theme")).toBe("system");
  });
});

/* UI-P87 — the refined breadcrumb and footer. Names, items and order are the current ones; styles from SSR markup. */
describe("the parent link", () => {
  const REFINED = "/dev/kit/pages/home";

  it("is 13px in --label and underlined, with no separator and no current page", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[REFINED]}>
        <BreadcrumbView
          trail={[
            { label: "Home", href: "/" },
            { label: "OpenBuilds", href: "/openbuilds" },
            { label: "Bakery space" },
          ]}
        />
      </MemoryRouter>,
    );
    expect(html).toContain("font-size:13px");
    expect(html).toContain("color:var(--label)");
    expect(html).toContain("text-decoration:underline");
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("Bakery space");
  });
});
