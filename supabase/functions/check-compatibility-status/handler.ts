// Marks each approved item verified, unverified or outdated from its last
// verification date, and tells the creator when an item has just gone outdated.
//
// It rewrites every approved item, so it is not for callers. It runs on a
// schedule and the schedule sends the secret in `x-cron-secret`; anything else
// is a 401. With no CRON_SECRET set the answer is 401 for everybody.

import { fail, json, preflight } from "../_shared/cors.ts";

export interface Item {
  id: string;
  creator_id: string;
  title: string;
  last_verified_at: string | null;
  approved_at: string | null;
  compatibility_status: string | null;
}

export interface CompatDeps {
  /** The value of the CRON_SECRET secret, if one is set. */
  secret: string | undefined;
  listApproved(): Promise<Item[]>;
  setStatus(id: string, status: string): Promise<void>;
  insertNotifications(rows: Record<string, unknown>[]): Promise<void>;
  now(): Date;
}

/** Same time whether the first character is wrong or the last. */
export function sameSecret(given: string | null, secret: string | undefined): boolean {
  if (!secret || !given) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(secret);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function createCompatHandler(deps: CompatDeps) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    if (!sameSecret(req.headers.get("x-cron-secret"), deps.secret)) return fail(req, 401, "Not allowed");

    try {
      const now = deps.now();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();
      const items = await deps.listApproved();

      let updatedCount = 0;
      const notifications: Record<string, unknown>[] = [];

      for (const item of items) {
        let newStatus: string;

        if (item.last_verified_at && item.last_verified_at >= ninetyDaysAgo) {
          newStatus = "verified";
        } else if (item.last_verified_at && item.last_verified_at < ninetyDaysAgo) {
          newStatus = "outdated";
        } else if (!item.last_verified_at && item.approved_at && item.approved_at < ninetyDaysAgo) {
          newStatus = "outdated";
        } else {
          newStatus = "unverified";
        }

        if (newStatus !== item.compatibility_status) {
          await deps.setStatus(item.id, newStatus);
          updatedCount++;

          // Notify creator when newly outdated
          if (newStatus === "outdated" && item.compatibility_status !== "outdated") {
            const since = item.last_verified_at ?? item.approved_at;
            const daysSince = since ? Math.floor((now.getTime() - new Date(since).getTime()) / 86400000) : 90;

            notifications.push({
              recipient_id: item.creator_id,
              notification_type: "compatibility_warning",
              content_id: item.id,
              metadata: { content_title: item.title, days_since_verified: daysSince },
            });
          }
        }
      }

      if (notifications.length > 0) await deps.insertNotifications(notifications);
      return json(req, { updated: updatedCount, notified: notifications.length });
    } catch (err) {
      console.error("check-compatibility-status:", err);
      return fail(req, 500, "Could not update the statuses");
    }
  };
}
