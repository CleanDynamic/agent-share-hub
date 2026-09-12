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
  it("reads as the wordmark and is reachable by its destination's name", () => {
    renderBar();
    expect(exit()).toHaveTextContent("buildgallery");
    expect(screen.getByLabelText("Back to the gallery")).toBe(exit());
  });

  it("goes to the gallery on compose and rebuild", () => {
    for (const mode of ["compose", "rebuild"] as const) {
      const view = renderBar({ mode });
      expect(exit()).toHaveAttribute("href", "/gallery");
      fireEvent.click(exit());
      expect(screen.getByTestId("landed")).toHaveTextContent("gallery");
      view.unmount();
    }
  });

  it("goes where convert sent it, and names that destination rather than the gallery", () => {
    renderBar({ mode: "convert", to: "/content/xyz", hint: "Back to the post" });
    expect(exit()).toHaveAttribute("href", "/content/xyz");
    expect(exit()).toHaveAccessibleName("Back to the post");
    fireEvent.click(exit());
    expect(screen.getByTestId("landed")).toHaveTextContent("post");
  });

  it("is a control and not a bare link: a fill, a visible border, a control radius", () => {
    const resting = exitControlStyle();
    expect(resting.backgroundColor).toBe("var(--recess)");
    // --text2, not --line: --line on --bg measures 1.30:1 and 1.82:1, under the
    // 3.0 floor, and would leave the exit reading as a label.
    expect(resting.borderColor).toBe("var(--text2)");
    expect(resting.borderWidth).toBe(1);
    expect(resting.borderRadius).toBe("var(--r-control)");
    expect(resting.color).toBe("var(--text)");
    expect(resting.textDecoration).toBe("none");

    // Taller than the 30–32px controls beside it — its only emphasis.
    expect(resting.height).toBe(36);

    renderBar();
    expect(exit().getAttribute("style")).toContain("var(--r-control)");
  });

  it("answers hover and keyboard focus, so its states are visible", () => {
    const hovered = exitControlStyle({ hovered: true });
    expect(hovered.backgroundColor).toBe("var(--line)");
    expect(hovered.borderColor).toBe("var(--text)");
    expect(hovered.backgroundColor).not.toBe(exitControlStyle().backgroundColor);

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
      expect(badge.getAttribute("style")).toContain("DM Mono");
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
    fireEvent.click(within(group).getByRole("radio", { name: "Dusk" }));

    expect(document.documentElement.dataset.theme).toBe("dusk");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dusk");
    // Still in the workspace: the bar did not unmount to change rooms.
    expect(screen.getByTestId("workspace-bar")).toBeInTheDocument();
  });
});

describe("WorkspaceBar — the ground rule", () => {
  it("is 52px, which is the height ComposeTopBar has always been", () => {
    expect(WORKSPACE_BAR_HEIGHT).toBe(52);
    renderBar();
    expect(screen.getByTestId("workspace-bar").getAttribute("style")).toContain(
      "height: 52px",
    );
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
