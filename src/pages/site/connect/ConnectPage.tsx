/* UI-P45 — /connect in the site frame: the container.

   Public and reads nothing; it only holds the guide's step and tool. */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SeoHead } from "@/components/SeoHead";
import type { GuideStep } from "@/components/connect/ConnectorGuide";
import type { ConnectorTool } from "@/lib/connect/connector";

import { ConnectView } from "./ConnectView";

export default function ConnectPage() {
  const [step, setStep] = useState<GuideStep>(1);
  const [tool, setTool] = useState<ConnectorTool>("Claude");
  const navigate = useNavigate();
  return (
    <>
      <SeoHead
        title="Connect a tool — buildgallery"
        description="Add the buildgallery connector to Claude, Claude Code, ChatGPT or Cursor, then send a conversation to your Drafts page."
        path="/connect"
      />
      <ConnectView
        step={step}
        onStep={setStep}
        tool={tool}
        onTool={setTool}
        onDone={() => navigate("/drafts")}
      />
    </>
  );
}
