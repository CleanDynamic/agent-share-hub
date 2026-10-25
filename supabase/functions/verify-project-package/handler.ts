import { z } from "zod/v4";
import type { SignedInUser } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";

const Body = z.object({
  session_id: z.string().min(1).max(255),
  project_id: z.guid(),
});

export interface PaidSession {
  payment_status: string;
  payment_intent: string | null;
  metadata: Record<string, string> | null;
}

export interface Deps {
  getUser(token: string | null): Promise<Pick<SignedInUser, "id"> | null>;
  getSession(sessionId: string): Promise<PaidSession | null>;
  recordPurchase(purchase: { projectId: string; userId: string; paymentIntent: string | null }): Promise<void>;
}

export function createHandler(deps: Deps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return preflight(req);
    const cors = corsHeaders(req);
    if (req.method !== "POST") return errorResponse("Method not allowed", 405, cors);

    try {
      const user = await deps.getUser(bearerToken(req));
      if (!user) return errorResponse("User not authenticated", 401, cors);

      const raw = await req.json().catch(() => null);
      const parsed = Body.safeParse(raw);
      if (!parsed.success) return errorResponse(fieldError(parsed.error), 400, cors);
      const { session_id, project_id } = parsed.data;

      const session = await deps.getSession(session_id);
      if (!session) return errorResponse("Session not found", 404, cors);
      if (session.payment_status !== "paid") return errorResponse("Payment not completed", 402, cors);

      // Verify metadata
      if (session.metadata?.project_id !== project_id || session.metadata?.user_id !== user.id) {
        return errorResponse("Session mismatch", 403, cors);
      }

      await deps.recordPurchase({ projectId: project_id, userId: user.id, paymentIntent: session.payment_intent });

      return jsonResponse({ success: true }, 200, cors);
    } catch (err) {
      console.error("Verify project package error:", err);
      return errorResponse("Could not verify the purchase", 500, cors);
    }
  };
}
