// UX-15 P5: "Block @maya? They won't be told." The confirmation every Block action shares: the profile's `···`, a topic's and a reply's
// `···`, and a message thread's menu. It is the site's modal recipe (`ModalShell`: the window on a desktop, the bottom sheet on a
// phone), with the question as its title, one sentence under it, and `Cancel` and `Block`. Blocking writes one row (`blockUser`); the page
// then reads again what a block changes.

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/brand/Button";
import { BLOCK_COPY, blockUser } from "@/lib/settings/blocks";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { ModalShell } from "@/pages/site/compose/ModalFrame";

export interface BlockTarget {
  id: string;
  handle: string;
}

/** The queries a block changes: the feeds, the profile, the lists of posts and the settings list itself. */
const AFFECTED = new Set(["settings", "feed", "profile", "openbuilds", "posts", "post", "notifications", "messages"]);

export function BlockDialog({ target, viewerId, onClose, onBlocked }: { target: BlockTarget | null; viewerId: string | null; onClose: () => void; onBlocked?: (target: BlockTarget) => void }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const confirm = async () => {
    if (!target || !viewerId || busy) return;
    setBusy(true);
    setRefusal(null);
    try {
      await blockUser(viewerId, target.id);
      await queryClient.invalidateQueries({ predicate: (query) => AFFECTED.has(String(query.queryKey[0])) });
      onBlocked?.(target);
      onClose();
    } catch {
      setRefusal("Couldn't block them. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      open={target !== null}
      onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}
      title={target ? `Block @${target.handle}?` : "Block"}
      subtitle="They won't be told."
      width={400}
      testId="block-dialog"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, fontFamily: FIGTREE }}>
        {refusal ? (
          <p role="alert" style={{ margin: 0, fontSize: 12, color: t.catBreakage }}>
            {refusal}
          </p>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" size={32} fontSize={12} disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" size={32} fontSize={12} disabled={busy} onClick={() => void confirm()}>
            {BLOCK_COPY.confirmButton}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

export default BlockDialog;
