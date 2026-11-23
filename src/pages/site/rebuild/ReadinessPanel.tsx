/* Synth 14: whether the rebuild can be published, the credit it will carry, and the decision, as a section of the side panel.

   Headed by its fact: "One thing before it can be published", "{n} things before it can be published" or "Ready to
   publish". The first missing thing is an underlined link to the editor ("Step 4 has no text yet"). Then "The credit it will
   carry" (13 Text 3) and the credit line, "Rebuilt from <source in Geist Serif> by @maker" (15): part of the record, with no
   control that removes it. Then "Publish rebuild" (main; disabled while not ready, its visible reason under it and linked
   by aria-describedby) and "Keep as draft" (secondary). On a phone the buttons are pinned to the bottom of the screen.

   PURE. */

import { useId } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { WriteFailed } from "@/components/pagestate/PageState";
import { rebuildCreditLine } from "@/components/build/rebuildCredit";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, SENTIENT } from "@/lib/theme/type";

import { publishReason, type ReadinessView, type RebuildCreditView } from "./rebuildModel";
import { SAVE_FAILED } from "@/lib/copy/copy";

export interface ReadinessPanelProps {
  readiness: ReadinessView;
  credit: RebuildCreditView;
  onPublish: () => void;
  onKeepDraft: () => void;
  /** The draft's workspace. The first thing still missing links there: it is where that thing gets done. */
  workspaceTo?: string;
  /** The publish is in flight. */
  publishing?: boolean;
  /** The last publish did not save: said in the panel, with a way to ask again. */
  failure?: { onRetry: () => void; error?: unknown } | null;
  phone?: boolean;
  /** Kept for callers. */
  fill?: boolean;
}

export function CreditBox({ credit }: { credit: RebuildCreditView; phone?: boolean }) {
  const line =
    rebuildCreditLine({ source_title_at_fork: credit.title, source_handle_at_fork: credit.handle }) ?? `Rebuilt from ${credit.title}`;
  return (
    <div data-testid="rebuild-credit-box" style={{ marginTop: 16 }}>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>The credit it will carry</p>
      <p
        data-testid="rebuild-credit-line"
        data-rebuild-credit=""
        title={line}
        style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text }}
      >
        Rebuilt from <i style={{ fontStyle: "normal", fontFamily: SENTIENT }}>{credit.title}</i>
        {credit.handle ? ` by @${credit.handle}` : null}
      </p>
      {credit.delta ? (
        <p data-testid="rebuild-credit-delta" style={{ margin: "4px 0 0", fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.text2, overflowWrap: "anywhere" }}>
          {credit.delta}
        </p>
      ) : null}
    </div>
  );
}

/** The missing thing, as a way to the place it gets done: underlined, in the line's own ink. */
function NextLink({ to, children }: { to: string; children: string }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      data-testid="rebuild-next"
      data-hit=""
      {...handlers}
      style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3, borderRadius: r.chip, ...ring(state.focusVisible) }}
    >
      {children}
    </Link>
  );
}

export function ReadinessPanel({
  readiness,
  credit,
  onPublish,
  onKeepDraft,
  workspaceTo,
  publishing = false,
  failure = null,
  phone = false,
}: ReadinessPanelProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const nextId = `rebuild-next-${id}`;
  const reasonId = `rebuild-reason-${id}`;
  const blocked = !readiness.ready;
  const reason = blocked ? publishReason(readiness.next) : null;

  const actions = (
    <div
      data-testid="rebuild-actions"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: 16,
        ...(phone ? { position: "sticky", bottom: 0, padding: "12px 0", background: t.surface, zIndex: 2 } : null),
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button
          data-testid="rebuild-publish"
          variant="primary"
          size={phone ? 44 : 32}
          fontSize={13}
          fullWidth={phone}
          disabled={blocked || publishing}
          aria-describedby={reason ? reasonId : blocked && readiness.next ? nextId : undefined}
          onClick={onPublish}
        >
          {publishing ? "Publishing…" : "Publish rebuild"}
        </Button>
        <Button data-testid="rebuild-keep-draft" variant="secondary" size={phone ? 44 : 32} fontSize={13} fullWidth={phone} onClick={onKeepDraft}>
          Keep as draft
        </Button>
      </div>
      {reason ? (
        <p id={reasonId} data-testid="rebuild-publish-reason" style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>
          {reason}
        </p>
      ) : null}
    </div>
  );

  return (
    <section aria-labelledby={`rebuild-ready-${id}`}>
      <div data-testid="readiness-panel" data-ready={readiness.ready ? "" : undefined}>
        <h2 id={`rebuild-ready-${id}`} style={{ margin: 0, fontFamily: FIGTREE, fontSize: 20, fontWeight: 600, lineHeight: "24px", color: t.text }}>
          {readiness.headline}
        </h2>
        {readiness.next ? (
          <p id={nextId} style={{ margin: "8px 0 0", fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text }}>
            {workspaceTo ? <NextLink to={workspaceTo}>{readiness.next}</NextLink> : readiness.next}
          </p>
        ) : null}
        <CreditBox credit={credit} phone={phone} />
        {actions}
        {failure ? (
          <WriteFailed line={SAVE_FAILED} panel="Publish rebuild" onRetry={failure.onRetry} error={failure.error} style={{ marginTop: 9 }} data-testid="rebuild-publish-error" />
        ) : null}
      </div>
    </section>
  );
}

export default ReadinessPanel;
