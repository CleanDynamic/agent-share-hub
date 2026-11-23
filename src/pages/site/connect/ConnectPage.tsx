/* UI-P45 — /connect in the site frame: the container.

   Public and reads nothing; it only holds the guide's step and tool. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import type { ConnectorTool } from "@/lib/connect/connector";

import { ConnectView } from "./ConnectView";
import { SITE_NAME } from "@/lib/site";

export default function ConnectPage() {
  const [tool, setTool] = useState<ConnectorTool>("Claude");
  const navigate = useNavigate();
  return (
    <>
      <SeoHead
        title="Connect a tool"
        description={`Add the ${SITE_NAME} connector to Claude, Claude Code, ChatGPT or Cursor, then send a conversation to your Drafts page.`}
        path="/connect"
      />
      <ConnectView
        tool={tool}
        onTool={setTool}
        onDone={() => navigate("/drafts")}
      />
    </>
  );
}
