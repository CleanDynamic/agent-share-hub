/* UI-P36 — Sign in, Join, reset and verify, as the reference draws them
   (design/reference/{desktop,mobile}/{noon,dusk}/signin.html).

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   links. The four containers supply the card's body and the data; the dev
   compare page supplies the sample data; both render this. The viewport is read
   here (the app's 768px breakpoint) so the two behave the same.

   DESKTOP: the content centred in the viewport, a row with a 79px gap. On the
   left the lockup, the tagline and two orbs; on the right the card — 420 wide,
   the only blurred surface on the page — and the theme control under it. The
   card's top row is a Back link and the Sign in · Join free switch. Below
   about 1100px the row cannot hold both columns, so it wraps and the card falls
   under the lockup, as the footer's row does.

   PHONE: no Back link and no orbs. The lockup and tagline, then the form in a
   glass panel with the switch at the top of it, then the theme control.

   DENSER SINCE UI-P57: every size this file and the auth parts set themselves is
   the tightened board's (`design/prompts/README-density.md`) — the row 79 apart
   (110 before), the card 19 in and 9 apart, fields 36 tall. Two things keep their
   old numbers on purpose: a phone's fields stay 44 (the board's 39 is the script
   judging a span, not the input in it, and a field is the touch target), and the
   remember row keeps its 19px line, the height of a native checkbox the pass
   does not touch. The lockup, the tagline, the orbs and the buttons map their
   own drawn sizes.

   THE SWITCH IS TWO LINKS, not two buttons that navigate. Sign in and Join free
   are two pages, and each side of the control is the address it goes to, with
   `?redirect=` carried across so the visitor's destination survives the round
   trip. Reset and verify have no current side, so they have no switch.

   THE THEME CONTROL IS A RADIO GROUP here, as the entrance's theme control has
   always been: one tab stop, the arrows move the choice.

   IT NEVER SCROLLS SIDEWAYS. The two layouts are chosen in JavaScript (the
   768px breakpoint is a `matchMedia` read), so for a frame after the window
   narrows the desktop row is still on screen at phone width. The root clips that
   frame instead of letting the document grow a scrollbar for it. */

