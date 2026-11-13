/* UI-P45 — /connect in the site frame: the view.

   Pure: the page holds the step and the tool and says where "Go to Drafts"
   goes. The guide is the same one the dialog shows, inline in a plain panel. */

import { Panel } from "@/components/brand/Panel";
import { ConnectorGuide, type ConnectorGuideProps } from "@/components/connect/ConnectorGuide";
import { Breadcrumb } from "@/components/shell/Breadcrumb";
import { PageHeader } from "@/components/shell/PageHeader";
import { pageColumns } from "@/components/shell/pageGrid";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { SITE_NAME } from "@/lib/site";

export type ConnectViewProps = Omit<ConnectorGuideProps, "doneLabel" | "gutter">;

export function ConnectView(props: ConnectViewProps) {
  const phone = useIsPhone();
  const guide = (
    <Panel surface="plain" padding="0">
      <ConnectorGuide {...props} doneLabel="Go to Drafts" />
    </Panel>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: phone ? 720 : undefined, minWidth: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <PageHeader title="Connect a tool" breadcrumb={phone ? undefined : <Breadcrumb />} />
        <p style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: 1.5, margin: 0, color: t.text2 }}>
          Send the chats you build in to {SITE_NAME}, then turn them into builds.
        </p>
      </div>
      {/* Desktop: the page grid's feed template, the guide in columns 4 to 9. */}
      {phone ? guide : (
        <div style={pageColumns("feed")}>
          <div style={{ gridColumn: 2, minWidth: 0 }}>{guide}</div>
        </div>
      )}
    </div>
  );
}

export default ConnectView;
