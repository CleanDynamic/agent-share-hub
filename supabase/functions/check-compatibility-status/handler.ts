import { corsHeaders, preflight } from "../_shared/cors.ts";
import { errorResponse, jsonResponse, safeEqual } from "../_shared/http.ts";

export interface ApprovedItem {
  id: string;
  creator_id: string;
  title: string | null;
  last_verified_at: string | null;
  approved_at: string | null;
  compatibility_status: string | null;
}

export interface Deps {
  /** The value of the CRON_SECRET secret; undefined when it is not set. */
  cronSecret: string | undefined;
  listApproved(): Promise<ApprovedItem[]>;
  /** True when the row was changed. */
  updateStatus(id: string, status: string): Promise<boolean>;
  insertNotifications(rows: Record<string, unknown>[]): Promise<void>;
}

// A scheduled job, not a page: the caller proves itself with the x-cron-secret
// header. With no CRON_SECRET set, nobody can run it.
export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req);
    const cors = corsHeaders(req);

    const sent = req.headers.get("x-cron-secret") ?? "";
    if (!deps.cronSecret || !sent || !safeEqual(sent, deps.cronSecret)) {
      return errorResponse("Unauthorized", 401, cors);
    }

    try {
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString();

      // Fetch all approved items
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
          if (!(await deps.updateStatus(item.id, newStatus))) continue;
          updatedCount++;

          // Notify creator when newly outdated
          if (newStatus === "outdated" && item.compatibility_status !== "outdated") {
            const daysSince = item.last_verified_at
              ? Math.floor((now.getTime() - new Date(item.last_verified_at).getTime()) / 86400000)
              : item.approved_at
                ? Math.floor((now.getTime() - new Date(item.approved_at).getTime()) / 86400000)
                : 90;

            notifications.push({
              recipient_id: item.creator_id,
              notification_type: "compatibility_warning",
              content_id: item.id,
              metadata: { content_title: item.title, days_since_verified: daysSince },
            });
          }
        }
      }

      // Batch insert notifications
      if (notifications.length > 0) await deps.insertNotifications(notifications);

      return jsonResponse({ updated: updatedCount, notified: notifications.length }, 200, cors);
    } catch (err) {
      console.error("check-compatibility-status error:", err);
      return errorResponse("Could not check compatibility", 500, cors);
    }
  };
}
