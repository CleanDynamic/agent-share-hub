/* Synth 10 Part E: /connect in the site frame: the view.

   Pure: the page holds the tool and says where "Go to Drafts" goes. One panel at 680 at every desktop width, centred: the
   h1 "Connect a tool" (31/36), then the three numbered steps (the AI tool switch as pills, the connector address in a
   Card, Send a session, Use it in a build). The dialog keeps the stepper; the page lays the three out together. */

import { ConnectSteps, type ConnectStepsProps } from "@/components/connect/ConnectorGuide";
import { useColumnPanels } from "@/components/shell/frameChrome";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { t } from "@/lib/theme/tokens";
import { hero } from "@/lib/theme/type";

export type ConnectViewProps = Omit<ConnectStepsProps, "doneLabel">;

export function ConnectView(props: ConnectViewProps) {
  const phone = useIsPhone();
  /* On a phone the frame's panel steps back: the modules sit on the Page shade. */
  useColumnPanels(phone);
  if (phone) {
    /* Mobile prompt 25: the top bar's title names the page, so the h1 is for screen readers; the steps are Panel modules that
       carry their own 16 margin. */
    return (
      <div data-testid="connect-view" style={{ minWidth: 0 }}>
        <h1 className="sr-only">Connect a tool</h1>
        <ConnectSteps {...props} doneLabel="Go to Drafts" />
      </div>
    );
  }
  return (
    <div data-testid="connect-view" style={{ maxWidth: 680, margin: "0 auto", padding: "8px 16px 64px", minWidth: 0 }}>
      <h1 style={{ ...hero, margin: "0 0 24px", color: t.text }}>Connect a tool</h1>
      <ConnectSteps {...props} doneLabel="Go to Drafts" />
    </div>
  );
}

export default ConnectView;
