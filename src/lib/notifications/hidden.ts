// Notifications the site no longer shows: the ones about XP or a level.
//
// Their rows stay stored (nothing is deleted); Activity leaves them out. A row is one of them when its kind, or the `sub` its
// metadata carries, names xp or a level ("xp", "xp_awarded", "level_up", "level_earned", "depth_unlocked").

const HIDDEN = /(^|[_\s-])(xp|level|levels|levelup|depth_unlocked)([_\s-]|$)/i;

/** Whether a stored notification is about XP or a level, and so is not shown. */
export function isHiddenNotification(row: { kind?: string | null; notification_type?: string | null; metadata?: unknown }): boolean {
  const kind = row.kind ?? row.notification_type ?? "";
  const meta = row.metadata;
  const sub = meta && typeof meta === "object" && typeof (meta as { sub?: unknown }).sub === "string" ? (meta as { sub: string }).sub : "";
  return HIDDEN.test(kind) || HIDDEN.test(sub);
}
