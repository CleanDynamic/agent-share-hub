import { Link } from "react-router-dom";
import type { ReactNode } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   The previous publishing tool, labelled as such.

   /upload and its type-specific routes stay registered and stay working —
   nobody with a draft in progress gets redirected away from it. This banner
   is the only thing that changes about the surface: it says which tool the
   creator is in, and where the replacement is.

   It is deliberately a route-level wrapper rather than an edit to Upload.tsx.
   Upload.tsx is not touched by this sequence, and reverting the commit that
   mounts this wrapper takes the banner off every upload route at once.

   NS-P54 extends it to /bounty/new, and adds a second line for the two bounty
   routes. Bounties are the one thing on this surface that is retired rather
   than superseded-but-still-working: their creation is frozen behind
   src/lib/bounty-legacy/flags.ts, so the line names where the ask lives now
   rather than inviting the creator to finish here. The blueprint and blog
   routes keep the original single-line copy, because they still create.

   BG-P28 REPAINTS IT AS INFORMATION, NOT AS AN ERROR. The banner was #E8571A —
   the old primary accent — at 6% on a 22% border, which on a light room reads
   as a warning strip across the top of a working editor. Nothing here is
   wrong: the tool saves, the tool publishes, and the notice is telling the
   creator where the replacement lives. So it sits on --recess like any other
   informational panel and marks itself with --cat-artefact, the part hue for a
   produced thing, at 6.41:1 on Exhibition and 7.65:1 on Dusk — carried on a
   left edge, which is where this codebase already puts an informational mark.
   The link's borderRadius: 100 went with it: the capsule rule was dropped and
   a pill is off-brand, so it takes --r-control like every other button here.
   The two body lines were fontWeight: 300 at 13px, under the theme's 400 floor
   for anything below 18px; they are 400 now.
   ═══════════════════════════════════════════════════════════════════════════ */

export function LegacyUploadNotice({ bounty = false }: { bounty?: boolean }) {
  return (
    <div
      data-visual-slot="legacy-upload-notice"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        margin: "12px 24px 0 24px",
        padding: "12px 16px",
        borderRadius: "var(--r-control)",
        background: "var(--recess)",
        border: "1px solid var(--line)",
        borderLeft: "3px solid var(--cat-artefact)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--cat-artefact)",
          }}
        >
          Previous publishing tool
        </p>
        <p style={{ fontSize: 13, fontWeight: 400, color: "var(--text2)" }}>
          Blueprints are now built in the build workspace. This editor still
          saves and publishes — finish anything you have in progress here.
        </p>
        {/* NS-P54. Only on the two bounty routes: the blueprint and blog
            editors still create, and telling their creators about a retirement
            that is not theirs would be noise. */}
        {bounty && (
          <p style={{ fontSize: 13, fontWeight: 400, color: "var(--text2)" }}>
            Bounties are now part of publishing a build — mark a part unsolved
            in the composer.
          </p>
        )}
      </div>

      <Link
        to="/compose/new"
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 500,
          padding: "7px 16px",
          borderRadius: "var(--r-control)",
          border: "1px solid var(--line)",
          background: "var(--glass)",
          color: "var(--text)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Open the build workspace
      </Link>
    </div>
  );
}

/**
 * Route element wrapper: the notice, then the page.
 *
 * The height chain matters. Upload.tsx's root is height:100% with its own
 * overflowY:auto, and the shell's .fs-page-body sizes its direct child with
 * flex: 1 0 auto. Wrapping in a column flex box that keeps a definite height
 * and giving the page region flex:1/minHeight:0 leaves that chain intact — the
 * page still owns its scrolling, the banner stays put above it.
 */
export function LegacyUploadRoute({
  children,
  bounty = false,
}: {
  children: ReactNode;
  bounty?: boolean;
}) {
  return (
    <div
      data-visual-slot="legacy-upload-route"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <LegacyUploadNotice bounty={bounty} />
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>{children}</div>
    </div>
  );
}
