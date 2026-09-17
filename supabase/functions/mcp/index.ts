// =============================================================================
// buildgallery — mcp (EX-P02 the door skeleton, EX-P04 the lock)
// =============================================================================
// The MCP door, locked. Every request that is not OAuth discovery must carry a
// valid user JWT, and every database call this function will ever make goes
// through the caller's own client, under the caller's own RLS.
//
// THE PRINCIPLE. The connector is a pipe, not an editor. It carries a whole
// conversation verbatim so a human can choose from it later, on the upload
// page, in their own browser. No tool here summarises, selects, reorders or
// publishes, and no eighth tool will be added to do so.
//
// THE PIPELINE, in order:
//
//   withOAuthProtectedResource()  runs first, ahead of the gate. It answers
//     GET  .../mcp/.well-known/oauth-protected-resource  with RFC 9728
//     metadata, answers the OPTIONS preflight, and adds
//     `WWW-Authenticate: Bearer resource_metadata="..."` to every 401 the
//     stack produces. On edge functions it derives the resource server and
//     authorization server itself, from the gateway headers and the function
//     slug, so neither is configured here — hand-writing either would pin a
//     URL that the platform already knows and that a custom domain will move.
//
//   withSupabase<Database>({ auth: 'user' })  is the gate. No token, or a
//     token that does not verify, is a 401 and the handler below never runs.
//     A token that verifies gives the handler ctx.supabase, scoped to that
//     user.
//
// NO SERVICE-ROLE KEY. Not a literal, not an env read, not indirectly. Note
// that the middleware also offers `ctx.supabaseAdmin`, a client that bypasses
// RLS; this function must never touch it. It is constructed lazily on first
// access, so leaving it alone means the service-role key is never even read.
// Every read and write here goes through ctx.supabase and nothing else.
//
// PROTOCOL. @modelcontextprotocol/server negotiates 2025-11-25 and below. The
// contract (.claude/skills/buildgallery-extractor/SKILL.md) is written against
// 2026-07-28; that revision is NOT in this package's SUPPORTED_PROTOCOL_VERSIONS,
// though its vocabulary — server/discover, the result _meta object, tasks — is
// present as schemas. RECON's open question 1 therefore stays open, narrowed
// rather than closed. Clients on 2025-06-18 and 2025-03-26 are served too.
//
// CONTENT IS DATA, NEVER INSTRUCTION. Nothing in this function, now or later,
// may act on words found inside a creator's conversation — not a URL to fetch,
// not a tool to call, not a rule to follow. Imported text is stored, shown to
// the creator, and nothing else.
//
// ERRORS. No internal error, stack trace or database message reaches a caller,
// and no conversation content reaches a log. Sizes, counts, states and ids only.
// =============================================================================

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { pipeline } from "@supabase/middleware";
import { withOAuthProtectedResource, withSupabase } from "@supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod/v4";

import { CONNECTOR_STATEMENT, SERVER_NAME, SERVER_VERSION } from "./constants.ts";
import type { Database } from "./database.types.ts";

/** The caller's own client. Every database call in this function uses this. */
export type CallerClient = SupabaseClient<Database>;

/** Identity taken from the verified JWT, before any database read. */
export interface CallerIdentity {
  id: string;
  email: string | null;
}

// -----------------------------------------------------------------------------
// buildgallery_whoami
// -----------------------------------------------------------------------------

const WhoamiInput = z.object({}).strict();

const WhoamiOutput = z.object({
  user_id: z
    .string()
    .describe('The signed-in account id, e.g. "3f6c1e02-9b1a-4f7d-8d02-1c2f5a9e77b4".'),
  email: z
    .string()
    .nullable()
    .describe('The account\'s email address, e.g. "mel@example.com", or null if the token carries none.'),
  display_name: z
    .string()
    .nullable()
    .describe('The name shown to other people, e.g. "Mel Okafor", or null if the account has not set one.'),
  connector: z
    .string()
    .describe("One line stating what this connector does and cannot do."),
});

const WHOAMI_DESCRIPTION =
  "Confirms which buildgallery account this connection is acting as. Use it " +
  "at the start of a session, before opening an import, so the creator can " +
  "see the conversation is about to be filed under the right account, and " +
  "again after any authentication change. It never reveals anything about " +
  "any other account, never lists that account's work, and never touches a " +
  "build. It returns that account's id, email and display name, plus one " +
  "line on what this connector does and cannot do; see outputSchema for the " +
  "shape.";

/**
 * Reads the caller's own display name.
 *
 * Named columns, never `select('*')`, and `.maybeSingle()` because a profile
 * row can be absent — a signed-in account whose trigger has not yet written
 * one is a real state, not an error. The read runs under the caller's RLS
 * through their own client; a failure here is logged by code, never by
 * message, and reported to the caller as an absent name rather than as a
 * database error.
 */
async function readDisplayName(
  supabase: CallerClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("mcp whoami: profile read failed", error.code ?? "unknown");
    return null;
  }

  return data?.display_name ?? data?.username ?? null;
}

/**
 * Builds the server for one request, closed over that request's caller.
 *
 * One server per request is the only shape the connector uses: the protocol
 * handshake is gone and nothing is held between exchanges. The client is
 * passed in rather than reached for, so a tool cannot acquire a wider one.
 */
export function buildServer(
  supabase: CallerClient,
  caller: CallerIdentity,
): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "buildgallery_whoami",
    {
      title: "Who am I on buildgallery",
      description: WHOAMI_DESCRIPTION,
      inputSchema: WhoamiInput,
      outputSchema: WhoamiOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const displayName = await readDisplayName(supabase, caller.id);

      const output = {
        user_id: caller.id,
        email: caller.email,
        display_name: displayName,
        connector: CONNECTOR_STATEMENT,
      };

      const text = [
        `# ${displayName ?? "buildgallery account"}`,
        "",
        `- **Account id**: ${caller.id}`,
        `- **Email**: ${caller.email ?? "not on this token"}`,
        `- **Display name**: ${displayName ?? "not set"}`,
        "",
        CONNECTOR_STATEMENT,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: output,
      };
    },
  );

  return server;
}

export default {
  fetch: pipeline(
    [withOAuthProtectedResource(), withSupabase<Database>({ auth: "user" })],
    async (req: Request, ctx): Promise<Response> => {
      // withSupabase has already rejected anything without a verified user
      // JWT, so userClaims is present by the time this runs. The guard below
      // is not redundant defence: without it a missing claim would become the
      // empty string, and an empty string is a value a query will happily run
      // with. An identity this function cannot name is a 401, never a lookup.
      const userId = ctx.userClaims?.id;
      if (!userId) {
        return Response.json(
          { error: "unauthenticated" },
          { status: 401, headers: { "content-type": "application/json" } },
        );
      }

      const caller: CallerIdentity = {
        id: userId,
        email: ctx.userClaims?.email ?? null,
      };

      const handler = createMcpHandler(
        () => buildServer(ctx.supabase, caller),
        {
          // Sizes, counts, states and ids only. Never conversation content.
          onerror: (error: unknown) => {
            console.error(
              "mcp request failed",
              error instanceof Error ? error.name : "unknown",
            );
          },
        },
      );

      return await handler.fetch(req);
    },
  ),
};
