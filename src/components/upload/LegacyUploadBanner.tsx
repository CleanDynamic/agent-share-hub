import { Link } from "react-router-dom";

/**
 * A standing notice at the top of the old blueprint editor: this is the
 * previous publishing tool, the build workspace is the current one.
 *
 * Rendered by the route element in App.tsx, never by Upload.tsx. The old
 * editor is not edited in this prompt, and nothing here redirects — a
 * creator with a draft in progress finishes it where they started it.
 *
 * Layout notes, because this mounts as a sibling of a page that manages its
 * own height:
 *
 *  - `.fs-page-body > *` sets `flex: 1 0 auto` on every direct child of the
 *    centre column's scroll region. Inline `flex: 0 0 auto` beats that rule
 *    and keeps the banner at its natural height instead of letting it grow
 *    to share the column with the editor.
 *  - `position: sticky` keeps it in view as the scroll region moves, which
 *    is what makes it persistent rather than something you scroll past once.
 *
 * Both properties are on this new element only. No existing layout element's
 * structural CSS is touched.
 */
export function LegacyUploadBanner() {
  return (
    <div
      data-testid="legacy-upload-banner"
      style={{
        flex: "0 0 auto",
        position: "sticky",
        top: 0,
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        padding: "10px 16px",
        background: "rgba(8,8,12,0.95)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(31,122,109,0.30)",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 300, color: "rgba(255,255,255,0.60)", margin: 0 }}>
        This is the previous publishing tool. Your draft still saves and
        publishes here.
      </p>
      <Link
        to="/compose/new"
        style={{
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 500,
          padding: "6px 14px",
          borderRadius: 100,
          border: "1px solid rgba(31,122,109,0.30)",
          color: "#1F7A6D",
          background: "rgba(31,122,109,0.06)",
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        Try the build workspace
      </Link>
    </div>
  );
}

export default LegacyUploadBanner;
