// The New sheet (prompt 19), opened by the dock's New: a content-height bottom sheet with no visible title and the four
// `CreateMenu` items in the repo's order as rows 64 tall. Each row is a 40 icon square on Raised (radius 10) with the item's
// icon, the name at 15/500 and a chevron at the right. No line under the names. The choices do exactly what the desktop menu's
// do: signed out goes to sign in; New post opens the posting window; the others go to their page.

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

export type CreateKind = "build" | "import" | "post" | "connect";

/** The four items, in `CreateMenu`'s order. */
export const NEW_ITEMS: readonly { kind: CreateKind; label: string; icon: MobileIconName }[] = [
  { kind: "build", label: "New build", icon: "new" },
  { kind: "import", label: "Import", icon: "import" },
  { kind: "post", label: "New post", icon: "compose" },
  { kind: "connect", label: "Connect a tool", icon: "connect" },
];

const ROW: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: 64,
  padding: `0 ${PHONE_MARGIN}px`,
  display: "flex",
  alignItems: "center",
  gap: 12,
  border: 0,
  background: "transparent",
  color: t.text,
  fontFamily: FIGTREE,
  fontSize: 15,
  fontWeight: 500,
  lineHeight: "20px",
  textAlign: "left",
  cursor: "pointer",
};

function Row({ label, icon, onSelect }: { label: string; icon: MobileIconName; onSelect: () => void }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button type="button" onClick={onSelect} {...handlers} style={{ ...ROW, ...ring(state.focusVisible) }}>
      <span aria-hidden="true" data-fill="raised" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: t.control, color: t.text }}>
        <MobileIcon name={icon} size={20} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{label}</span>
      <span aria-hidden="true" style={{ flexShrink: 0, color: t.label, display: "inline-flex" }}>
        <MobileIcon name="chevr" size={20} />
      </span>
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
    else go(kind === "build" ? SITE_NAV.create : kind === "import" ? "/import" : "/connect");
  };

  return (
    <>
      <LazyBottomSheet open={open} onOpenChange={onOpenChange} title="New" hideTitle>
        <div role="group" aria-label="New" style={{ paddingBottom: 8 }}>
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
