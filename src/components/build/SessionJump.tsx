// CA-14 P6: the session list, a row for jumping between sessions.
//
// On a computer, a slim row of chips: "1 Planning", "2 Router", "3 Agent", each the number and the session's title, else its
// app. The chip of the session in view is the current one (`aria-current`, `--text`); the others are `--text2`. The row scrolls
// sideways when it must. On a phone, one menu: "Session 2 of 3 · Router". Pressing a chip scrolls to that session's head and
// focuses it. The composer shows it when the maker turns it on; the build page shows it to readers once a build has three
// sessions. Nothing here writes.

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useEffect, useState } from "react";

import { MenuButton } from "@/components/brand/MenuButton";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { scrollBehavior } from "@/lib/theme/motion";
import { t } from "@/lib/theme/tokens";
import { menuItem, menuSurface, text } from "@/pages/site/compose/refinedStyles";
import { MenuContent } from "@/pages/site/compose/ComposeMenu";

export interface SessionJumpItem {
  key: string;
  number: number;
  /** The title the maker gave it, else its app. */
  label: string;
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

/** Scroll to a session's head and focus it. */
export function jumpTo(head: HTMLElement | null): void {
  if (!head) return;
  head.scrollIntoView?.({ block: "start", behavior: scrollBehavior() });
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

export function SessionJump({ items, current, phone, onJump }: { items: readonly SessionJumpItem[]; current: string | null; phone: boolean; onJump: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  if (items.length < 2) return null;
  if (phone) {
    return (
      <Menu.Root open={open} onOpenChange={setOpen}>
        <Menu.Trigger asChild>
          <MenuButton data-testid="session-list" aria-label="Sessions" label="" value={jumpLine(items, current)} open={open} style={{ height: 44, maxWidth: "100%" }} />
        </Menu.Trigger>
        <Menu.Portal>
          <MenuContent align="start" sideOffset={4} style={menuSurface()}>
            {items.map((item) => (
              <Menu.Item key={item.key} onSelect={() => onJump(item.key)} aria-current={item.key === current ? "true" : undefined} style={{ ...menuItem(true, true), ...text(13, item.key === current ? 500 : 400, item.key === current ? t.text : t.text2) }}>
                {item.number} {item.label}
              </Menu.Item>
            ))}
          </MenuContent>
        </Menu.Portal>
      </Menu.Root>
    );
  }
  return (
    <nav aria-label="Sessions" data-testid="session-list" style={{ display: "flex", gap: 4, overflowX: "auto", minWidth: 0, paddingBottom: 2 }}>
      {items.map((item) => (
        <Chip key={item.key} item={item} current={item.key === current} onJump={() => onJump(item.key)} />
      ))}
    </nav>
  );
}
