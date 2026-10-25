// The connector's address, its one terminal command and each tool's own guide.
//
// UI-P45. These are the strings a creator carries into somebody else's product,
// so they are written once here and the guide, the page and the tests all read
// them. `src/pages/Connect.tsx` imports it from here; `public/ai.txt` carries the
// address too.

/**
 * The connector's address: the project's `mcp` edge function, built from
 * VITE_SUPABASE_URL in this one place (CA-29).
 */
export const CONNECTOR_URL = `${String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "")}/functions/v1/mcp`;

/** The one line Claude Code needs. Built from the address, never retyped. */
export const CLAUDE_CODE_COMMAND = "claude mcp add --transport http buildgallery " + CONNECTOR_URL;

export const CONNECTOR_TOOLS = ["Claude", "Claude Code", "ChatGPT", "Cursor"] as const;

export type ConnectorTool = (typeof CONNECTOR_TOOLS)[number];

export interface GuideLink {
  label: string;
  href: string;
}

/** Each tool's own help, linked rather than restated. Claude Code has none. */
export const GUIDE_LINKS: Partial<Record<ConnectorTool, GuideLink>> = {
  Claude: {
    label: "Anthropic's guide to custom connectors",
    href: "https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp",
  },
  ChatGPT: {
    label: "OpenAI's guide to Developer Mode and MCP apps",
    href: "https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt",
  },
  Cursor: {
    label: "Cursor's MCP documentation",
    href: "https://cursor.com/docs/mcp",
  },
};
