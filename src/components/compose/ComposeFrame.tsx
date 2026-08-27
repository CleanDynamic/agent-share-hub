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
//
// The media context is mounted here for the same reason: the upload control in
// the inspector and the file-drop path on the frame itself are the same
// upload, and this is the only ancestor both of them have. dnd-kit drags are
// pointer events, not HTML5 drag-and-drop, so a node being dragged around the
// tree and a file being dragged in from the desktop never meet.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Build } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import { MediaProvider, useComposeMedia } from "@/hooks/useComposeMedia";
import { nodeMediaId } from "@/components/build/MediaFigure";
import { ComposeTopBar } from "@/components/compose/ComposeTopBar";
import { CoverStrip } from "@/components/compose/CoverStrip";
import { CompletenessPanel } from "@/components/compose/CompletenessPanel";
import { Inspector } from "@/components/compose/Inspector";
import { LayerStaleNotice } from "@/components/compose/LayerStaleNotice";
import { findNodeInRecord } from "@/components/compose/SchemaForm";
import { CentrePanel } from "@/components/compose/CentrePanel";
import { TrayPanel } from "@/components/compose/TrayPanel";
import { TypePill } from "@/components/compose/TreeNode";
import { useNodeDrag, type NodeDrag } from "@/components/compose/useNodeDrag";
import {
  FONT_STACK,
  GAP_RED,
  HAIRLINE,
  TEAL,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  cardGlass,
  hexToRgba,
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

/**
 * The inspector, the checklist beneath it, and the staleness line beneath that.
 *
 * One component so the set travels together into the bottom sheet below the
 * breakpoint: a creator on a narrow screen gets the same panels in the same
 * order, rather than a checklist that only exists on a wide one.
 *
 * The checklist adds a node through the tree's own add — the same call the
 * "+ Add node" menu makes — so a node it creates lands at the selected level
 * and is selected, exactly as one added by hand would be.
 */
function RightPanelContent({
  compose,
  drag,
  buildId,
  build,
}: PanelProps & { buildId: string; build: Build }) {
  return (
    <>
      <Inspector
        buildId={buildId}
        compose={compose}
        // The tree's delete, not a second one: it is the path that closes the
        // position gap the removed node leaves behind.
        onDelete={drag.removeNode}
      />
      <CompletenessPanel
        build={build}
        completeness={compose.completeness}
        tree={compose.tree}
        nodeTypes={compose.nodeTypes}
        onPatch={compose.patchBuild}
        onSelectNode={compose.setSelectedNodeId}
        onAddNode={drag.addNode}
      />
      {/* Last in the rail and quiet by design: it is a question about text a
          reader may be seeing, not a step in making the build. */}
      <LayerStaleNotice build={build} tree={compose.tree} />
    </>
  );
}

/** True when what is being dragged came from outside the browser. */
function carriesFiles(event: React.DragEvent): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}

/**
 * What a file dragged over the workspace is told will happen to it.
 *
 * Its own element rather than a treatment on the frame: nothing that already
 * lays this page out is touched, and the overlay takes no pointer events, so
 * the drop still lands on whatever is underneath it.
 */
function FileDropOverlay({ uploading }: { uploading: boolean }) {
  return (
    <div
      data-visual-slot="compose-file-drop"
      aria-hidden={!uploading}
      role={uploading ? "status" : undefined}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: 24,
        border: uploading ? "none" : `2px dashed ${hexToRgba(TEAL, 0.5)}`,
        background: uploading ? "transparent" : hexToRgba(TEAL, 0.04),
        zIndex: 5,
      }}
    >
      <span
        style={{
          ...labelText,
          color: TEAL,
          background: "rgba(8,8,12,0.9)",
          border: `1px solid ${hexToRgba(TEAL, 0.3)}`,
          borderRadius: 999,
          padding: "7px 14px",
        }}
      >
        {uploading ? "Uploading to the tray…" : "Drop to add to the tray"}
      </span>
    </div>
  );
}

interface ComposeFrameProps {
  /** Narrowed by the route: the frame is only reached for a loaded, owned build. */
  build: Build;
  compose: ComposeBuild;
}

/**
 * The workspace, inside the media context.
 *
 * Split from ComposeFrame only so the frame's own file-drop handlers can use
 * the context the frame mounts — a provider cannot be consumed by the
 * component that renders it.
 */