import type { MouseEvent, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { Lockup } from "@/components/brand/Lockup";
import { Mark } from "@/components/brand/Mark";
import { OrbGlass } from "@/components/brand/OrbGlass";
import { OrbSolid } from "@/components/brand/OrbSolid";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { Panel } from "@/components/brand/Panel";
import { Segmented } from "@/components/brand/Segmented";
import { Tagline } from "@/components/brand/Tagline";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { FrameLink } from "@/components/shell/FrameLink";
import type { PageFit } from "@/components/shell/siteFrameFit";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { ThemeSegmented } from "@/components/theme/ThemeSegmented";
import type { ThemeChoice } from "@/contexts/ThemeContext";
import { useLook } from "@/lib/theme/look";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import type { AuthMode } from "./authModel";

const TAGLINE = ["Every AI build,", "hung with", "its proof."] as const;

/** The height of each board, under the browser strip. */
const BOARD = { desktop: 1000, phone: 844 } as const;

export interface SignInViewProps {
  /** `board` is the reference's height; `content` is the viewport's, growing with the card. */
  fit?: PageFit;
  mode: AuthMode;
  /** The query string the switch carries to the other page: "" or "?redirect=%2Fgallery". */
  carry?: string;
  /** Back: one step in the history, or Home. */
  onBack: () => void;
  /** Runs recorded today; null while it loads or when it could not be read. */
  reproducedToday: number | null;
  /** Builds hung in the gallery; null while it loads or when it could not be read. */
  inGallery: number | null;
  /** A count could not be read: its orb is left out rather than left pulsing. */
  countsFailed?: boolean;
  /** The compare page draws the room it was asked for; the live page leaves this out and the control reads the stored choice. */
  themeValue?: ThemeChoice;
  /** The card's body: a form, or one of the reset and verify states. */
  children: ReactNode;
}

export function SignInView(props: SignInViewProps) {
  return useIsPhone() ? <PhoneView {...props} /> : <DesktopView {...props} />;
}

/* ── the pieces both share ── */

/**
 * An orb before its number has arrived: a circle of the orb's diameter. A count that could not
 * be read draws nothing — these are the entrance's decoration, and a retry button on a sign-in
 * page would be noise next to the form — so a failed read never leaves a circle pulsing forever.
 */
function OrbPlaceholder({ failed }: { failed?: boolean }) {
  return failed ? null : <Skeleton width={140} height={140} radius="50%" />;
}

function Orbs({ reproducedToday, inGallery, countsFailed }: Pick<SignInViewProps, "reproducedToday" | "inGallery" | "countsFailed">) {
  const waiting = (reproducedToday === null || inGallery === null) && !countsFailed;
  const row = { display: "flex", gap: 9 } as const;
  const orbs = (
    <>
      {reproducedToday === null ? (
        <OrbPlaceholder failed={countsFailed} />
      ) : (
        <OrbGlass size={140} label="Reproduced" sub={`${reproducedToday.toLocaleString("en-GB")} today`} />
      )}
      {inGallery === null ? (
        <OrbPlaceholder failed={countsFailed} />
      ) : (
        <OrbSolid size={140} top="Hung" value={inGallery.toLocaleString("en-GB")} bottom="builds" />
      )}
    </>
  );
  return waiting ? (
    <LoadingRegion what="the counts" style={row}>
      {orbs}
    </LoadingRegion>
  ) : (
    <div style={row}>{orbs}</div>
  );
}


/* ── the refined look's pieces (UI-P95): the entrance without orbs or chips ── */

/** The tagline as one heading in the page-title role: plain Geist lines, the mark after "hung with", no chips. */
function RefinedTagline({ size }: { size: number }) {
  return (
    <h1
      data-ui="tagline"
      style={{
        margin: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: FIGTREE,
        fontSize: size,
        fontWeight: 500,
        letterSpacing: "-0.04em",
        lineHeight: 1.04,
        color: t.text,
      }}
    >
      <VisuallyHidden>{TAGLINE.join(" ")}</VisuallyHidden>
      <span aria-hidden="true">{TAGLINE[0]}</span>
      <span aria-hidden="true" style={{ paddingLeft: 48, display: "inline-flex", alignItems: "center", gap: 12 }}>
        {TAGLINE[1]}
        <Mark size={Math.round(size * 0.68)} />
      </span>
      <span aria-hidden="true" style={{ paddingLeft: 24 }}>
        {TAGLINE[2]}
      </span>
    </h1>
  );
}

/** One live count as a module: the words, then the number in tabular Geist Mono. */
function CountModule({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div
      style={{
        flex: "1 1 0",
        minWidth: 0,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 16,
        background: t.module,
        border: `1px solid ${t.moduleBorder}`,
        borderRadius: 8,
        boxShadow: t.moduleShadow,
      }}
    >
      <span style={{ fontFamily: FIGTREE, fontSize: 12, fontWeight: 500, lineHeight: "normal", color: t.label }}>{label}</span>
      <span style={{ fontFamily: DM_MONO, fontSize: 24, lineHeight: "normal", color: t.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <span style={{ fontFamily: FIGTREE, fontSize: 11.5, lineHeight: "normal", color: t.label }}>{unit}</span>
    </div>
  );
}

function RefinedCounts({ reproducedToday, inGallery, countsFailed }: Pick<SignInViewProps, "reproducedToday" | "inGallery" | "countsFailed">) {
  const waiting = (reproducedToday === null || inGallery === null) && !countsFailed;
  const row = { display: "flex", gap: 12 } as const;
  const placeholder = countsFailed ? null : <Skeleton height={92} radius={8} style={{ flex: "1 1 0" }} />;
  const counts = (
    <>
      {reproducedToday === null ? placeholder : <CountModule label="Reproduced" value={reproducedToday.toLocaleString("en-GB")} unit="today" />}
      {inGallery === null ? placeholder : <CountModule label="Hung" value={inGallery.toLocaleString("en-GB")} unit="builds" />}
    </>
  );
  return waiting ? (
    <LoadingRegion what="the counts" style={row}>
      {counts}
    </LoadingRegion>
  ) : (
    <div style={row}>{counts}</div>
  );
}

/** Sign in · Join free: two pages, so two links. Only the first two modes have a current side. */
function AccountSwitch({ mode, carry, size, fontSize }: { mode: AuthMode; carry: string; size: 32 | 38; fontSize: 12 | 13 }) {
  return (
    <Segmented
      label="Sign in or join"
      size={size}
      fontSize={fontSize}
      value={mode === "signup" ? "signup" : "login"}
      items={[
        { value: "login", label: "Sign in", href: `/login${carry}` },
        { value: "signup", label: "Join free", href: `/signup${carry}` },
      ]}
    />
  );
}

const hasSwitch = (mode: AuthMode) => mode === "login" || mode === "signup";

/** A link home that goes one step back when there is a step to go back to. */
function BackLink({ onBack }: { onBack: () => void }) {
  /* A labelled link carries no icon under the refined look: the word is the link. */
  const refined = useLook() === "refined";
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window gets the address; a plain click gets the history.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onBack();
  };
  return (
    <FrameLink
      to="/"
      onClick={back}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        /* A 27px target in the switch's 30px row: the row does not grow. */
        padding: "6px 0",
        fontFamily: FIGTREE,
        fontSize: 12,
        color: t.text2,
      }}
    >
      {refined ? null : <ArrowLeft size={15} strokeWidth={1.6} aria-hidden="true" style={{ flexShrink: 0 }} />}
      Back
    </FrameLink>
  );
}

