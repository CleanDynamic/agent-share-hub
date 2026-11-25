/* Synth 13 Part A: groups have no boxes. A section is a visually hidden h1 (the chosen row in the list names it) and its
   groups, at most 720 wide: a 17/600 heading, then rows: the label 15, one line of explanation 13 Text 3, one control at the
   right. On a phone the section is a page of its own and its h1 shows, with a back link to the list.

   UX-15 P2: the pieces every section is made of. PURE.

   A section is an `h1`, then groups. A group is a `module` box with a `SectionHead` and rows. A row is a label in `text`, one line of
   explanation in `label`, and one control on the right (below, on a phone). Nothing here animates and nothing is new: the box is
   the module recipe, the type is the site's roles, the colours are tokens. */

import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { PHONE_MARGIN } from "@/components/shell/chromeSize";
import { useRegisterPageBar } from "@/components/shell/phoneBarRegistry";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { settingsPath } from "@/lib/settings/sections";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";
import { FieldMessage } from "@/pages/site/signin/AuthParts";

export const sectionTitle: CSSProperties = {
  margin: 0,
  fontFamily: FIGTREE,
  fontSize: 20,
  fontWeight: 500,
  lineHeight: 1.2,
  letterSpacing: "-0.015em",
  color: t.text,
};

/** The section's heading (14 on a desktop, 20 where it is a phone's page title) and the column the groups sit in (48 between groups, the site's rule). The heading is an `h2` under
    the page's "Settings" on a desktop, and the page's `h1` on a phone, where the section is a page of its own. */
export function SectionPage({ title, children }: { title: string; children: ReactNode }) {
  const phone = useIsPhone();
  /* Mobile prompt 27 Part A: a section is a page pushed on the list. The top bar carries Back and the section's name, so the h1 is
     read aloud and not drawn a second time. */
  useRegisterPageBar(phone ? { title, backLabel: "Back to settings", backTo: settingsPath() } : null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? 16 : 0, fontFamily: FIGTREE, maxWidth: 720, paddingBottom: phone ? 24 : undefined }}>
      <h1 className="sr-only" style={{ ...sectionTitle, fontSize: 20, fontWeight: 600, lineHeight: "24px" }}>
        {title}
      </h1>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? 24 : 32 }}>{children}</div>
    </div>
  );
}

/** A group: its 17/600 heading and its rows, with no box. On a phone it is a Panel module (radius 12, margin 0 16) under a 13/500 Text 3 label. */
export function Group({ title, meta, children, testId }: { title: string; meta?: ReactNode; children: ReactNode; testId?: string }) {
  const phone = useIsPhone();
  if (phone) {
    return (
      <section aria-label={title} data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, padding: `0 ${PHONE_MARGIN}px` }}>
          <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: "16px", color: t.label }}>{title}</h2>
          {meta ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{meta}</span> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", margin: `0 ${PHONE_MARGIN}px`, padding: `4px ${PHONE_MARGIN}px`, borderRadius: 12, background: t.surface }}>{children}</div>
      </section>
    );
  }
  return (
    <section aria-label={title} data-testid={testId} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "24px", color: t.text }}>{title}</h2>
        {meta ? <span style={{ fontSize: 13, lineHeight: "16px", color: t.label }}>{meta}</span> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </section>
  );
}

export interface SettingRowProps {
  label: ReactNode;
  /** One line under the label. */
  hint?: ReactNode;
  /** The one control or button. */
  control?: ReactNode;
  /** No hairline under it. */
  last?: boolean;
  /** Sits under the row, full width: a form that opened in place. */
  below?: ReactNode;
  id?: string;
}

export function SettingRow({ label, hint, control, last = false, below, id }: SettingRowProps) {
  const phone = useIsPhone();
  return (
    <div style={{ padding: phone ? "8px 0" : "12px 0" }} data-ui="setting-row" data-last={last ? "" : undefined}>
      <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: phone ? 12 : 16, minHeight: phone ? 40 : 32 }}>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div id={id} style={{ fontSize: 15, fontWeight: phone ? 500 : 400, lineHeight: "20px", color: t.text }}>{label}</div>
          {hint ? <div style={{ fontSize: 13, fontWeight: 400, lineHeight: "16px", color: t.label, marginTop: 2 }}>{hint}</div> : null}
        </div>
        {control ? <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>{control}</div> : null}
      </div>
      {below ? <div style={{ marginTop: 12 }}>{below}</div> : null}
    </div>
  );
}

/** A sentence that is not a setting: the status of a save, a reason a control is off. `label` colour, 12px. */
export function Note({ children, role }: { children: ReactNode; role?: "status" | "alert" }) {
  return (
    <p role={role} style={{ margin: 0, fontSize: 13, fontWeight: 400, lineHeight: 1.4, color: t.label }}>
      {children}
    </p>
  );
}

/** A question asked once, in place: the sentence, then the confirming button and Cancel. Used by the actions the prompt says confirm once. */
export function ConfirmInline({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  error,
}: {
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  return (
    <div role="group" aria-label="Confirm" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 400, lineHeight: "20px", color: t.text }}>{message}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button variant="secondary" size={32} fontSize={13} disabled={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="ghost" size={32} fontSize={13} disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error ? <FieldMessage>{error}</FieldMessage> : null}
    </div>
  );
}

/** One group while it loads: its setting rows (with a hint line or without), or, for a group that may hold only a note, one
    note's line. */
export interface GroupBones {
  rows: number;
  hint?: boolean;
}

/** A bar inside a line of text: the line keeps the text's own height, so a bone row is the loaded row's height. */
const bar = (width: string, height: number) => <Skeleton width={width} height={height} radius={4} style={{ display: "inline-block", verticalAlign: "middle" }} />;

/** A group while it loads: the module box and its padding, the head's line, then its rows (or one note's line) at the loaded
    sizes, so the card is the loaded card's height when it holds the fewest rows it can. */
function GroupSkeleton({ rows, hint = false }: GroupBones) {
  return (
    <div data-testid="settings-card-bones" aria-hidden="true" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 15, lineHeight: 1.3 }}>{bar("30%", 12)}</div>
      {rows === 0 ? (
        <div style={{ fontSize: 13, lineHeight: 1.4 }}>{bar("70%", 10)}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {Array.from({ length: rows }, (_, index) => (
            <SettingRow key={index} last={index === rows - 1} label={bar("40%", 12)} hint={hint ? bar("60%", 10) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

/** While a section's data is on its way: the title and one card per group it will show, each at that group's least height. */
export function SectionLoading({ title, groups }: { title: string; groups: readonly GroupBones[] }) {
  return (
    <SectionPage title={title}>
      <LoadingRegion what={title.toLowerCase()} announce style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {groups.map((group, index) => (
          <GroupSkeleton key={index} {...group} />
        ))}
      </LoadingRegion>
    </SectionPage>
  );
}

