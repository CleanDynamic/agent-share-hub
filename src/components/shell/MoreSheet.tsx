// The More sheet (prompt 19): the top bar's right slot on a build, a space, a topic, a profile, the editor and Rebuild. A
// content-height bottom sheet of rows 52 tall at 17/500, no icons, no lines. What the page registered comes first, then the
// bar's own two: Copy link, and Share where the phone can share. A danger row (Report, Block, Clear the build) is in Danger.

import { useState, type CSSProperties } from "react";

import { MobileIcon } from "@/components/brand/MobileIcon";
import { useToast } from "@/hooks/use-toast";
import { DONE, COPY_LINK_FAILED } from "@/lib/copy/copy";
import { copyToClipboard } from "@/lib/deepLink";
import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import { PHONE_MARGIN } from "./chromeSize";
import { LazyBottomSheet } from "./LazyBottomSheet";
import type { MoreItem } from "./phoneBarRegistry";

const ROW: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  minHeight: 52,
  padding: `0 ${PHONE_MARGIN}px`,
  display: "flex",
  alignItems: "center",
  border: 0,
  background: "transparent",
  color: t.text,
  fontFamily: FIGTREE,
  fontSize: 17,
  fontWeight: 500,
  lineHeight: "22px",
  textAlign: "left",
  textDecoration: "none",
  cursor: "pointer",
};

/** Prompt 23: a row with its icon: 52 tall, the icon at 22, the name 15/500, 12 between. */
const ICON_ROW: CSSProperties = { gap: 12, fontSize: 15, lineHeight: "20px" };

function Row({ item, onDone }: { item: MoreItem; onDone: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement & HTMLAnchorElement>();
  const style: CSSProperties = { ...ROW, ...(item.icon ? ICON_ROW : null), ...(item.tone === "danger" ? { color: t.dangerText } : null), ...(item.disabled ? { color: t.label, cursor: "default" } : null), ...ring(state.focusVisible) };
  if (item.to && !item.disabled) {
    return (
      <PageLink to={item.to} onClick={onDone} {...handlers} style={style}>
        {item.icon ? <MobileIcon name={item.icon} size={22} /> : null}
        {item.label}
      </PageLink>
    );
  }
  return (
    <button
      type="button"
      disabled={item.disabled}
      data-tone={item.tone}
      onClick={() => {
        onDone();
        item.onSelect?.();
      }}
      {...handlers}
      style={style}
    >
      {item.icon ? <MobileIcon name={item.icon} size={22} /> : null}
      {item.label}
    </button>
  );
}

export function MoreSheet({ open, onOpenChange, items, bare = false }: { open: boolean; onOpenChange: (open: boolean) => void; items: readonly MoreItem[]; bare?: boolean }) {
  const { toast } = useToast();
  const [shareable] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");
  const close = () => onOpenChange(false);
  const own: MoreItem[] = bare ? [] : [
    {
      label: "Copy link",
      onSelect: () => void copyToClipboard(window.location.href).then((ok) => toast({ title: ok ? DONE.linkCopied : COPY_LINK_FAILED })),
    },
    ...(shareable ? [{ label: "Share", onSelect: () => void navigator.share({ url: window.location.href, title: document.title }).catch(() => undefined) }] : []),
  ];
  /* A bare sheet keeps the page's order (the editor puts Clear the build last itself). */
  const danger = bare ? [] : items.filter((item) => item.tone === "danger");
  const rest = bare ? items : items.filter((item) => item.tone !== "danger");
  return (
    <LazyBottomSheet open={open} onOpenChange={onOpenChange} title="More" hideTitle>
      <div role="group" aria-label="More" data-testid="more-sheet" style={{ paddingBottom: 8 }}>
        {[...rest, ...own, ...danger].map((item) => (
          <Row key={item.label} item={item} onDone={close} />
        ))}
      </div>
    </LazyBottomSheet>
  );
}

export default MoreSheet;