function ComposeWorkspace({ build, compose }: ComposeFrameProps) {
  const isSingleColumn = useIsSingleColumn();
  const media = useComposeMedia();
  const drag = useNodeDrag({
    buildId: build.id,
    tree: compose.tree,
    tray: compose.tray,
    selectedNodeId: compose.selectedNodeId,
    onSelect: compose.setSelectedNodeId,
  });
  const [trayOpen, setTrayOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  /** Whether the selected node could be the hero. See HeroControl. */
  const heroEligible = useMemo(() => {
    if (!compose.selectedNodeId) return false;
    const node = findNodeInRecord(
      { tree: compose.tree, tray: compose.tray },
      compose.selectedNodeId
    );
    if (!node) return false;
    if (node.type === "live_app") return true;
    return Boolean(media?.resolveMedia(nodeMediaId(node)));
  }, [compose.selectedNodeId, compose.tray, compose.tree, media]);

  /**
   * A file dragged in from outside, over the workspace but not over a field.
   *
   * The depth counter is what makes dragleave trustworthy: crossing from the
   * frame onto a panel inside it fires leave then enter, and a boolean would
   * flicker off on every internal boundary.
   */
  const [fileOver, setFileOver] = useState(false);
  const fileDepth = useRef(0);

  const onFileDragEnter = useCallback((event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    fileDepth.current += 1;
    setFileOver(true);
  }, []);

  const onFileDragOver = useCallback((event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    // Without this the browser refuses the drop and opens the file instead.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const onFileDragLeave = useCallback((event: React.DragEvent) => {
    if (!carriesFiles(event)) return;
    fileDepth.current = Math.max(0, fileDepth.current - 1);
    if (fileDepth.current === 0) setFileOver(false);
  }, []);

  const onFileDrop = useCallback(
    (event: React.DragEvent) => {
      if (!carriesFiles(event)) return;
      // A drop on a media field stops propagating before it reaches here, so
      // anything that arrives was dropped on empty space.
      event.preventDefault();
      fileDepth.current = 0;
      setFileOver(false);
      const files = Array.from(event.dataTransfer.files ?? []);
      if (files.length > 0) void media?.uploadToTray(files);
    },
    [media]
  );

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
        onDragEnter={onFileDragEnter}
        onDragOver={onFileDragOver}
        onDragLeave={onFileDragLeave}
        onDrop={onFileDrop}
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
          selectedNodeId={compose.selectedNodeId}
          heroEligible={heroEligible}
          isSaving={compose.isSaving}
          lastSavedAt={compose.lastSavedAt}
          saveError={compose.saveError}
          onPatch={compose.patchBuild}
          tree={compose.tree}
          nodeTypes={compose.nodeTypes}
          completeness={compose.completeness}
          onPublish={compose.publish}
          isPublishing={compose.isPublishing}
          publishError={compose.publishError}
          onOpenTray={isSingleColumn ? () => setTrayOpen(true) : undefined}
          onOpenInspector={isSingleColumn ? () => setInspectorOpen(true) : undefined}
        />

        {/* A NEW element between the bar and the panels. The row below is
            flex:1, so it absorbs whatever height this takes and nothing that
            already lays the workspace out changes. */}
        <CoverStrip
          build={build}
          onPatch={compose.patchBuild}
          stacked={isSingleColumn}
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
            aria-label="Anatomy and sequence"
            style={{ flex: 1, minWidth: 0, ...railScroll }}
          >
            <CentrePanel buildId={build.id} compose={compose} drag={drag} />
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
              <RightPanelContent
                compose={compose}
                drag={drag}
                buildId={build.id}
                build={build}
              />
            </aside>
          )}
        </div>

        {(fileOver || media?.isUploadingToTray) && (
          <FileDropOverlay uploading={Boolean(media?.isUploadingToTray)} />
        )}

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
                <RightPanelContent
                  compose={compose}
                  drag={drag}
                  buildId={build.id}
                  build={build}
                />
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

/**
 * The workspace frame.
 *
 * Everything below it — the panels, the inspector's upload control, the drop
 * path on the frame itself — reads the build's media from one query held here.
 */
export function ComposeFrame({ build, compose }: ComposeFrameProps) {
  return (
    <MediaProvider buildId={build.id} nodeId={compose.selectedNodeId}>
      <ComposeWorkspace build={build} compose={compose} />
    </MediaProvider>
  );
}
