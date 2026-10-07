/* UI-P17 — the Frame section: the site header at the width the reference
   catalogue draws it (a 1360 strip over the page backdrop), then the breadcrumb
   and the footer (UI-P18), then the phone header and the two dock states (UI-P19). */

import { DockView } from "@/components/shell/Dock";
import { fixtures } from "@/dev/designFixtures";
import { useDesignTheme } from "@/dev/useDesignTheme";
import { t } from "@/lib/theme/tokens";

import { devChrome } from "../frameChrome";
import { Example, Row, Section } from "./parts";

function Strip({ width, height, plain, children }: { width: number; height?: number; plain?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background: plain ? undefined : t.backdrop }}>{children}</div>
  );
}

export function FrameSection() {
  const theme = useDesignTheme();
  const chrome = devChrome({ theme, current: "gallery" });

  return (
    <Section name="Frame" note="site header (desktop) · breadcrumb · footer · mobile header · dock">
      <Example caption="site header · Gallery current">
        <Strip width={1360} height={64}>
          {chrome.header}
        </Strip>
      </Example>
      <div style={{ height: 12 }} />
      <Example caption="breadcrumb">{chrome.breadcrumb}</Example>
      <div style={{ height: 12 }} />
      <Example caption="site footer">
        <Strip width={1360} height={88} plain>
          {chrome.footer}
        </Strip>
      </Example>
      <div style={{ height: 18 }} />
      <Row gap={17} style={{ alignItems: "flex-start" }}>
        <Example caption="mobile header">
          <Strip width={390} plain>{chrome.mobileHeader}</Strip>
        </Example>
        <Example caption="dock · Home current">
          <Strip width={390} height={96}>
            <DockView current="home" unread={fixtures.viewer.unread} placement="absolute" />
          </Strip>
        </Example>
        <Example caption="dock · Activity current">
          <Strip width={390} height={96}>
            <DockView current="activity" unread={fixtures.viewer.unread} placement="absolute" />
          </Strip>
        </Example>
      </Row>
    </Section>
  );
}
