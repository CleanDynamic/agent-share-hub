// The compose workspace frame: a full-bleed three-panel workspace.
//
// It renders OUTSIDE NeoScaleShell. The shell's centre column is a hardcoded
// 600x775 panel inside a 3D card flip; a tray, a node tree and an inspector do
// not fit in it and never will. This route takes the whole viewport instead.
//
// The three panels are labelled placeholders in NS-P07. NS-P08 fills the left
// and centre, NS-P09 fills the right. The responsive decision is made here and
// now — single column below 900px, inspector as a bottom sheet — so that
// neither later prompt has to retrofit it.

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { Build } from "@/lib/build";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import { ComposeTopBar } from "@/components/compose/ComposeTopBar";
import {
  FONT_STACK,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  VOID,
  bodyText,
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

/**
 * What each panel shows until the prompt that fills it lands.
 *
 * The placeholder names the panel and the prompt that fills it, so a build of
 * this branch is legible rather than looking like three broken columns.
 */
function PanelPlaceholder({
  label,
  detail,
  arrives,
}: {
  label: string;
  detail: string;
  arrives: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 18,
      }}
    >
      <span style={{ ...labelText, textTransform: "uppercase", color: TEXT_SECONDARY }}>
        {label}
      </span>
      <p style={{ ...bodyText, margin: 0, color: TEXT_MUTED }}>{detail}</p>
      <span style={{ ...labelText, color: TEXT_MUTED }}>{arrives}</span>
    </div>
  );
}

function LeftPanelContent() {
  return (
    <PanelPlaceholder
      label="Tray"
      detail="Unplaced nodes wait here until they are dragged into the tree."
      arrives="arrives in NS-P08"
    />
  );
}

function CentrePanelContent({ build }: { build: Build }) {
  return (
    <PanelPlaceholder
      label="Anatomy"
      detail={`The nested node tree for “${build.title || "Untitled build"}”, reorderable by drag.`}
      arrives="arrives in NS-P08"
    />
  );
}

function RightPanelContent() {
  return (
    <PanelPlaceholder
      label="Inspector"
      detail="The selected node's typed fields, rendered from its node_types schema."
      arrives="arrives in NS-P09"
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
            <LeftPanelContent />
          </aside>
        )}

        <section
          data-visual-slot="compose-centre"
          aria-label="Anatomy"
          style={{ flex: 1, minWidth: 0, ...railScroll }}
        >
          <CentrePanelContent build={build} />
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
            <RightPanelContent />
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
              <LeftPanelContent />
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
              <RightPanelContent />
            </SheetContent>
          </Sheet>
        </>
      )}
    </div>
  );
}
