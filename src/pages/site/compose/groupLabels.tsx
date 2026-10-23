/* CA-19 P5 — a reference group's name on its members (board "References: the colour picker", right column).

   When a group has a name, every member shows it: a dot and the name, 20 tall, on `--hairline`, both in the group's colour
   kept readable (nameColourFor). In the List it sits in each member's head just before its menu (tiles, sessions, parts);
   in Details under the header line as "In Login flow"; in the map panel under its head line; on the build page as in the
   List, for readers. The map's boxes carry no label (they keep their outline); their tooltip says "Session 2 · in Login
   flow". An unnamed group shows its colour only, and a single colour never shows a label.

   The pages give the groups through `GroupLabelsProvider`; nothing is passed down through the List's own props. */

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { groupByMember } from "@/lib/build/referenceGroups";

import { GroupLabel } from "./referencePieces";

export interface GroupLabelInfo {
  id: string;
  name?: string;
  colour: string;
}

interface GroupLabelsValue {
  byRef: ReadonlyMap<string, GroupLabelInfo>;
  /** The maker's: a label opens its group's window. Absent for readers. */
  onOpen?: (groupId: string) => void;
}

const GroupLabelsContext = createContext<GroupLabelsValue | null>(null);

export const GROUP_LABEL_COPY = {
  in: "In",
  tooltip: (name: string, group: string) => `${name} · in ${group}`,
} as const;

export function GroupLabelsProvider({ making, onOpen, children }: { making: unknown; onOpen?: (groupId: string) => void; children: ReactNode }) {
  const value = useMemo<GroupLabelsValue>(() => {
    const byRef = new Map<string, GroupLabelInfo>();
    for (const [ref, group] of groupByMember(making)) byRef.set(ref, { id: group.id, colour: group.colour, ...(group.name ? { name: group.name } : null) });
    return { byRef, onOpen };
  }, [making, onOpen]);
  return <GroupLabelsContext.Provider value={value}>{children}</GroupLabelsContext.Provider>;
}

/** The group a component is in, when the page gives groups. */
export function useGroupOf(ref: string | null | undefined): GroupLabelInfo | undefined {
  const value = useContext(GroupLabelsContext);
  return ref ? value?.byRef.get(ref) : undefined;
}

/** The group of any component, looked up inside a loop (the map's boxes). */
export function useGroupLookup(): (ref: string) => GroupLabelInfo | undefined {
  const value = useContext(GroupLabelsContext);
  return (ref) => value?.byRef.get(ref);
}

/** The label on a member: nothing for an unnamed group, a single colour, or no group. `inside` says "In Login flow" (Details). */
export function MemberLabel({ to, inside = false, testId }: { to: string | null | undefined; inside?: boolean; testId?: string }) {
  const value = useContext(GroupLabelsContext);
  const group = to ? value?.byRef.get(to) : undefined;
  if (!group?.name) return null;
  const open = value?.onOpen;
  return <GroupLabel name={group.name} colour={group.colour} prefix={inside ? GROUP_LABEL_COPY.in : undefined} testId={testId} onClick={open ? () => open(group.id) : undefined} />;
}
