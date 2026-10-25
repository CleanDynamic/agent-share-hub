import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCaller } from "../_shared/caller.ts";
import { z, readBody } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";

const Body = z.object({
  session_id: z.string({ required_error: "Required" }).min(1).max(255),
  project_id: z.string({ required_error: "Required" }).uuid(),
});

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Method not allowed");

  try {
    const user = await getCaller(req);
    if (!user) return fail(req, 401, "Sign in first");

    const body = await readBody(req, Body);
    if (!body.ok) return fail(req, 400, body.error);
    const { session_id, project_id } = body.data;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") return fail(req, 402, "Payment not completed");

    // Verify metadata
    if (session.metadata?.project_id !== project_id || session.metadata?.user_id !== user.id) {
      return fail(req, 403, "Session mismatch");
    }

    // Insert purchase using service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: project } = await adminClient
      .from("projects")
      .select("package_price_gbp")
      .eq("id", project_id)
      .single();

    const { error: purchaseError } = await adminClient.from("project_package_purchases").upsert(
      {
        project_id,
        user_id: user.id,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_gbp: project?.package_price_gbp ?? 0,
      },
      { onConflict: "project_id,user_id" },
    );
    if (purchaseError) throw purchaseError;

    return json(req, { success: true });
  } catch (err) {
    console.error("verify-project-package:", err);
    return fail(req, 500, "Could not verify the payment");
  }
});
