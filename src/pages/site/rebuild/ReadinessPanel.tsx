/* UI-P31 — whether the rebuild can hang, the credit it will carry, and the
   decision.

   A ring orb at the gate's figure (rebuildReadiness(): the three things every
   record needs to be published, and the one a rebuild adds — it has to change
   something), the headline ("One thing before it can hang", "{n} things…",
   "Ready to hang") and the first thing still missing. Under them the credit the
   rebuild will carry: "Rebuilt from *source* by @maker" from the two columns
   the fork froze (rebuildCreditLine's sentence, so it cannot drift), and the Δ
   line. It is part of the record, structural: there is no control here that
   removes it. Then the one primary, "Publish rebuild" (publishRebuild()), which
   says why it cannot be pressed yet while the gate is closed, and "Keep as
   draft", which goes back to the workspace the draft lives in. The first thing
   still missing links to that workspace too: it is where the thing gets done,
   and on a phone, where the board draws Publish alone, it is the way on.

   Desktop: a row (OrbRing 120; Rebuild readiness, display 22, Figtree 12),
   the credit box 14 below, the actions 14 below. Phone: OrbRing 112, display 20,
   Figtree 13, the credit's sentence at 14, a full-width 48/15 primary.

   PURE. */

import { useId } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { OrbRing } from "@/components/brand/OrbRing";
import { Panel } from "@/components/brand/Panel";
import { rebuildCreditLine } from "@/components/build/rebuildCredit";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import type { ReadinessView, RebuildCreditView } from "./rebuildModel";

export interface ReadinessPanelProps {
  readiness: ReadinessView;
  credit: RebuildCreditView;
  onPublish: () => void;
  onKeepDraft: () => void;
  /**
   * The draft's workspace. The first thing still missing links there — it is
   * where that thing gets done — which on a phone, where the board draws
   * Publish alone, is the way on while Publish cannot be pressed.
   */
  workspaceTo?: string;
  /** The publish is in flight. */
  publishing?: boolean;
  /** The last publish did not save: said in the panel, with a way to ask again. */
  failure?: { onRetry: () => void; error?: unknown } | null;
  phone?: boolean;
  /** The desktop column's fixed height. */
  fill?: boolean;
}

export function CreditBox({ credit, phone = false }: { credit: RebuildCreditView; phone?: boolean }) {
  const line =
    rebuildCreditLine({ source_title_at_fork: credit.title, source_handle_at_fork: credit.handle }) ?? `Rebuilt from ${credit.title}`;
  return (
    <div
      data-testid="rebuild-credit-box"
      style={{ marginTop: 14, padding: "12px 14px", borderRadius: r.control, background: t.inset, border: `1px solid ${t.line}` }}
    >
      <Eyebrow size={10}>The credit it will carry</Eyebrow>
      <p
        data-testid="rebuild-credit-line"
        data-rebuild-credit=""
        title={line}
        style={{ margin: "6px 0 0", fontFamily: FIGTREE, fontSize: phone ? 14 : 13, lineHeight: "normal", color: t.text }}
      >
        Rebuilt from <i>{credit.title}</i>
        {credit.handle ? ` by @${credit.handle}` : null}
      </p>
      {credit.delta ? (
        <p
          data-testid="rebuild-credit-delta"
          style={{ margin: "3px 0 0", fontFamily: DM_MONO, fontSize: 11, lineHeight: "normal", color: t.text2, overflowWrap: "anywhere" }}
        >
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
  fill = false,
}: ReadinessPanelProps) {
  const nextId = `rebuild-next-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const blocked = !readiness.ready;
  const orb = (
    <OrbRing
      size={phone ? 112 : 120}
      percent={readiness.pct}
      value={`${readiness.pct}%`}
      caption="ready"
      label={`${readiness.pct}% ready. ${readiness.headline}.`}
    />
  );

  const publish = (
    <Button
      data-testid="rebuild-publish"
      variant="primary"
      size={phone ? 48 : 36}
      fontSize={phone ? 15 : 13}
      icon={Check}
      fullWidth={phone}
      disabled={blocked || publishing}
      aria-describedby={blocked && readiness.next ? nextId : undefined}
      title={blocked ? (readiness.next ?? undefined) : undefined}
      onClick={onPublish}
    >
      {publishing ? "Publishing…" : "Publish rebuild"}
    </Button>
  );

  return (
    <Panel padding={phone ? "16px" : "16px 18px"} style={fill ? { height: "100%" } : undefined}>
      <div data-testid="readiness-panel" data-ready={readiness.ready ? "" : undefined}>
        <div style={{ display: "flex", gap: phone ? 14 : 16, alignItems: "center" }}>
          {orb}
          <div style={{ display: "flex", flexDirection: "column", gap: phone ? 6 : 8, minWidth: 0 }}>
            <Eyebrow>{phone ? "Readiness" : "Rebuild readiness"}</Eyebrow>
            <div style={{ ...display(phone ? 20 : 22), lineHeight: 1.1, letterSpacing: "-0.02em", color: t.text }}>{readiness.headline}</div>
            {readiness.next ? (
              <div id={nextId} style={{ fontFamily: FIGTREE, fontSize: phone ? 13 : 12, lineHeight: "normal", color: t.text2 }}>
                {workspaceTo ? <NextLink to={workspaceTo}>{readiness.next}</NextLink> : readiness.next}
              </div>
            ) : null}
          </div>
        </div>
        <CreditBox credit={credit} phone={phone} />
        {phone ? (
          <div style={{ marginTop: 14 }}>{publish}</div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {publish}
            <Button data-testid="rebuild-keep-draft" variant="ghost" size={36} fontSize={13} onClick={onKeepDraft}>
              Keep as draft
            </Button>
          </div>
        )}
        {failure ? (
          <ErrorState
            line="That didn't save."
            panel="Publish rebuild"
            onRetry={failure.onRetry}
            error={failure.error}
            style={{ marginTop: 12 }}
            data-testid="rebuild-publish-error"
          />
        ) : null}
      </div>
    </Panel>
  );
}

export default ReadinessPanel;
