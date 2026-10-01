/* UI-P17 — the viewer, as the frame's chrome needs them. Built from `useAuth()`
   by the container, and from the sample data by the dev compare page. */

export interface FrameViewer {
  /** Stable id: chooses the avatar hue. */
  id: string;
  /** Display name, or the handle when there is none. */
  name: string;
  /** The handle without the "@"; the profile route is /profile/:handle. */
  handle: string;
  avatarUrl?: string | null;
  /** Force an avatar hue (0–5). The dev fixtures pass it. */
  hue?: number;
}
