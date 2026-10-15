/* UI-P91 — the build page's Map in the refined look, as `design/reference/refined/{dusk,noon}/build-map.html` draws it.

   A FORK, NOT AN EDIT. `ReaderMap` stays the current look; this takes its props (`ReaderMapProps`, imported, not
   copied), keeps its state, handlers, words and accessible names, and draws the same parts in the same order: the
   Map, then the reading panel. `RefinedStepsList` loads it on demand when a reader chooses Map, as `StepsList` loads
   `ReaderMap`.

   THE MAP is `BuildMap` in reader mode, which branches on `useLook()` for its own look (the well, lanes, boxes,
   wires and the footer line); its layout is `layoutMap`'s, unchanged. Its column is 550 wide, as the board draws it.

   THE OPEN STEP is a module 380 wide, padding 20, gap 16: the eyebrow and a 26 close button; the title 18/500; the
   tags (the chat's tool and the model with their real marks, then the date); the text in a well at 13/21, seven lines;
   the words and Copy (secondary 26, no icon); then Before you send it and Then as hairline row lists, each row led by
   a glyph and closed by a text link. */

import { useCallback, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/brand/Button";
import { Eyebrow } from "@/components/brand/Eyebrow";
import { Glyph } from "@/components/brand/Glyph";
import { IconButton } from "@/components/brand/IconButton";
import { ModelTag } from "@/components/brand/ModelTag";
import type { ReaderStep } from "@/lib/build/readerSteps";
import { BETWEEN, useMinWidth } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { WELL } from "@/lib/theme/refinedControl";
import { mainStyle, trackRow } from "@/lib/theme/refinedLayout";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { BuildMap } from "../compose/BuildMap";
import { hasBeforeYouSend } from "./BeforeYouSend";
import type { ReaderMapProps } from "./ReaderMap";
import { RefinedBeforeYouSend } from "./RefinedBeforeYouSend";

const flatten = (list: readonly ReaderStep[]): ReaderStep[] => list.flatMap((entry) => [entry, ...flatten(entry.children)]);

const text = (px: number, weight: 400 | 500, color: string, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: FIGTREE,
  fontSize: px,
  fontWeight: weight,
  lineHeight: "normal",
  color,
  ...extra,
});

