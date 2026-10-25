import { z } from "zod/v4";
import { penceOf, returnUrlError, type CustomerStripe, type SignedInUser } from "../_shared/checkout.ts";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { bearerToken, errorResponse, fieldError, jsonResponse } from "../_shared/http.ts";
import { ALLOWED_ORIGINS, isAllowedOrigin } from "../_shared/origins.ts";

const Body = z.object({
  project_id: z.guid(),
  success_url: z.url().optional(),
  cancel_url: z.url().optional(),
});

export interface PackageProject {
  id: string;
  title: string | null;
  package_price_gbp: number | null;
  package_price_enabled: boolean | null;
}

export interface Deps {
  stripe: CustomerStripe | null;
  getUser(token: string | null): Promise<SignedInUser | null>;
  getProject(projectId: string): Promise<PackageProject | null>;
  ownsPackage(projectId: string, userId: string): Promise<boolean>;
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
      const { project_id } = parsed.data;

      // Without an address of their own the buyer returns to the page that asked,
      // when that is this site, and otherwise to the site itself.
      const origin = req.headers.get("origin");
      const base = isAllowedOrigin(origin) ? (origin as string) : ALLOWED_ORIGINS[0];
      const success_url = parsed.data.success_url ?? `${base}/project/${project_id}?package=success`;
      const cancel_url = parsed.data.cancel_url ?? `${base}/project/${project_id}`;
      const urlError = returnUrlError({ success_url, cancel_url });
      if (urlError) return errorResponse(urlError, 400, cors);

      // Fetch project details
      const project = await deps.getProject(project_id);
      if (!project) return errorResponse("Project not found", 404, cors);
      if (!project.package_price_enabled || !project.package_price_gbp) {
        return errorResponse("Package pricing not enabled for this project", 400, cors);
      }

      // Check if already purchased
      if (await deps.ownsPackage(project_id, user.id)) {
        return errorResponse("You already own this project package", 409, cors);
      }

      if (!deps.stripe) return errorResponse("Stripe is not configured", 500, cors);

      // Find or create customer
      const customerId = await deps.stripe.findCustomerId(user.email);

      const session = await deps.stripe.createSession({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "gbp",
              unit_amount: penceOf(project.package_price_gbp),
              product_data: { name: `Full project unlock - ${project.title} on NeoScale AI` },
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url,
        cancel_url,
        metadata: { project_id, user_id: user.id, type: "project_package" },
      });

      // The purchase row is written by verify-project-package, once the session is paid.
      return jsonResponse({ url: session.url, session_id: session.id }, 200, cors);
    } catch (err) {
      console.error("Project package session error:", err);
      return errorResponse("Could not start checkout", 500, cors);
    }
  };
}