/* ── desktop ── */

function DesktopView({ fit = "content", mode, carry = "", onBack, reproducedToday, inGallery, countsFailed, themeValue, children }: SignInViewProps) {
  const refined = useLook() === "refined";
  return (
    <div
      data-testid="signin-view"
      data-viewport="desktop"
      data-mode={mode}
      style={{
        ...(fit === "board" ? { height: BOARD.desktop } : { minHeight: "100dvh" }),
        boxSizing: "border-box",
        overflowX: "hidden",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        alignContent: "center",
        justifyContent: "center",
        columnGap: 79,
        rowGap: 29,
        padding: "23px 17px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Lockup size={70} />
        {refined ? <RefinedTagline size={44} /> : <Tagline lines={TAGLINE} size={40} offsets={[0, 70, 24]} />}
        {refined ? (
          <RefinedCounts reproducedToday={reproducedToday} inGallery={inGallery} countsFailed={countsFailed} />
        ) : (
          <Orbs reproducedToday={reproducedToday} inGallery={inGallery} countsFailed={countsFailed} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          data-testid="signin-card"
          data-ui="signin-card"
          style={{
            width: 420,
            boxSizing: "border-box",
            ...(refined
              ? { padding: 16, borderRadius: 8, background: t.module, border: `1px solid ${t.moduleBorder}`, boxShadow: t.moduleShadow }
              : {
                  padding: 19,
                  borderRadius: 20,
                  background: t.header,
                  border: `1px solid ${t.headerBorder}`,
                  boxShadow: `${t.shadowFloat}, ${t.panelHighlight}`,
                }),
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <BackLink onBack={onBack} />
            {hasSwitch(mode) ? <AccountSwitch mode={mode} carry={carry} size={32} fontSize={12} /> : null}
          </div>
          {children}
        </div>
        <ThemeSegmented size={34} fontSize={12} value={themeValue} semantics="radio" />
      </div>
    </div>
  );
}

/* ── phone ── */

function PhoneView({ fit = "content", mode, carry = "", themeValue, children }: SignInViewProps) {
  const refined = useLook() === "refined";
  return (
    <div
      data-testid="signin-view"
      data-viewport="mobile"
      data-mode={mode}
      style={{
        ...(fit === "board" ? { height: BOARD.phone } : { minHeight: "100dvh" }),
        boxSizing: "border-box",
        overflowX: "hidden",
        padding: "16px 10px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 13, padding: "7px 0 4px" }}>
        <Lockup size={34} />
        {refined ? <RefinedTagline size={36} /> : <Tagline lines={TAGLINE} size={26} offsets={[0, 40, 12]} />}
      </div>

      <Panel surface="glass" padding="16px">
        <div data-testid="signin-card" data-ui="signin-card" style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {hasSwitch(mode) ? <AccountSwitch mode={mode} carry={carry} size={38} fontSize={13} /> : null}
          {children}
        </div>
      </Panel>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <ThemeSegmented size={36} fontSize={12} value={themeValue} semantics="radio" />
      </div>
    </div>
  );
}

export default SignInView;
