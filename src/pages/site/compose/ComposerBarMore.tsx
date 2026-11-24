// Prompt 19: the editor's More on a phone. The top bar's right slot opens the More sheet; this draws nothing and tells the
// bar what the build's own menu holds: Undo, Redo, Recently removed and Clear the build (the same actions `BuildTitleActions`
// offers, read from the same contexts, so one place decides what each does and when it is off).

import { HISTORY_COPY } from "@/lib/build/buildHistory";
import { CLEAR_COPY } from "@/lib/build/componentMenus";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";

import { useBuildActionsContext } from "./useBuildActions";
import { useBuildHistoryContext } from "./useBuildHistory";

export function ComposerBarMore(): null {
  const history = useBuildHistoryContext();
  const actions = useBuildActionsContext();
  const counts = actions?.clear.counts;
  const empty = !counts || counts.sessions + counts.tiles + counts.files + counts.parts === 0;
  useRegisterPageBar(
    history || actions
      ? {
          more: [
            ...(history
              ? [
                  { label: history.canUndo ? HISTORY_COPY.undoStep(history.undoSentence ?? "") : HISTORY_COPY.undo, disabled: !history.canUndo, onSelect: () => void history.undo() },
                  { label: history.canRedo ? HISTORY_COPY.redoStep(history.redoSentence ?? "") : HISTORY_COPY.redo, disabled: !history.canRedo, onSelect: () => void history.redo() },
                ]
              : []),
            ...(actions?.recentlyRemoved ? [{ label: actions.recentlyRemoved.count > 0 ? `${CLEAR_COPY.recentlyRemoved} (${actions.recentlyRemoved.count})` : CLEAR_COPY.recentlyRemoved, onSelect: actions.recentlyRemoved.open }] : []),
            ...(actions ? [{ label: CLEAR_COPY.menu, tone: "danger" as const, disabled: empty, onSelect: actions.clear.ask }] : []),
          ],
        }
      : null,
  );
  return null;
}

export default ComposerBarMore;
