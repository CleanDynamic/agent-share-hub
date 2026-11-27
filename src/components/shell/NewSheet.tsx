// The New sheet (29d), opened by the round create button: a content-height `menu` sheet (Panel, radius 20, a Raised grabber, no
// header) with three rows 52 tall: New build, New post, Connect a tool. Each is an icon at 22 in Text 2, 14 across, the name at
// 17/22. Import is not here: it has its own slot in the dock. The choices do exactly what the desktop menu's do: signed out goes
// to sign in; New post opens the posting window; the others go to their page.

import { lazy, Suspense, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { MobileIcon } from "@/components/brand/MobileIcon";
import type { MobileIconName } from "@/components/brand/mobileIcons";
import { useAuth } from "@/contexts/AuthContext";
import { useGo } from "@/lib/routing/go";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { deeper, openOver } from "@/pages/site/signin/signinUrl";
import type { PostingWindow } from "@/pages/site/openbuilds/PostingWindows";

import { PHONE_MARGIN } from "./chromeSize";
import { LazyBottomSheet } from "./LazyBottomSheet";
import { SITE_NAV } from "./siteNav";

const PostingWindows = lazy(() => import("@/pages/site/openbuilds/PostingWindows"));

export type CreateKind = "build" | "post" | "connect";

/** The three items, in `CreateMenu`'s order without Import. */
export const NEW_ITEMS: readonly { kind: CreateKind; label: string; icon: MobileIconName }[] = [
  { kind: "build", label: "New build", icon: "new" },
  { kind: "post", label: "New post", icon: "compose" },
  { kind: "connect", label: "Connect a tool", icon: "connect" },
];

const ROW: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: 52,
  padding: `0 ${PHONE_MARGIN}px`,
  display: "flex",
  alignItems: "center",
  gap: 14,
  border: 0,
  background: "transparent",
  color: t.text,
  fontFamily: FIGTREE,
  fontSize: 17,
  fontWeight: 400,
  lineHeight: "22px",
  textAlign: "left",
  cursor: "pointer",
};

function Row({ label, icon, onSelect }: { label: string; icon: MobileIconName; onSelect: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onSelect} {...handlers} style={{ ...ROW, ...ring(state.focusVisible) }}>
      <span aria-hidden="true" style={{ flexShrink: 0, color: t.text2, display: "inline-flex" }}>
        <MobileIcon name={icon} size={22} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
    </button>
  );
}

export function NewSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { isLoggedIn } = useAuth();
  const { pathname, state: locationState } = useLocation();
  const navigate = useNavigate();
  const go = useGo() ?? navigate;
  const [posting, setPosting] = useState<PostingWindow | null>(null);

  const choose = (kind: CreateKind) => {
    onOpenChange(false);
    if (!isLoggedIn) {
      navigate(openOver(pathname, window.location.search), { state: deeper(locationState) });
      return;
    }
    if (kind === "post") setPosting({ kind: "post" });
    else go(kind === "build" ? SITE_NAV.create : "/connect");
  };

  return (
    <>
      <LazyBottomSheet open={open} onOpenChange={onOpenChange} title="New" hideTitle tone="menu">
        <div role="group" aria-label="New" style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}>
          {NEW_ITEMS.map(({ kind, label, icon }) => (
            <Row key={kind} label={label} icon={icon} onSelect={() => choose(kind)} />
          ))}
        </div>
      </LazyBottomSheet>
      {posting && (
        <Suspense fallback={null}>
          <PostingWindows window={posting} onClose={() => setPosting(null)} onReopen={setPosting} />
        </Suspense>
      )}
    </>
  );
}

export default NewSheet;
