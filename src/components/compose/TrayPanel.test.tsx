// Acceptance cover for the tray rework (NS-P30 part one).
//
// What is being tested is restraint. An empty tray must be one muted line and
// nothing else — no paragraph, no invitation, no promise about material it does
// not hold — and the same panel must grow a list, a privacy line and an arrival
// banner the moment it has something to hold. The drag path underneath all of
// that is unchanged and is covered by TrayDrop.test.tsx; here the concern is
// only what the creator reads.
//
// dnd-kit is replaced rather than driven, as it is in TrayDrop.test.tsx: this
// panel's copy does not depend on a real pointer sensor, and a stub keeps the
// assertions about text rather than about drag internals.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@dnd-kit/core", () => ({
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    isDragging: false,
  }),
}));

import type { BuildNode, NodeType } from "@/lib/build";
import type { NodeDrag } from "./useNodeDrag";
import { TrayPanel } from "./TrayPanel";

const PROMPT_TYPE = {
  key: "prompt",
  label: "Prompt",
  category: "instruction",
  colour: "#E8571A",
  icon: "MessageSquare",
  renderer: "prompt",
  copyable: true,
  is_active: true,
  sort: 1,
  schema: { fields: [] },
} as unknown as NodeType;

function makeNode(id: string, title: string | null): BuildNode {
  return {
    id,
    build_id: "build-1",
    parent_id: null,
    position: null,
    type: "prompt",
    title,
    note: null,
    payload: {},
    source_ref: null,
  } as unknown as BuildNode;
}

/** A drag that is doing nothing, unless a test says the cursor is over the tray. */
function makeDrag(overTray = false): NodeDrag {
  return {
    overTarget: overTray ? { kind: "tray" } : null,
  } as unknown as NodeDrag;
}

function renderTray(options: {
  tray?: BuildNode[];
  justArrived?: number;
  overTray?: boolean;
} = {}) {
  return render(
    <TrayPanel
      tray={options.tray ?? []}
      nodeTypes={[PROMPT_TYPE]}
      selectedNodeId={null}
      onSelect={() => {}}
      drag={makeDrag(options.overTray)}
      justArrived={options.justArrived}
    />
  );
}

describe("TrayPanel", () => {
  describe("with an empty tray", () => {
    it("collapses to the count line and says nothing else", () => {
      renderTray();

      expect(screen.getByTestId("tray-header")).toHaveTextContent("Not placed yet · 0");
      // The paragraph is a promise about material the tray does not hold, so at
      // zero it is not there to be read.
      expect(screen.queryByText(/stay private until you place them/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/never published/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("no longer calls itself the tray", () => {
      renderTray();
      expect(screen.queryByText(/^Tray$/)).not.toBeInTheDocument();
    });

    it("still answers a drag held over it", () => {
      renderTray({ overTray: true });
      // A reply to a gesture the creator is already making — the one thing the
      // collapsed panel still says.
      expect(screen.getByText("Drop it here to unplace it.")).toBeInTheDocument();
    });

    it("shows no drop hint when nothing is being dragged", () => {
      renderTray();
      expect(screen.queryByText("Drop it here to unplace it.")).not.toBeInTheDocument();
    });
  });

  describe("with unplaced nodes", () => {
    it("counts them in the header and lists them", () => {
      renderTray({ tray: [makeNode("n1", "First capture"), makeNode("n2", "Second capture")] });

      expect(screen.getByTestId("tray-header")).toHaveTextContent("Not placed yet · 2");
      expect(screen.getByText("First capture")).toBeInTheDocument();
      expect(screen.getByText("Second capture")).toBeInTheDocument();
      // The type pill each item carries still comes from the registry row.
      expect(screen.getAllByText("Prompt")).toHaveLength(2);
    });

    it("states the privacy promise in plain words", () => {
      renderTray({ tray: [makeNode("n1", "First capture")] });

      expect(
        screen.getByText("These aren't in your post. They stay private until you place them.")
      ).toBeInTheDocument();
      // The NS-P29 wording is gone rather than shown beside the new one.
      expect(screen.queryByText(/Anything left here stays private/i)).not.toBeInTheDocument();
    });
  });

  describe("the arrival banner", () => {
    it("renders nothing when no count is given", () => {
      renderTray({ tray: [makeNode("n1", "First capture")] });
      expect(screen.queryByTestId("tray-arrival")).not.toBeInTheDocument();
    });

    it("renders nothing at zero, so an import that found nothing stays quiet", () => {
      renderTray({ tray: [makeNode("n1", "First capture")], justArrived: 0 });
      expect(screen.queryByTestId("tray-arrival")).not.toBeInTheDocument();
    });

    it("names the count and what to do with it", () => {
      renderTray({
        tray: [makeNode("n1", "First capture"), makeNode("n2", "Second capture")],
        justArrived: 2,
      });

      expect(screen.getByTestId("tray-arrival")).toHaveTextContent(
        "2 items arrived — drag the keepers into your build"
      );
    });

    it("reads as one item rather than 1 items", () => {
      renderTray({ tray: [makeNode("n1", "First capture")], justArrived: 1 });
      expect(screen.getByTestId("tray-arrival")).toHaveTextContent("1 item arrived");
    });

    it("refuses a nonsense count rather than printing it", () => {
      renderTray({ tray: [makeNode("n1", "First capture")], justArrived: -3 });
      expect(screen.queryByTestId("tray-arrival")).not.toBeInTheDocument();
    });
  });
});
