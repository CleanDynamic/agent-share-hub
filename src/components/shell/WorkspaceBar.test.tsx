// BG-P16 — the shared workspace chrome.
//
// Four claims, one per thing the prompt says must hold on all four routes: the
// exit is a real control pointing where the route said, the mode names itself,
// the context is editable on compose and read-only elsewhere, and the theme
// toggle works from inside the workspace. The bar's HEIGHT is asserted here as
// a number and measured for real in the e2e spec — jsdom has no layout engine,
// so this side proves the declaration and that side proves the box.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1" }, profile: { display_name: "Maya Okafor", username: "maya", avatar_url: null } }),
}));

import {
  WORKSPACE_BAR_HEIGHT,
  WorkspaceBar,
  exitControlStyle,
  workspaceGround,
  workspacePanel,
  type WorkspaceContext,
  type WorkspaceMode,
} from "./WorkspaceBar";
import { focusRing } from "@/lib/theme/focus";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/contexts/ThemeContext";

/** Somewhere to land, so a navigation can be asserted on rather than mocked. */
function Elsewhere({ name }: { name: string }) {
  return <div data-testid="landed">{name}</div>;
}

function renderBar(
  props: {
    mode?: WorkspaceMode;
    to?: string;
    hint?: string;
    confirm?: () => boolean;
    context?: WorkspaceContext;
    right?: React.ReactNode;
  } = {},
) {
  const { mode = "compose", to = "/gallery", hint, confirm, context, right } = props;

  return render(
    <ThemeProvider>
      <TooltipProvider>
        <MemoryRouter initialEntries={["/compose/abc"]}>
          <Routes>
            <Route
              path="/compose/abc"
              element={
                <WorkspaceBar
                  mode={mode}
                  exit={{ to, hint, confirm }}
                  context={context}
                  right={right}
                />
              }
            />
            <Route path="/gallery" element={<Elsewhere name="gallery" />} />
            <Route path="/content/:id" element={<Elsewhere name="post" />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </ThemeProvider>,
  );
}

const exit = () => screen.getByTestId("workspace-exit");

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("WorkspaceBar — the exit", () => {
  it("is a round chevron with no text, named by where it goes", () => {
    renderBar();
    expect(exit()).toHaveAccessibleName("Back to Drafts");
    expect(screen.getByLabelText("Back to Drafts")).toBe(exit());
    expect(exit().textContent).toBe("");
    expect(exit().querySelector("svg")).not.toBeNull();
  });

  it("goes to Drafts on compose", () => {
    for (const mode of ["compose", "rebuild"] as const) {
      const view = renderBar({ mode, to: "/drafts" });
      expect(exit()).toHaveAttribute("href", "/drafts");
      view.unmount();
    }
  });

  it("goes where the route sent it, and names that destination rather than Drafts", () => {
    renderBar({ mode: "convert", to: "/content/xyz", hint: "Back to the post" });
    expect(exit()).toHaveAttribute("href", "/content/xyz");
    expect(exit()).toHaveAccessibleName("Back to the post");
    fireEvent.click(exit());
    expect(screen.getByTestId("landed")).toHaveTextContent("post");
  });

  it("is a control and not a bare link: a 44px round button on the control fill with an edge", () => {
    const resting = exitControlStyle();
    expect(resting.backgroundColor).toBe("var(--control)");
    expect(resting.borderColor).toBe("var(--control-border)");
    expect(resting.borderWidth).toBe(1);
    expect(resting.borderRadius).toBe("var(--r-full)");
    expect(resting.width).toBe(44);
    expect(resting.height).toBe(44);
    expect(resting.color).toBe("var(--text)");
    expect(resting.textDecoration).toBe("none");

    renderBar();
    expect(exit().getAttribute("style")).toContain("var(--r-full)");
  });

  it("answers hover and keyboard focus, so its states are visible", () => {
    const hovered = exitControlStyle({ hovered: true });
    expect(hovered.borderColor).toBe("var(--text)");
    expect(hovered.borderColor).not.toBe(exitControlStyle().borderColor);

    // The shared ring, never a second one invented here.
    expect(exitControlStyle({ focusVisible: true })).toMatchObject(focusRing);
    expect(exitControlStyle().outlineColor).toBeUndefined();
  });

  it("lets a route's guard cancel the exit, and navigates when there is none", () => {
    const refuse = vi.fn(() => false);
    const view = renderBar({ confirm: refuse });
    fireEvent.click(exit());
    expect(refuse).toHaveBeenCalled();
    expect(screen.queryByTestId("landed")).toBeNull();
    view.unmount();

    renderBar({ confirm: () => true });
    fireEvent.click(exit());
    expect(screen.getByTestId("landed")).toHaveTextContent("gallery");
  });
});

describe("WorkspaceBar — mode and context", () => {
  it("names the mode in a mono eyebrow", () => {
    for (const [mode, text] of [
      ["compose", "COMPOSE"],
      ["rebuild", "REBUILD"],
      ["convert", "CONVERT"],
    ] as const) {
      const view = renderBar({ mode });
      const badge = screen.getByTestId("workspace-mode");
      expect(badge).toHaveTextContent(text);
      expect(badge.getAttribute("style")).toContain("Geist");
      expect(screen.getByTestId("workspace-bar")).toHaveAttribute(
        "data-workspace-mode",
        mode,
      );
      view.unmount();
    }
  });

  it("edits the title in place on compose", () => {
    const onChange = vi.fn();
    renderBar({
      context: {
        kind: "editable",
        value: "Inbox triage agent",
        onChange,
        label: "Build title",
      },
    });

    const field = screen.getByLabelText("Build title");
    expect(field).toHaveValue("Inbox triage agent");
    fireEvent.change(field, { target: { value: "Inbox triage agent v2" } });
    expect(onChange).toHaveBeenCalledWith("Inbox triage agent v2");
  });

  it("renders the context read-only elsewhere, with no field to type into", () => {
    renderBar({ mode: "convert", context: { kind: "readonly", text: "A post" } });
    const context = screen.getByTestId("workspace-context");
    expect(context).toHaveTextContent("A post");
    expect(context.tagName).not.toBe("INPUT");
  });

  it("says nothing rather than something empty when there is no record yet", () => {
    renderBar({ context: { kind: "readonly", text: null } });
    expect(screen.queryByTestId("workspace-context")).toBeNull();
  });
});

describe("WorkspaceBar — the right side", () => {
  it("renders the mode's own controls in the slot", () => {
    renderBar({ right: <button type="button">Publish</button> });
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("carries the theme toggle, and changing rooms does not leave the workspace", () => {
    renderBar();
    const group = screen.getByRole("radiogroup", { name: "Theme" });
    fireEvent.click(within(group).getByRole("radio", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dusk");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dusk");
    // Still in the workspace: the bar did not unmount to change rooms.
    expect(screen.getByTestId("workspace-bar")).toBeInTheDocument();
  });
});

describe("WorkspaceBar — the ground rule", () => {
  it("is a three-part grid: back button, the beaver on its own, the account's avatar", () => {
    renderBar();
    const grid = screen.getByTestId("editor-bar");
    expect(grid.getAttribute("style")).toContain("grid-template-columns: 1fr auto 1fr");
    expect(grid.getAttribute("style")).toContain("height: 88px");
    const logo = grid.querySelector("img");
    expect(logo?.getAttribute("alt")).toBe("");
    expect(logo?.getAttribute("src")).toMatch(/beaver-(dark|light)-logo/);
    expect(logo?.getAttribute("width")).toBe("96");
    // A picture, not a link: the back button is the one way out.
    expect(logo?.closest("a")).toBeNull();
    expect(within(grid).getByRole("img", { name: "Maya Okafor" })).toBeInTheDocument();
    expect(within(grid).queryByText("OpenBuilds.ai")).toBeNull();
  });

  it("is 131px: the 88px editor bar and the 43px toolbar under it", () => {
    expect(WORKSPACE_BAR_HEIGHT).toBe(131);
    renderBar();
    expect(screen.getByTestId("workspace-bar").getAttribute("style")).toContain("height: 131px");
    expect(screen.getByTestId("workspace-toolbar").getAttribute("style")).toContain("height: 43px");
  });

  it("puts the ground on --bg and the panels on --recess, with --line hairlines", () => {
    expect(workspaceGround.backgroundColor).toBe("var(--bg)");
    expect(workspacePanel.backgroundColor).toBe("var(--recess)");
    expect(workspacePanel.borderColor).toBe("var(--line)");
  });

  it("carries no glass anywhere in the chrome", () => {
    // The style objects first, because jsdom drops var()-valued colours from
    // the DOM and a token assertion there would pass vacuously.
    for (const style of [
      workspaceGround,
      workspacePanel,
      exitControlStyle(),
      exitControlStyle({ hovered: true }),
      exitControlStyle({ focusVisible: true }),
    ]) {
      expect(JSON.stringify(style)).not.toMatch(/backdropFilter/i);
      expect(JSON.stringify(style)).not.toMatch(/--glass/);
    }

    renderBar({
      context: { kind: "editable", value: "x", onChange: () => {}, label: "Build title" },
    });
    const bar = screen.getByTestId("workspace-bar");
    for (const element of [bar, ...Array.from(bar.querySelectorAll("*"))]) {
      const style = element.getAttribute("style") ?? "";
      expect(style).not.toMatch(/backdrop-filter/i);
    }
  });
});
