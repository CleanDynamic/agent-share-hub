/* UI-P74 — the build page's Map, read-only (board B2-PageMap, V5-TeamMap).

   The composer's `BuildMap` in reader mode, with nothing to drag, and a reading panel on the right that
   says exactly what to do with the step picked: its full text with Copy, "Before you send it", and what
   comes Then. Clicking a box selects it and dims the rest; Esc clears; double-click or Enter opens the
   full prompt window; an agent's or a team's "Open" shows its own map in place, with "Back to build".

   LOADED ON DEMAND: `BuildSteps` imports this file with `React.lazy`, so none of the map's layout code
   is downloaded until a reader chooses Map. */

import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Copy, Check, X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { IconButton } from "@/components/brand/IconButton";
import type { ReaderStep } from "@/lib/build/readerSteps";
import { tokenAlpha, t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { BuildMap } from "../compose/BuildMap";
import { BeforeYouSend, hasBeforeYouSend } from "./BeforeYouSend";
import type { BuildStepsView } from "./buildModel";

export interface ReaderMapProps {
  view: BuildStepsView;
  announce: (text: string) => void;
  /** Open the full prompt window on a step. */
  onRead: (id: string) => void;
  /** Where the Map starts: a team opened with its first agent selected ("See the team in Map"). */
  start?: { opened: string | null; selected: string | null } | null;
}

const flatten = (list: readonly ReaderStep[]): ReaderStep[] => list.flatMap((entry) => [entry, ...flatten(entry.children)]);

const mono = (size: 11 | 11.5 | 12): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, lineHeight: "normal", color: t.text2 });

function Chip({ children }: { children: string }) {
  return (
    <span style={{ minHeight: 24, padding: "0 8px", boxSizing: "border-box", borderRadius: 8, display: "inline-flex", alignItems: "center", background: tokenAlpha("action", 0.12), color: t.text, fontFamily: DM_MONO, fontSize: 11.5, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export default function ReaderMap({ view, announce, onRead, start }: ReaderMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(start?.selected ?? null);
  const [openedId, setOpenedId] = useState<string | null>(start?.opened ?? null);
  const [copied, setCopied] = useState(false);

  const steps = useMemo(() => view.steps.map((entry) => entry.step), [view.steps]);
  const all = useMemo(() => flatten(view.steps), [view.steps]);
  const byId = useMemo(() => new Map(all.map((entry) => [entry.step.id, entry])), [all]);
  const opened = openedId ? (byId.get(openedId)?.step ?? null) : null;

  /** The tool each step's chat was in: a "same chat" step has its session's. */
  const toolOf = useMemo(() => {
    const tools = new Map<string, string | null>();
    let current: string | null = null;
    for (const entry of view.steps) {
      if (entry.chat?.kind === "new") current = entry.chat.tool;
      if (entry.chat) tools.set(entry.step.id, current);
    }
    return (id: string) => tools.get(id) ?? null;
  }, [view.steps]);

  const entry = selectedId ? byId.get(selectedId) : undefined;
  const top = view.steps;
  const at = entry ? top.findIndex((candidate) => candidate.step.id === entry.step.id) : -1;
  const siblings = entry && at < 0 ? (all.find((candidate) => candidate.children.some((child) => child.step.id === entry.step.id))?.children ?? []) : top;
  const place = entry ? siblings.findIndex((candidate) => candidate.step.id === entry.step.id) : -1;
  const next = place >= 0 ? (siblings[place + 1] ?? null) : null;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setCopied(false);
  }, []);

  const copy = async () => {
    if (entry && (await view.onCopy(entry.step.text))) {
      setCopied(true);
      announce("Copied");
    }
  };

  const chat = entry?.chat;
  const chips = entry
    ? [
        chat?.kind === "new" ? chat.headline : chat?.kind === "same" ? `same chat as step ${chat.step}` : null,
        chat?.kind === "new" ? chat.model : entry.step.model,
        chat?.kind === "new" ? chat.date : null,
      ].filter((chip): chip is string => Boolean(chip))
    : [];

  return (
    <div data-testid="reader-map" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 12, alignItems: "start", marginTop: 12 }}>
      <div style={{ minWidth: 0 }}>
        <BuildMap
          mode="reader"
          steps={steps}
          groups={view.map.groups}
          files={view.map.files}
          tools={view.map.tools}
          results={view.map.results}
          suggestions={[]}
          selectedId={selectedId}
          onSelect={select}
          onClear={() => setSelectedId(null)}
          onOpenPrompt={onRead}
          onConnect={() => undefined}
          opened={opened}
          onOpenContainer={(id) => {
            setOpenedId(id);
            const first = byId.get(id)?.children.find((child) => !child.step.id.endsWith(":instructions")) ?? byId.get(id)?.children[0];
            setSelectedId(first?.step.id ?? id);
          }}
          onBack={() => {
            const was = openedId;
            setOpenedId(null);
            setSelectedId(was);
          }}
          onLeave={(id) => {
            setOpenedId(null);
            setSelectedId(id);
          }}
        />
      </div>

      <aside
        data-testid="reading-panel"
        aria-label="Reading panel"
        style={{ minWidth: 0, borderRadius: 14, background: t.flat, border: `1px solid ${t.hairline}`, padding: 18, boxSizing: "border-box" }}
      >
        {entry ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span style={{ ...mono(11.5), textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Step {entry.step.number} of {top.length}
              </span>
              <IconButton icon={X} label="Close the reading panel" size={30} onClick={() => setSelectedId(null)} />
            </div>
            <h3 style={{ ...display(24), margin: 0, color: entry.isDefaultTitle ? t.text2 : t.text, overflowWrap: "anywhere" }}>{entry.title}</h3>
            {chips.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {chips.map((chip) => (
                  <Chip key={chip}>{chip}</Chip>
                ))}
              </div>
            ) : null}
            {entry.manual ? (
              <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, color: t.text }}>
                {entry.manual.headline}: {entry.manual.line}
              </p>
            ) : entry.step.text ? (
              <>
                <div
                  tabIndex={0}
                  aria-label="Full prompt"
                  style={{ maxHeight: 420, overflowY: "auto", borderRadius: 12, background: t.recess, padding: "12px 14px", fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.55, color: t.text, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                >
                  {entry.step.text}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={mono(12)}>{entry.step.words} words</span>
                  <Button variant="secondary" size={30} fontSize={12} icon={copied ? Check : Copy} onClick={() => void copy()}>
                    Copy
                  </Button>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, color: t.text2 }}>Open it to read each part.</p>
            )}
            {hasBeforeYouSend(entry) ? <BeforeYouSend entry={entry} toolOf={toolOf} onSelect={select} /> : null}
            {next ? (
              <section aria-label="Then">
                <h3 style={{ margin: "0 0 4px", fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>Then</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px solid ${t.hairline}` }}>
                  <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" color={t.text2} style={{ flexShrink: 0 }} />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600, color: t.text }}>
                      Step {next.step.number} · {next.title}
                    </div>
                    {next.chat ? <div style={mono(11.5)}>{next.chat.kind === "same" ? "same chat" : "new chat"}</div> : null}
                  </div>
                  <Button variant="ghost" size={30} fontSize={12} aria-label={`Next: step ${next.step.number}`} onClick={() => select(next.step.id)}>
                    Next
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        ) : (
          <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>Click a box to read its full prompt.</p>
        )}
      </aside>
    </div>
  );
}
