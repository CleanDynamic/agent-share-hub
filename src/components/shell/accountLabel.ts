// G7, D2: the account button's accessible name starts with what it shows, so a voice-control user can say it.
// Initials drawn: "<initials>, <display name>, account menu". A photo: "<display name>, account menu". The desktop and
// phone headers both use it.

import { initialsOf } from "@/components/brand/Avatar";

import type { FrameViewer } from "./frameTypes";

export function accountLabel(viewer: Pick<FrameViewer, "name" | "avatarUrl">): string {
  const name = viewer.name.trim();
  if (!name) return "Account menu";
  if (viewer.avatarUrl) return `${name}, account menu`;
  const initials = initialsOf(name);
  return initials ? `${initials}, ${name}, account menu` : `${name}, account menu`;
}
