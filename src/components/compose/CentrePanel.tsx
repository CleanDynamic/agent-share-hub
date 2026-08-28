// The centre panel, and the toggle between the two dimensions of a build.
//
// Anatomy is what the build is made of. Sequence is what happened while it was
// made. Neither is a view of the other — a node has no ordinal and an event has
// no parent — so the panel switches between them rather than trying to draw
// both at once.
//
// NODETREE IS NEVER UNMOUNTED, and that is the whole reason this file is a
// wrapper rather than a conditional inside ComposeFrame. The tree holds its
// collapsed set in its own state, as it should: which branches a creator has
// folded is a property of the view, not of the record, and pushing it up into a
// hook to survive a toggle would be a worse component for the sake of a worse
// reason. So the tree stays mounted and hidden, and a creator who collapses
// four branches, checks the sequence and comes back finds their tree as they
// left it. Hidden with `display: none` on a wrapper this file owns — nothing
// that already lays the workspace out is touched.
//
// The sequence query is lazy. It does not fire until the creator has opened the
// tab once, because the compose route is already the heaviest page in the
// application and a creator who only ever edits the anatomy should not pay for
// a read they never look at.

import { useMemo, useState } from "react";
import { GitBranch, ListOrdered } from "lucide-react";
import type { ComposeBuild } from "@/hooks/useComposeBuild";
import type { NodeTreatment } from "@/hooks/useRebuildDiff";
import {
  FONT_STACK,
  TEAL,
  TEXT_MUTED,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";
import { CONTROL_BACKGROUND, CONTROL_BORDER } from "@/components/compose/fields";
import { NodeTree } from "./NodeTree";
import { SequenceView } from "./SequenceView";
import type { NodeLinkOption } from "./EventNodeLink";
import { flattenNodes, useSequence } from "./useSequence";
import type { NodeDrag } from "./useNodeDrag";

export type CentreView = "anatomy" | "sequence";

const TABS: { view: CentreView; label: string; Icon: typeof GitBranch }[] = [
  { view: "anatomy", label: "Anatomy", Icon: GitBranch },
  { view: "sequence", label: "Sequence", Icon: ListOrdered },
];

interface CentrePanelProps {
  buildId: string;
  compose: ComposeBuild;
  drag: NodeDrag;
  /** The rebuild treatment for the anatomy's rows. Null on an ordinary draft. */
  rebuildNodes?: Map<string, NodeTreatment> | null;
}

export function CentrePanel({ buildId, compose, drag, rebuildNodes }: CentrePanelProps) {
  const [view, setView] = useState<CentreView>("anatomy");
  /** Once true it stays true: leaving the tab must not throw the query away and
   *  make coming back a second round trip. */
  const [sequenceOpened, setSequenceOpened] = useState(false);

  const sequence = useSequence({ buildId, active: sequenceOpened });

  /** Every node of the build, placed and trayed, for the event-to-node picker.
   *  Flattened once here rather than once per row: a hundred rows is a hundred
   *  pickers over one list. */
  const nodeOptions = useMemo<NodeLinkOption[]>(() => {
    const typesByKey = new Map(compose.nodeTypes.map((type) => [type.key, type]));
    const trayIds = new Set(compose.tray.map((node) => node.id));
    return flattenNodes(compose.tree, compose.tray).map((node) => ({
      node,
      nodeType: typesByKey.get(node.type),
      placed: !trayIds.has(node.id),
    }));
  }, [compose.nodeTypes, compose.tray, compose.tree]);

  const choose = (next: CentreView) => {
    if (next === "sequence") setSequenceOpened(true);
    setView(next);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, fontFamily: FONT_STACK }}>
      <div
        role="tablist"
        aria-label="Build dimension"
        style={{
          display: "flex",
          gap: 2,
          padding: 3,
          margin: "16px 16px 0",
          borderRadius: 10,
          border: `1px solid ${CONTROL_BORDER}`,
          background: CONTROL_BACKGROUND,
          alignSelf: "flex-start",
        }}
      >
        {TABS.map(({ view: tab, label, Icon }) => {
          const active = view === tab;
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`centre-tab-${tab}`}
              aria-selected={active}
              aria-controls={`centre-panel-${tab}`}
              onClick={() => choose(tab)}
              style={{
                ...labelText,
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 12px",
                borderRadius: 8,
                border: `1px solid ${active ? hexToRgba(TEAL, 0.35) : "transparent"}`,
                background: active ? hexToRgba(TEAL, 0.14) : "transparent",
                color: active ? TEAL : TEXT_MUTED,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
            </button>
          );
        })}
        {sequence.events.length > 0 ? (
          <span
            style={{
              ...labelText,
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              fontSize: 10,
              color: TEXT_MUTED,
            }}
          >
            {sequence.events.length}
          </span>
        ) : null}
      </div>

      {/* Both panels are always rendered. The inactive one is hidden rather
          than removed, so the tree keeps its collapsed branches and the
          sequence keeps its selection and its page. */}
      <div
        id="centre-panel-anatomy"
        role="tabpanel"
        aria-labelledby="centre-tab-anatomy"
        hidden={view !== "anatomy"}
        style={{ display: view === "anatomy" ? "block" : "none" }}
      >
        <NodeTree
          tree={compose.tree}
          nodeTypes={compose.nodeTypes}
          selectedNodeId={compose.selectedNodeId}
          onSelect={compose.setSelectedNodeId}
          drag={drag}
          rebuildNodes={rebuildNodes}
        />
      </div>

      <div
        id="centre-panel-sequence"
        role="tabpanel"
        aria-labelledby="centre-tab-sequence"
        hidden={view !== "sequence"}
        style={{ display: view === "sequence" ? "block" : "none" }}
      >
        {sequenceOpened ? (
          <SequenceView sequence={sequence} nodeOptions={nodeOptions} />
        ) : null}
      </div>
    </div>
  );
}
