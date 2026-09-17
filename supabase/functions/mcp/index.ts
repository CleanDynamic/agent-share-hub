// =============================================================================
// buildgallery — mcp (EX-P02, the door skeleton)
// =============================================================================
// The MCP door. This function speaks the Model Context Protocol over HTTP and
// nothing else: no database, no storage, no build. EX-P04 puts the lock on it.
//
// THE PRINCIPLE. The connector is a pipe, not an editor. It carries a whole
// conversation verbatim so a human can choose from it later, on the upload
// page, in their own browser. No tool here summarises, selects, reorders or
// publishes, and no eighth tool will be added to do so.
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
// NO SERVICE-ROLE KEY. Not here, not in any later step of this function.
// =============================================================================

import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

import { CONNECTOR_STATEMENT, SERVER_NAME, SERVER_VERSION } from "./constants.ts";

// -----------------------------------------------------------------------------
// buildgallery_whoami
// -----------------------------------------------------------------------------
// In EX-P02 there is no authentication, so there is no account to name. The
// tool reports what the connector is and admits it cannot yet say who is
// calling. EX-P04 replaces that admission with the signed-in account.

const WhoamiInput = z.object({}).strict();

const WhoamiOutput = z.object({
  authenticated: z
    .boolean()
    .describe("Whether this connection is acting as a signed-in account."),
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
  "build. It returns the acting account and one line on what this connector " +
  "does and cannot do; see outputSchema for the shape.";

/**
 * Builds the server for one request.
 *
 * One server per request is the only shape the connector uses: the protocol
 * handshake is gone and nothing is held between exchanges.
 */
export function buildServer(): McpServer {
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
      const output = {
        authenticated: false,
        connector: CONNECTOR_STATEMENT,
      };

      const text = [
        "# buildgallery",
        "",
        "Not signed in — this door has no lock on it yet, so it cannot say " +
          "which account you are.",
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

const handler = createMcpHandler(() => buildServer(), {
  // Sizes, counts, states and ids only. Never conversation content.
  onerror: (error: unknown) => {
    console.error("mcp request failed", error instanceof Error ? error.name : "unknown");
  },
});

export default {
  fetch: (req: Request): Promise<Response> => handler.fetch(req),
};
