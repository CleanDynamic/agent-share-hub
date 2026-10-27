// CA-14 P6: the session list, a row for jumping between sessions.
//
// On a computer, a slim row of chips: "1 Claude", "2 Cursor", "3 Claude · 25 Sep", each the number and the session's app,
// with its day when two have the same app (SV-05). The chip of the session in view is the current one (`aria-current`, `--text`); the others are `--text2`. The row scrolls
// sideways when it must. On a phone, one menu: "Session 2 of 3 · Router". Pressing a chip scrolls to that session's head and
// focuses it. The composer shows it when the maker turns it on; the build page shows it to readers once a build has three
// sessions. Nothing here writes.

import { clipTo } from "@/lib/theme/truncate";
import { scrollToShow } from "@/pages/site/compose/pageScroll";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Fragment, useEffect, useState } from "react";

import { MenuButton } from "@/components/brand/MenuButton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { menuItem, menuSurface, text } from "@/pages/site/compose/refinedStyles";
import { MenuContent } from "@/pages/site/compose/ComposeMenu";

export interface SessionJumpItem {
  key: string;
  number: number;
  /** Its app, with its day when another session has the same app (`jumpItemsOf`). */
  label: string;
  /** CA-17 P6: its part, "Part B · Support agent", when the build has two or more. The list then groups its items by part. */
  group?: string;
}

/**
 * SV-05 P1: what each chip says after its number: the session's app, and its day when another session has the same app,
 * "Claude · 25 Sep". The items keep the order given, the List's.
 */
export function jumpItemsOf(rows: readonly { key: string; number: number; tool: string; date?: string; group?: string }[]): SessionJumpItem[] {
  const seen = new Map<string, number>();
  for (const row of rows) seen.set(row.tool, (seen.get(row.tool) ?? 0) + 1);
  return rows.map((row) => ({
    key: row.key,
    number: row.number,
    label: (seen.get(row.tool) ?? 0) > 1 && row.date ? `${row.tool} · ${row.date}` : row.tool,
    ...(row.group ? { group: row.group } : null),
  }));
}

/** The items in runs of one part, in order: [{ group, items }]. One run with no group when none has one. */
export function jumpGroups(items: readonly SessionJumpItem[]): { group: string | null; items: SessionJumpItem[] }[] {
  const out: { group: string | null; items: SessionJumpItem[] }[] = [];
  for (const item of items) {
    const group = item.group ?? null;
    const last = out[out.length - 1];
    if (last && last.group === group) last.items.push(item);
    else out.push({ group, items: [item] });
  }
  return out;
}

/** A head this close to the top of the screen, or above it, is the one in view. */
export const IN_VIEW_FROM = 160;

/** "Session 2 of 3 · Router". */
export const jumpLine = (items: readonly SessionJumpItem[], current: string | null): string => {
  const at = Math.max(0, items.findIndex((item) => item.key === current));
  const item = items[at];
  return item ? `Session ${item.number} of ${items.length} · ${item.label}` : "";
};

/**
 * The key of the session in view: the last whose head has reached the top of the screen, else the first. `find` gives a
 * session's head element. Read on scroll and resize, once a frame.
 */
export function useCurrentSession(keys: readonly string[], find: (key: string) => HTMLElement | null, active = true): string | null {
  const [current, setCurrent] = useState<string | null>(keys[0] ?? null);
  const signature = keys.join("\n");
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      let found = keys[0] ?? null;
      for (const key of keys) {
        const element = find(key);
        if (element && element.getBoundingClientRect().top <= IN_VIEW_FROM) found = key;
      }
      setCurrent(found);
    };
    const ask = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", ask, { passive: true });
    window.addEventListener("resize", ask);
    return () => {
      window.removeEventListener("scroll", ask);
      window.removeEventListener("resize", ask);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
    // `signature` stands for `keys`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, active]);
  return current;
}

/**
 * Scroll to a session's head and focus it, through the build page's one scroll helper (SV-06 P7), which stops on the maker's input.
 * CA-27 P3: in a large build the tiles above the session were guessed at and shift as the jump passes them: once it has arrived the
 * head is kept at the top of the page for a moment (`hold`). In a smaller build it is there already and nothing moves.
 */
export function jumpTo(head: HTMLElement | null): void {
  if (!head) return;
  scrollToShow(head, { align: "start", hold: true });
  head.focus({ preventScroll: true });
}

function Chip({ item, current, onJump }: { item: SessionJumpItem; current: boolean; onJump: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-current={current ? "true" : undefined}
      onClick={onJump}
      {...handlers}
      style={{
        flexShrink: 0,
        maxWidth: 200,
        height: 28,
        boxSizing: "border-box",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "0 8px",
        borderRadius: 6,
        border: "1px solid transparent",
        background: state.hovered ? t.controlOn : "transparent",
        cursor: "pointer",
        ...text(13, current ? 500 : 400, current ? t.text : t.text2),
        ...ring(state.focusVisible),
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{item.number}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
    </button>
  );
}

/** The phone's menu button says "Session 2 of 20 · Title": a long title is cut here, and all of it is in the tooltip. */
const SESSION_LINE_MAX = 44;

export function SessionJump({ items, current, phone, onJump }: { items: readonly SessionJumpItem[]; current: string | null; phone: boolean; onJump: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  if (items.length < 2) return null;
  if (phone) {
    return (
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger asChild>
          <MenuButton data-testid="session-list" aria-label="Sessions" title={jumpLine(items, current)} label="" value={clipTo(jumpLine(items, current), SESSION_LINE_MAX)} open={open} style={{ height: 44, maxWidth: "100%" }} />
        </Menu.Trigger>
        <Menu.Portal>
          <MenuContent align="start" sideOffset={4} style={menuSurface()}>
            {jumpGroups(items).map((run, at) => (
              <Fragment key={`${run.group ?? "none"}:${at}`}>
                {run.group ? <Menu.Label style={{ ...text(11.5, 500, t.label), padding: "8px 12px 4px" }}>{run.group}</Menu.Label> : null}
                {run.items.map((item) => (
                  <Menu.Item key={item.key} onSelect={() => onJump(item.key)} aria-current={item.key === current ? "true" : undefined} style={{ ...menuItem(true, true), ...text(13, item.key === current ? 500 : 400, item.key === current ? t.text : t.text2) }}>
                    {item.number} {item.label}
                  </Menu.Item>
                ))}
              </Fragment>
            ))}
          </MenuContent>
        </Menu.Portal>
      </Menu.Root>
    );
  }
  return (
    <nav aria-label="Sessions" data-testid="session-list" style={{ display: "flex", alignItems: "center", gap: 4, overflowX: "auto", minWidth: 0, paddingBottom: 2, userSelect: "none" }}>
      {jumpGroups(items).map((run, at) => (
        <Fragment key={`${run.group ?? "none"}:${at}`}>
          {run.group ? (
            <span data-testid="session-list-part" style={{ ...text(12, 500, t.label), flexShrink: 0, whiteSpace: "nowrap", padding: at > 0 ? "0 4px 0 12px" : "0 4px 0 0" }}>
              {run.group}
            </span>
          ) : null}
          {run.items.map((item) => (
            <Chip key={item.key} item={item} current={item.key === current} onJump={() => onJump(item.key)} />
          ))}
        </Fragment>
      ))}
    </nav>
  );
}
