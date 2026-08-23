// The compose workspace frame: a full-bleed three-panel workspace.
//
// It renders OUTSIDE NeoScaleShell. The shell's centre column is a hardcoded
// 600x775 panel inside a 3D card flip; a tray, a node tree and an inspector do
// not fit in it and never will. This route takes the whole viewport instead.
//
// The left and centre panels are the tray and the node tree; the right is the
// inspector, which renders the selected node's type schema. The responsive
// decision was made in NS-P07 — single column below 900px, inspector as a
// bottom sheet — and holds unchanged here.
//
// The one DndContext lives at this level because it is the only ancestor the
// tray and the tree share, and a node has to be draggable from one to the other.
// Below 900px the tray moves into a Sheet, which renders through a portal —
// React context still reaches it, so the two panels stay in one drag layer.

import { useEffect, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Build } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import { ComposeTopBar } from "@/components/compose/ComposeTopBar";
import { Inspector } from "@/components/compose/Inspector";
import { NodeTree } from "@/components/compose/NodeTree";
import { TrayPanel } from "@/components/compose/TrayPanel";
import { TypePill } from "@/components/compose/TreeNode";
import { useNodeDrag, type NodeDrag } from "@/components/compose/useNodeDrag";
import {
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  cardGlass,
  labelText,
  panelGlass,
} from "@/components/build/tokens";

/** Below this the three rails cannot hold their content, so the workspace
 *  collapses to the centre panel with the other two behind sheets. */
const SINGLE_COLUMN_MAX = 900;

const LEFT_RAIL_WIDTH = 260;
const RIGHT_RAIL_WIDTH = 340;

/** matchMedia rather than a CSS media query: every surface on this route is
 *  styled inline, and an inline style cannot carry a breakpoint. */
