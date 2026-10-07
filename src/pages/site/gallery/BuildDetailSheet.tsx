/* UI-P51 — the build detail sheet: how a build was made, which models, what
   people did with it, and its proof. The sales-crm account sheet, retold.

   PURE like the view it belongs to: props in, markup out. It is built on Radix's
   Dialog (already in the app, behind `components/ui/sheet`) rather than on
   `SheetContent`, because that one is glass with a built-in close button and a
   p-6 frame; this sheet is `--solid` with its own head. Radix gives what the
   prompt asks for: focus is trapped, Escape closes, focus returns to the button
   that opened it, and the page behind is inert while it is open.

   EVERY COLOUR IS A TOKEN.

   DENSER SINCE UI-P56, by the density table (`design/prompts/README-density.md`):
   the head and foot 10px 14px, the body 14 in and its sections 17 apart, the
   figures in 9px cards, session rows 7px 9px, type a step down (14 → 13,
   13 → 12). The brand pieces (Button, IconButton, Segmented, display()) take
   the drawn size and map it themselves; the sparkline is a chart over 64px wide
   and keeps its size. */

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import { Plaque } from "@/components/brand/Plaque";
import { Segmented } from "@/components/brand/Segmented";
import { Sparkline } from "@/components/brand/charts";
import { plaqueBuildFor } from "@/lib/build/signals";
import type { DashboardRow } from "@/lib/build/gallery";
import { modelLabel } from "@/lib/models/registry";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { ENGAGEMENT_WINDOWS, modelShares, sparkValues, windowTotal, type EngagementWindow } from "./dashboardModel";
import { formatCount } from "./galleryModel";

/** Where "How does proof work?" goes. No proof explainer route exists yet, so the About page's proof anchor. */
export const PROOF_EXPLAINER_HREF = "/about#proof";

const mono = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: DM_MONO,
  fontSize: px,
  lineHeight: "normal",
  fontVariantNumeric: "tabular-nums",
  ...extra,
});

const figtree = (px: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  lineHeight: "normal",
  ...extra,
});

const heading: CSSProperties = { ...figtree(13, { fontWeight: 600, color: t.text }), margin: 0 };

const card: CSSProperties = {
  padding: 9,
  borderRadius: 12,
  background: t.cell,
  border: `1px solid ${t.hairline}`,
  boxSizing: "border-box",
};

function StatCard({ label, value, size }: { label: string; value: number; size: number }) {
  return (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={figtree(12, { color: t.text2 })}>{label}</div>
      <div style={mono(size, { color: t.text })}>{formatCount(value)}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <h3 style={heading}>{title}</h3>
      {children}
    </section>
  );
}

export interface BuildDetailSheetProps {
  /** The build to show; the sheet is open exactly when there is one. */
  build: DashboardRow | null;
  onClose: () => void;
}

