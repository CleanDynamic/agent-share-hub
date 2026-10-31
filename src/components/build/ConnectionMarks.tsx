// The pieces of SV-25 that sit on a tile or a session head. Each draws nothing without BuildConnections.

import { SaveItemMarker } from "@/components/social/SaveItemMarker";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { usedInText, useBuildConnections, type SaveKind } from "./BuildConnections";

/** Save for a tile (a step), a part or a session. */
export function SaveMark({ kind, id }: { kind: SaveKind; id: string }) {
  const save = useBuildConnections()?.save;
  if (!save) return null;
  return <SaveItemMarker saved={save.isSaved(kind, id)} what={kind === "session" ? "session" : kind === "part" ? "part" : "tile"} onPress={() => save.toggle(kind, id)} />;
}

/** "Used in n builds", when n is above 0. */
export function UsedInLine({ id, indent = 0 }: { id: string; indent?: number }) {
  const n = useBuildConnections()?.usedIn.get(id) ?? 0;
  if (n <= 0) return null;
  return (
    <span data-testid="used-in" style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 400, color: t.label, paddingLeft: indent, fontVariantNumeric: "tabular-nums" }}>
      {usedInText(n)}
    </span>
  );
}
