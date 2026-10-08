/* UI-P45 — /connect in the site frame: the view.

   Pure: the page holds the step and the tool and says where "Go to Drafts"
   goes. The guide is the same one the dialog shows, inline in a plain panel. */

import { Panel } from "@/components/brand/Panel";
import { ConnectorGuide, type ConnectorGuideProps } from "@/components/connect/ConnectorGuide";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE, display } from "@/lib/theme/type";

export type ConnectViewProps = Omit<ConnectorGuideProps, "doneLabel" | "gutter">;

export function ConnectView(props: ConnectViewProps) {
  const phone = useIsPhone();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 720, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <h1 style={{ ...(phone ? display(32, { mobilePageHeading: true }) : display(44)), margin: 0, color: t.text }}>
          Connect a tool
        </h1>
        <p style={{ fontFamily: FIGTREE, fontSize: 14, lineHeight: 1.5, margin: 0, color: t.text2 }}>
          Send the chats you build in to buildgallery, then turn them into builds.
        </p>
      </div>
      <Panel surface="plain" padding="0">
        <ConnectorGuide {...props} doneLabel="Go to Drafts" />
      </Panel>
    </div>
  );
}

export default ConnectView;
