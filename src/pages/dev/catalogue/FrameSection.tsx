/* UI-P17 — the Frame section: the site header at the width the reference
   catalogue draws it (a 1360 strip over the page backdrop), then the breadcrumb
   and the footer (UI-P18). UI-P19 adds the phone header and the two dock states. */

import { useDesignTheme } from "@/dev/useDesignTheme";
import { t } from "@/lib/theme/tokens";

import { devChrome } from "../frameChrome";
import { Example, Section } from "./parts";

function Strip({ width, height, children }: { width: number; height?: number; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background: t.backdrop }}>{children}</div>
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
        <Strip width={1360} height={88}>
          {chrome.footer}
        </Strip>
      </Example>
    </Section>
  );
}
