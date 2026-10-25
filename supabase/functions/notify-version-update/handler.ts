import { z } from "zod/v4";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

// creator_id may still arrive from an old client; it is not read. The creator is
// the caller, from the token, and must own the item.
const Body = z.object({
  content_id: z.guid(),
  version_number: z.string().min(1).max(50),
  changelog: z.string().max(5000).optional(),
  content_title: z.string().max(300).optional(),
});

export interface Deps {
  getUser(token: string | null): Promise<{ id: string } | null>;
  /** content_items.creator_id, or null when there is no such item. */
  getContentCreator(contentId: string): Promise<string | null>;
  /** Everyone who downloaded or saved the item. */
  getRecipients(contentId: string): Promise<string[]>;
  insertNotifications(rows: Record<string, unknown>[]): Promise<void>;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req);
    const cors = corsHeaders(req);
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

    try {
      const user = await deps.getUser(bearerToken(req));
      if (!user) return errorResponse("Sign in to notify followers", 401, cors);

      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return errorResponse(fieldError(parsed.error), 400, cors);
      const { content_id, version_number, changelog, content_title } = parsed.data;

      const owner = await deps.getContentCreator(content_id);
      if (!owner) return errorResponse("Content not found", 404, cors);
      if (owner !== user.id) return errorResponse("Only the creator can notify followers", 403, cors);

      const userIds = [...new Set(await deps.getRecipients(content_id))].filter((id) => id && id !== user.id);

      if (userIds.length === 0) return jsonResponse({ notified: 0 }, 200, cors);

      const notifications = userIds.map((uid) => ({
        recipient_id: uid,
        actor_id: user.id,
        notification_type: "version_update",
        content_id,
        metadata: { version_number, changelog: (changelog || "").slice(0, 200), content_title: content_title || "" },
      }));

      // Insert in batches of 100
      for (let i = 0; i < notifications.length; i += 100) {
        await deps.insertNotifications(notifications.slice(i, i + 100));
      }

      return jsonResponse({ notified: userIds.length }, 200, cors);
    } catch (err) {
      console.error("notify-version-update error:", err);
      return errorResponse("Could not notify followers", 500, cors);
    }
  };
}