function useIsSingleColumn(): boolean {
  const [isSingleColumn, setIsSingleColumn] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(`(max-width: ${SINGLE_COLUMN_MAX - 1}px)`).matches
  );

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${SINGLE_COLUMN_MAX - 1}px)`);
    const onChange = (event: MediaQueryListEvent) => setIsSingleColumn(event.matches);
    setIsSingleColumn(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isSingleColumn;
}

interface PanelProps {
  compose: ComposeBuild;
  drag: NodeDrag;
}

function LeftPanelContent({ compose, drag }: PanelProps) {
  return (
    <TrayPanel
      tray={compose.tray}
      nodeTypes={compose.nodeTypes}
      selectedNodeId={compose.selectedNodeId}
      onSelect={compose.setSelectedNodeId}
      drag={drag}
    />
  );
}

function CentrePanelContent({ compose, drag }: PanelProps) {
  return (
    <NodeTree
      tree={compose.tree}
      nodeTypes={compose.nodeTypes}
      selectedNodeId={compose.selectedNodeId}
      onSelect={compose.setSelectedNodeId}
      drag={drag}
    />
  );
}

/**
 * What follows the cursor during a drag.
 *
 * It carries the refusal too, so a drop that would go four levels deep says so
 * while the creator is still holding the node rather than only after they have
 * let go of it.
 */
function DragGhost({ compose, drag }: PanelProps) {
  const node = drag.activeNode;
  if (!node) return null;
  const nodeType = compose.nodeTypes.find((type) => type.key === node.type);

  return (
    <div
      style={{
        ...cardGlass,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 12px",
        background: "rgba(16,16,24,0.92)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        fontFamily: FONT_STACK,
        cursor: "grabbing",
        maxWidth: 320,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <TypePill nodeType={nodeType} typeKey={node.type} />
        <span
          style={{
            fontSize: 13,
            fontWeight: 300,
            color: TEXT_PRIMARY,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {node.title || `Untitled ${nodeType?.label ?? node.type}`}
        </span>
      </div>
      {drag.hoverRejection ? (
        <span style={{ ...labelText, fontSize: 11, color: GAP_RED }}>
          {drag.hoverRejection}
        </span>
      ) : null}
    </div>
  );
}

function RightPanelContent({ compose, drag, buildId }: PanelProps & { buildId: string }) {
  return (
    <Inspector
      buildId={buildId}
      compose={compose}
      // The tree's delete, not a second one: it is the path that closes the
      // position gap the removed node leaves behind.
      onDelete={drag.removeNode}
    />
  );
}

interface ComposeFrameProps {
  /** Narrowed by the route: the frame is only reached for a loaded, owned build. */
  build: Build;
  compose: ComposeBuild;
}

export function ComposeFrame({ build, compose }: ComposeFrameProps) {
  const isSingleColumn = useIsSingleColumn();
  const drag = useNodeDrag({
    buildId: build.id,
    tree: compose.tree,
    tray: compose.tray,
    selectedNodeId: compose.selectedNodeId,
    onSelect: compose.setSelectedNodeId,
  });
  const [trayOpen, setTrayOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // Widening past the breakpoint puts both panels back on screen, so a sheet
  // left open would be a second copy of a panel already visible.
  useEffect(() => {
    if (!isSingleColumn) {
      setTrayOpen(false);
      setInspectorOpen(false);
    }
  }, [isSingleColumn]);

  const railScroll: React.CSSProperties = { overflowY: "auto", overflowX: "hidden" };

  return (
    <DndContext
      sensors={drag.sensors}
      collisionDetection={drag.collisionDetection}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragCancel={drag.onDragCancel}
      onDragEnd={drag.onDragEnd}
    >
      <div
        data-visual-slot="compose-frame"
        style={{
          position: "fixed",
          inset: 0,
          background: VOID,
          color: TEXT_PRIMARY,
          fontFamily: FONT_STACK,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          // Its own stacking context, so nothing inside the workspace can escape
          // it and nothing outside it paints through.
          isolation: "isolate",
        }}
      >
        <ComposeTopBar
          build={build}
          isSaving={compose.isSaving}
          lastSavedAt={compose.lastSavedAt}
          saveError={compose.saveError}
          onPatch={compose.patchBuild}
          onOpenTray={isSingleColumn ? () => setTrayOpen(true) : undefined}
          onOpenInspector={isSingleColumn ? () => setInspectorOpen(true) : undefined}
        />

        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {!isSingleColumn && (
            <aside
              data-visual-slot="compose-left"
              aria-label="Tray"
              style={{
                ...panelGlass,
                border: "none",
                borderRight: `1px solid ${HAIRLINE}`,
                width: LEFT_RAIL_WIDTH,
                flexShrink: 0,
                ...railScroll,
              }}
            >
              <LeftPanelContent compose={compose} drag={drag} />
            </aside>
          )}

          <section
            data-visual-slot="compose-centre"
            aria-label="Anatomy"
            style={{ flex: 1, minWidth: 0, ...railScroll }}
          >
            <CentrePanelContent compose={compose} drag={drag} />
          </section>

          {!isSingleColumn && (
            <aside
              data-visual-slot="compose-right"
              aria-label="Inspector"
              style={{
                ...panelGlass,
                border: "none",
                borderLeft: `1px solid ${HAIRLINE}`,
                width: RIGHT_RAIL_WIDTH,
                flexShrink: 0,
                ...railScroll,
              }}
            >
              <RightPanelContent compose={compose} drag={drag} buildId={build.id} />
            </aside>
          )}
        </div>

        {isSingleColumn && (
          <>
            <Sheet open={trayOpen} onOpenChange={setTrayOpen}>
              <SheetContent
                side="left"
                data-visual-slot="modal-surface"
                style={{ ...panelGlass, color: TEXT_PRIMARY, fontFamily: FONT_STACK }}
              >
                <SheetTitle style={{ ...labelText, color: TEXT_SECONDARY }}>Tray</SheetTitle>
                <LeftPanelContent compose={compose} drag={drag} />
              </SheetContent>
            </Sheet>

            <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
              <SheetContent
                side="bottom"
                data-visual-slot="modal-surface"
                style={{
                  ...panelGlass,
                  color: TEXT_PRIMARY,
                  fontFamily: FONT_STACK,
                  maxHeight: "70vh",
                  overflowY: "auto",
                }}
              >
                <SheetTitle style={{ ...labelText, color: TEXT_SECONDARY }}>Inspector</SheetTitle>
                <RightPanelContent compose={compose} drag={drag} buildId={build.id} />
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>

      {/* The ghost follows the cursor rather than the row itself, so a node
          dragged out of a scrolled rail is not clipped by it. */}
      <DragOverlay dropAnimation={null}>
        <DragGhost compose={compose} drag={drag} />
      </DragOverlay>
    </DndContext>
  );
}
