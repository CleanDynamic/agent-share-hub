/* CA-06 P3 — the post's links on the build page, for a reader.

   Clicking a link (or Go to it on its card) goes to the part as its address does: `#node-{id}` for a tile, the
   existing address that scrolls to the card and rings it, `#session-{key}` for a session, which is its first
   step's card, where its head is, and `#workstream-{key}` (CA-17) for a whole part, whose head is rung. Both are centred in the window. The part's window opens, and offers Back to the
   post, which brings the words to the middle, focused and outlined. */

import { useCallback, useMemo, useRef } from "react";

import { centre, focusGroup } from "@/components/build/partNav";
import { flashOutline } from "@/components/post/RefLinks";
import { buildSteps, groupKey, sessionGroups } from "@/lib/build/graph";
import { sessionOrderOf, sessionsMetaOf, WORKSTREAM_PREFIX, type Making } from "@/lib/build/making";
import { refGroups, refLookup, withGroupEntries } from "@/lib/build/postRefs";
import { makingWithGroupColours, referenceGroupsOf, withGroupColours } from "@/lib/build/referenceGroups";
import { parseRefTo, refTo } from "@/lib/build/thread";
import { focusRing } from "@/lib/theme/focus";
import { t } from "@/lib/theme/tokens";
import type { NodeTree } from "@/lib/build/types";

export type ReaderFocus = { id: string; n: number; open?: string; fromPost?: boolean };

export function useReaderPostLinks({
  tree,
  making,
  enabled,
  onFocus,
}: {
  tree: readonly NodeTree[];
  making: Making | null;
  /** The steps are drawn: there is somewhere to go. */
  enabled: boolean;
  /** Go to a step: the page scrolls to its card, rings it and, with `open`, opens its window. */
  onFocus: (focus: (current: ReaderFocus | null) => ReaderFocus) => void;
}) {
  const links = useMemo(() => {
    if (!enabled || !making) return null;
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, making.sessions, making.session_tools ?? {}, sessionsMetaOf(making), sessionOrderOf(making));
    const firstStep = (key: string) => {
      const group = groups.find((candidate) => groupKey(candidate) === key);
      return group ? (steps.find((step) => group.stepNumbers.includes(step.number))?.id ?? null) : null;
    };
    // CA-19: members are drawn in their group's colour, and a link can point at a whole group.
    const drawn = withGroupColours(steps, groups, making);
    const lookup = withGroupEntries(refLookup(refGroups({ steps: drawn.steps, groups: drawn.groups, making: makingWithGroupColours(making) })), referenceGroupsOf(making));
    return { groups, firstStep, lookup };
  }, [enabled, making, tree]);

  const words = useRef<{ to: string; words: HTMLElement } | null>(null);

  const onGo = useCallback(
    (to: string, el: HTMLElement) => {
      const target = parseRefTo(to);
      if (!target || !links) return;
      // CA-19 P3, Go to the group: its members are outlined and the rest of the steps dimmed, until Escape.
      if (target.kind === "group") {
        const members = links.lookup.get(to)?.group?.members.map((member) => member.to) ?? [];
        const registry = new Map<string, HTMLElement>();
        document.querySelectorAll<HTMLElement>('[id^="step-"]').forEach((node) => {
          const key = node.id.slice("step-".length);
          registry.set(refTo({ kind: key.startsWith(WORKSTREAM_PREFIX) ? "workstream" : "node", id: key }), node);
        });
        for (const member of members) {
          const at = parseRefTo(member);
          const first = at?.kind === "session" ? links.firstStep(at.id) : null;
          const node = first ? document.getElementById(`step-${first}`) : null;
          if (node) registry.set(member, node);
        }
        focusGroup(registry, members, t.dimFilter, { width: focusRing.outlineWidth, style: focusRing.outlineStyle, colour: focusRing.outlineColor, offset: focusRing.outlineOffset });
        return;
      }
      const id = target.kind === "session" ? links.firstStep(target.id) : target.id;
      if (!id) return;
      words.current = { to, words: el };
      // The address says where the reader went, without the router scrolling to it.
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, "", `${pathname}${search}#${target.kind}-${target.id}`);
      // A whole part has no window: its head comes to the middle and is ringed, as `#workstream-{key}` does.
      onFocus((current) => ({ id, n: (current?.n ?? 0) + 1, ...(target.kind === "workstream" ? null : { open: to, fromPost: true }) }));
    },
    [links, onFocus],
  );

  const onBackToPost = useCallback(() => {
    const from = words.current;
    if (!from) return;
    window.setTimeout(() => {
      const el = from.words.isConnected ? from.words : document.querySelector<HTMLElement>(`[data-testid="build-posts"] [data-ref="${CSS.escape(from.to)}"]`);
      if (!el) return;
      centre(el);
      el.focus({ preventScroll: true });
      flashOutline(el);
    }, 0);
  }, []);

  return links ? { ...links, onGo, onBackToPost } : null;
}
