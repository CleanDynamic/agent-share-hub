import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BuildConnectionsProvider, inCollectionsText, usedInText } from "./BuildConnections";
import { SaveMark, UsedInLine } from "./ConnectionMarks";
import { ClassificationSection } from "./ClassificationSection";
import { emptyClassification } from "@/lib/classify/facets";

describe("SV-25 connection marks", () => {
  it("draws nothing without connections", () => {
    render(<><SaveMark kind="step" id="a" /><UsedInLine id="a" /></>);
    expect(screen.queryByTestId("save-item-marker")).toBeNull();
    expect(screen.queryByTestId("used-in")).toBeNull();
  });

  it("Save shows the filled state and toggles", () => {
    const toggle = vi.fn();
    render(
      <BuildConnectionsProvider value={{ usedIn: new Map(), save: { isSaved: (_k, ref) => ref === "b", toggle } }}>
        <SaveMark kind="session" id="a" />
        <SaveMark kind="step" id="b" />
      </BuildConnectionsProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Save this session" }));
    expect(toggle).toHaveBeenCalledWith("session", "a");
    expect(screen.getByRole("button", { name: "Unsave this tile" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("Used in shows only above zero", () => {
    render(
      <BuildConnectionsProvider value={{ usedIn: new Map([["a", 3]]), save: null }}>
        <UsedInLine id="a" />
        <UsedInLine id="z" />
      </BuildConnectionsProvider>,
    );
    expect(screen.getAllByTestId("used-in")).toHaveLength(1);
    expect(screen.getByText("Used in 3 builds")).toBeTruthy();
  });

  it("words the counts", () => {
    expect(usedInText(1)).toBe("Used in 1 build");
    expect(inCollectionsText(2)).toBe("In 2 collections");
    expect(inCollectionsText(1)).toBe("In 1 collection");
  });

  it("a classification value links to Builds filtered by it", () => {
    const c = emptyClassification();
    c.declared.field = [{ id: "ai-ml" }] as never;
    render(<MemoryRouter><ClassificationSection classification={c} /></MemoryRouter>);
    const link = screen.getAllByTestId("classification-link")[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/builds?f=field%3Aai-ml");
  });
});
