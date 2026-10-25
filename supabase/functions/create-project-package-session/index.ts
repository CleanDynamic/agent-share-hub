import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCaller } from "../_shared/caller.ts";
import { z, readBody, returnUrl } from "../_shared/body.ts";
import { fail, json, preflight } from "../_shared/cors.ts";
import { isAllowedOrigin } from "../_shared/origins.ts";

// The browser sends both addresses; when it does not, they are built from the
// caller's origin, and only if that origin is on the list.
const Body = z.object({
  project_id: z.string({ required_error: "Required" }).uuid(),
  success_url: returnUrl.optional(),
  cancel_url: returnUrl.optional(),
});

Deno.serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== "POST") return fail(req, 405, "Method not allowed");

  try {
    const user = await getCaller(req);
    if (!user?.email) return fail(req, 401, "Sign in to buy this");

    const body = await readBody(req, Body);
    if (!body.ok) return fail(req, 400, body.error);
    const { project_id } = body.data;

    const origin = req.headers.get("origin");
    let { success_url, cancel_url } = body.data;
    if (!success_url || !cancel_url) {
      if (!isAllowedOrigin(origin)) return fail(req, 400, "success_url: must start with an allowed origin");
      success_url = success_url ?? `${origin}/project/${project_id}?package=success`;
      cancel_url = cancel_url ?? `${origin}/project/${project_id}`;
    }

    const supabaseClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

    const { data: project, error: projErr } = await supabaseClient
      .from("projects")
      .select("id, title, package_price_gbp, package_price_enabled")
      .eq("id", project_id)
      .single();
    if (projErr || !project) return fail(req, 404, "Project not found");
    if (!project.package_price_enabled || !project.package_price_gbp) {
      return fail(req, 400, "Package pricing is not enabled for this project");
    }

    const { data: existing } = await supabaseClient
      .from("project_package_purchases")
      .select("id")
      .eq("project_id", project_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existing) return fail(req, 409, "You already own this project package");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe is not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId: string | undefined = customers.data.length > 0 ? customers.data[0].id : undefined;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            unit_amount: Math.round(project.package_price_gbp * 100),
            product_data: { name: `Full project unlock: ${project.title} on NeoScale AI` },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url,
      cancel_url,
      metadata: { project_id, user_id: user.id, type: "project_package" },
    });

    // The purchase row is written by verify-project-package once Stripe says the
    // session is paid, not here.
    return json(req, { url: session.url, session_id: session.id });
  } catch (err) {
    console.error("create-project-package-session:", err);
    return fail(req, 500, "Could not start checkout");
  }
});
