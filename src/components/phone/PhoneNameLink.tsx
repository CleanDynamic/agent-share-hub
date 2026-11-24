// An author's name on a phone (prompt 21): a link to their profile when they have a handle, plain text when not. The link's hit
// area is 44 tall by padding 12 above and below, the margin taking it back, so the row looks as it did. 15/600 in Text.

import type { CSSProperties, ReactNode } from "react";

import { PageLink } from "@/lib/routing/PageLink";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

const NAME: CSSProperties = { fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, lineHeight: "20px", color: t.text, flex: "0 0 auto", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 };

export function PhoneNameLink({ handle, children }: { handle: string | null | undefined; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  if (!handle) return <span style={NAME}>{children}</span>;
  return (
    <PageLink
      to={`/profile/${encodeURIComponent(handle)}`}
      data-testid="phone-author-name"
      {...handlers}
      style={{ ...NAME, display: "block", textDecoration: "none", padding: "12px 0", margin: "-12px 0", borderRadius: 4, ...ring(state.focusVisible) }}
    >
      {children}
    </PageLink>
  );
}

export default PhoneNameLink;