/** A plain tag: the date, or "same chat as step 4". 20 high, radius 4, the tag's fill. */
function Tag({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 6px",
        boxSizing: "border-box",
        borderRadius: 4,
        background: t.tagFill,
        ...text(11.5, 400, t.onTag),
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/** A text link at a row's right: 12.5/500 `--text`, underlined on hover. */
function RowLink({ children, label, onClick }: { children: string; label: string; onClick: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      {...handlers}
      style={{
        ...text(12.5, 500, t.text),
        background: "none",
        border: 0,
        padding: 0,
        cursor: "pointer",
        flexShrink: 0,
        textDecoration: state.hovered ? "underline" : "none",
        textUnderlineOffset: 3,
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

/** A hairline row list under a 13/500 heading. */
function RowList({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} style={{ display: "flex", flexDirection: "column" }}>
      <h3 style={{ ...text(13, 500, t.text), margin: 0, paddingBottom: 8, borderBottom: `1px solid ${t.hairlineModule}` }}>{label}</h3>
      {children}
    </section>
  );
}

export default function RefinedReaderMap({ view, announce, onRead, start }: ReaderMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(start?.selected ?? null);
  const [openedId, setOpenedId] = useState<string | null>(start?.opened ?? null);

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

  const stacked = !useMinWidth(BETWEEN.stack);
  const select = useCallback((id: string) => setSelectedId(id), []);

  const copy = async () => {
    if (entry && (await view.onCopy(entry.step.text))) announce("Copied");
  };

  /* The same tags, in the same order, as the current look's chips: the chat, the model, the date. The chat's and the
     model's carry their real marks. */
  const chat = entry?.chat;
  const model = chat?.kind === "new" ? chat.model : (entry?.step.model ?? null);
  const tags: ReactNode[] = [];
  if (chat?.kind === "new") tags.push(<ModelTag key="chat" tool={chat.tool}>{chat.headline}</ModelTag>);
  if (chat?.kind === "same") tags.push(<Tag key="chat">{`same chat as step ${chat.step}`}</Tag>);
  if (model) tags.push(<ModelTag key="model" model={model}>{model}</ModelTag>);
  if (chat?.kind === "new" && chat.date) tags.push(<Tag key="date">{chat.date}</Tag>);

  return (
    <div data-testid="reader-map" style={trackRow(stacked, 16)}>
      <div style={mainStyle(stacked, { flex: "0 1 550px", minWidth: 0 })}>
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
        style={{
          width: stacked ? "100%" : 380,
          flexShrink: 0,
          boxSizing: "border-box",
          padding: 20,
          background: t.module,
          border: `1px solid ${t.moduleBorder}`,
          borderRadius: 8,
          boxShadow: t.moduleShadow,
        }}
      >
        {entry ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Eyebrow as="span" style={{ flexGrow: 1 }}>
                Step {entry.step.number} of {top.length}
              </Eyebrow>
              <IconButton icon={X} glyph="x" label="Close the reading panel" size={26} onClick={() => setSelectedId(null)} />
            </div>
            <h3 style={{ ...text(18, 500, entry.isDefaultTitle ? t.text2 : t.text), margin: 0, letterSpacing: "-0.015em", overflowWrap: "anywhere" }}>{entry.title}</h3>
            {tags.length > 0 ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{tags}</div> : null}
            {entry.manual ? (
              <p style={{ ...text(13, 400, t.text), margin: 0, lineHeight: "21px" }}>
                {entry.manual.headline}: {entry.manual.line}
              </p>
            ) : entry.step.text ? (
              <>
                <div tabIndex={0} aria-label="Full prompt" style={{ ...WELL, borderRadius: 6, padding: "12px 16px", boxSizing: "border-box" }}>
                  <p
                    style={{
                      ...text(13, 400, t.text),
                      margin: 0,
                      lineHeight: "21px",
                      whiteSpace: "pre-wrap",
                      overflowWrap: "anywhere",
                      display: "-webkit-box",
                      WebkitLineClamp: 7,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {entry.step.text}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ ...text(11.5, 400, t.label), flexGrow: 1, fontVariantNumeric: "tabular-nums" }}>{entry.step.words} words</span>
                  <Button variant="secondary" size={28} fontSize={12} style={{ height: 26 }} onClick={() => void copy()}>
                    Copy
                  </Button>
                </div>
              </>
            ) : (
              <p style={{ ...text(13, 400, t.text2), margin: 0 }}>Open it to read each part.</p>
            )}
            {hasBeforeYouSend(entry) ? <RefinedBeforeYouSend entry={entry} toolOf={toolOf} onSelect={select} /> : null}
            {next ? (
              <RowList label="Then">
                <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 48 }}>
                  <span aria-hidden="true" style={{ display: "inline-flex", color: t.label, flexShrink: 0 }}>
                    <Glyph name="rarr" size={16} />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flexGrow: 1, minWidth: 0 }}>
                    <span style={{ ...text(12.5, 500, t.text), overflowWrap: "anywhere" }}>
                      Step {next.step.number} · {next.title}
                    </span>
                    {next.chat ? <span style={text(11.5, 400, t.label)}>{next.chat.kind === "same" ? "same chat" : "new chat"}</span> : null}
                  </div>
                  <RowLink label={`Next: step ${next.step.number}`} onClick={() => select(next.step.id)}>
                    Next
                  </RowLink>
                </div>
              </RowList>
            ) : null}
          </div>
        ) : (
          <p style={{ ...text(13, 400, t.text2), margin: 0 }}>Click a box to read its full prompt.</p>
        )}
      </aside>
    </div>
  );
}
