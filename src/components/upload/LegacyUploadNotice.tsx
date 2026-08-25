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
   ═══════════════════════════════════════════════════════════════════════════ */

export function LegacyUploadNotice() {
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
        borderRadius: 12,
        background: "rgba(232,87,26,0.06)",
        border: "1px solid rgba(232,87,26,0.22)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
        <p
          style={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#E8571A",
          }}
        >
          Previous publishing tool
        </p>
        <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.60)" }}>
          Blueprints are now built in the build workspace. This editor still
          saves and publishes — finish anything you have in progress here.
        </p>
      </div>

      <Link
        to="/compose/new"
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 500,
          padding: "7px 16px",
          borderRadius: 100,
          border: "1px solid rgba(232,87,26,0.35)",
          background: "rgba(232,87,26,0.10)",
          color: "#E8571A",
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
export function LegacyUploadRoute({ children }: { children: ReactNode }) {
  return (
    <div
      data-visual-slot="legacy-upload-route"
      style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}
    >
      <LegacyUploadNotice />
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>{children}</div>
    </div>
  );
}
