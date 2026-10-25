// Tell everyone who saved or downloaded an item that its creator published a
// new version.
//
// The caller must be signed in and must own the item. Who the creator is comes
// from the token and from content_items.creator_id, never from the body: a
// `creator_id` in the body is ignored, so nobody can send notifications as
// someone else, or about an item that is not theirs.

import { z, readBody } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";

const Body = z.object({
  content_id: z.string({ required_error: "Required" }).uuid(),
  version_number: z.string({ required_error: "Required" }).trim().min(1, "Required").max(50),
  changelog: z.string().max(5000).nullish(),
  content_title: z.string().max(300).nullish(),
});

export interface Notification {
  recipient_id: string;
  actor_id: string;
  notification_type: "version_update";
  content_id: string;
  metadata: { version_number: string; changelog: string; content_title: string };
}

export interface NotifyDeps {
  getUserId(req: Request): Promise<string | null>;
  /** content_items.creator_id, or null when there is no such item. */
  findCreator(contentId: string): Promise<string | null>;
  /** The ids of everyone who downloaded or saved the item. */
  findAudience(contentId: string): Promise<string[]>;
  insertNotifications(batch: Notification[]): Promise<void>;
}

export function createNotifyHandler(deps: NotifyDeps) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    if (req.method !== "POST") return fail(req, 405, "Method not allowed");

    try {
      const userId = await deps.getUserId(req);
      if (!userId) return fail(req, 401, "Sign in first");

      const body = await readBody(req, Body);
      if (!body.ok) return fail(req, 400, body.error);
      const { content_id, version_number, changelog, content_title } = body.data;

      const creatorId = await deps.findCreator(content_id);
      if (!creatorId) return fail(req, 404, "Content not found");
      if (creatorId !== userId) return fail(req, 403, "Only the creator can notify about a new version");

      const audience = [...new Set(await deps.findAudience(content_id))].filter((id) => id && id !== creatorId);
      if (audience.length === 0) return json(req, { notified: 0 });

      const rows: Notification[] = audience.map((recipient) => ({
        recipient_id: recipient,
        actor_id: creatorId,
        notification_type: "version_update",
        content_id,
        metadata: { version_number, changelog: (changelog ?? "").slice(0, 200), content_title: content_title ?? "" },
      }));

      // In batches of 100.
      for (let i = 0; i < rows.length; i += 100) {
        await deps.insertNotifications(rows.slice(i, i + 100));
      }
      return json(req, { notified: audience.length });
    } catch (err) {
      console.error("notify-version-update:", err);
      return fail(req, 500, "Could not send the notifications");
    }
  };
}