export function BuildDetailSheet({ build, onClose }: BuildDetailSheetProps) {
  /* Remembered per build: closing and opening another starts again at 30 days. */
  const [windowState, setWindow] = useState<{ id: string | null; days: EngagementWindow }>({ id: null, days: 30 });
  const days = build && windowState.id === build.id ? windowState.days : 30;
  /* Radix returns focus to a Dialog.Trigger, and a row's button is not one: remember who opened the sheet. */
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={build !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Overlay style={{ position: "fixed", inset: 0, zIndex: 50, background: t.sheetDim }} />
        {build ? (
          <Dialog.Content
            data-testid="build-sheet"
            aria-describedby={undefined}
            onOpenAutoFocus={() => {
              const active = document.activeElement;
              opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (opener.current?.isConnected) opener.current.focus();
              opener.current = null;
            }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 51,
              width: "min(560px, 100%)",
              display: "flex",
              flexDirection: "column",
              background: t.solid,
              color: t.text,
              borderLeft: `1px solid ${t.line}`,
              boxShadow: t.shadowSheet,
              outline: "none",
            }}
          >
            <Sheet build={build} days={days} onDays={(next) => setWindow({ id: build.id, days: next })} onClose={onClose} />
          </Dialog.Content>
        ) : null}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Sheet({
  build,
  days,
  onDays,
  onClose,
}: {
  build: DashboardRow;
  days: EngagementWindow;
  onDays: (days: EngagementWindow) => void;
  onClose: () => void;
}) {
  const shares = modelShares(build);
  const total = windowTotal(build.series, days);
  const handle = build.creator.handle;
  const { engagement } = build;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: `1px solid ${t.hairline}`,
        }}
      >
        <span style={figtree(12, { color: t.text2 })}>Build detail</span>
        <IconButton icon={X} size={34} label="Close details" onClick={onClose} />
      </div>

      <div style={{ flexGrow: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 17 }}>
        <div>
          <Dialog.Title asChild>
            <h2 style={{ ...display(28), margin: 0, color: t.text }}>{build.title}</h2>
          </Dialog.Title>
          <p style={{ ...figtree(14, { color: t.text2 }), margin: "4px 0 0" }}>
            by{" "}
            {handle ? (
              <Link to={`/profile/${encodeURIComponent(handle)}`} style={{ color: t.text, textDecoration: "underline", textDecorationColor: t.line }}>
                @{handle}
              </Link>
            ) : (
              "a maker"
            )}
            {build.madeFor.length > 0 ? ` · made for ${build.madeFor.join(", ")}` : null}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          <StatCard label="Sessions" value={build.sessionCount} size={19} />
          <StatCard label="AI models" value={shares.length} size={19} />
          <StatCard label="Prompts" value={build.promptCount} size={19} />
          <StatCard label="AI turns" value={build.aiTurnCount} size={19} />
        </div>

        <Section title="How it was made">
          {build.making.sessions.length === 0 ? (
            <p style={{ ...figtree(12, { color: t.text2 }), margin: 0 }}>No sessions were recorded for this build.</p>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {build.making.sessions.map((session, index) => (
                <li
                  key={index}
                  data-testid="sheet-session"
                  style={{ ...card, padding: "7px 9px", display: "flex", alignItems: "center", columnGap: 7 }}
                >
                  <span style={mono(12, { color: t.text2 })}>{index + 1}</span>
                  <span style={{ ...figtree(13, { color: t.text }), flexGrow: 1, minWidth: 0 }}>
                    {session.client ? `${session.client} · ` : null}
                    <span style={mono(12, { color: t.text })}>{modelLabel(session.model) || "Unknown model"}</span>
                  </span>
                  <span style={mono(12, { color: t.text2, whiteSpace: "nowrap" })}>
                    {session.prompts} prompts · {session.turns} turns
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title="AI models used">
          {shares.length === 0 ? (
            <p style={{ ...figtree(12, { color: t.text2 }), margin: 0 }}>No model was recorded for this build.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {shares.map((entry) => (
                <div key={entry.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span style={mono(12, { color: t.text })}>{entry.name}</span>
                    <span style={figtree(12, { color: t.text2, flexGrow: 1 })}>{entry.lab ? ` · ${entry.lab}` : null}</span>
                    <span style={mono(12, { color: t.text2 })}>{entry.prompts} prompts</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: t.barBase, overflow: "hidden" }}>
                    <div style={{ width: `${Math.round(entry.share * 100)}%`, height: "100%", background: t.evidence }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <section style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 9 }}>
            <h3 style={heading}>Engagement</h3>
            <Segmented
              label="Engagement window"
              size={30}
              fontSize={12}
              value={`${days}`}
              onChange={(next) => onDays(Number(next) as EngagementWindow)}
              items={ENGAGEMENT_WINDOWS.map((value) => ({ value: `${value}`, label: `${value} days` }))}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div>
              <div data-testid="sheet-window-total" style={mono(22, { color: t.text })}>
                {formatCount(total)}
              </div>
              <div style={figtree(12, { color: t.text2 })}>in the last {days} days</div>
            </div>
            <Sparkline values={sparkValues(build.series)} width={220} height={44} label={`${total} engagements in the last ${days} days`} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
            <StatCard label="Runs" value={engagement.runs} size={15} />
            <StatCard label="Rebuilds" value={engagement.rebuilds} size={15} />
            <StatCard label="Comments" value={engagement.comments} size={15} />
            <StatCard label="Saves" value={engagement.saves} size={15} />
          </div>
        </section>

        <Section title="Proof">
          <Plaque build={plaqueBuildFor(build, null)} size="row" />
        </Section>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 9,
          padding: "10px 14px",
          borderTop: `1px solid ${t.hairline}`,
        }}
      >
        <Link to={PROOF_EXPLAINER_HREF} style={{ ...figtree(12, { color: t.text2 }), textDecoration: "none" }}>
          How does proof work?
        </Link>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="secondary" size={38} fontSize={14} onClick={onClose}>
            Close
          </Button>
          <Link
            to={`/b2/${build.slug}`}
            style={{
              /* Close's 38/14 as the Button renders it: 31 tall at 13px, 0 10px. */
              ...figtree(13, { fontWeight: 600, color: t.onAction }),
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 31,
              padding: "0 10px",
              boxSizing: "border-box",
              borderRadius: r.control,
              background: t.action,
              border: `1px solid ${t.action}`,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Open the build
          </Link>
        </div>
      </div>
    </>
  );
}

export default BuildDetailSheet;
