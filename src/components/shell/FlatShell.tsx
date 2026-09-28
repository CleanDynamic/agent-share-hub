import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import "./flat-shell.css";

/* ────────────────────────────────────────────────
   FlatShell — pure presentational app frame.

   The application's frame, flat and standard-2D. It replaced the
   compositing-heavy NeoScaleShell, which BG-P17 deleted — so this is now
   the only frame, not an alternative to one. Hard rules (see
   flat-shell.css): no SVG filters, no 3D transforms, no scale wrapper,
   and — since BG-P13 — no backdrop-filter at all: the left nav is a
   full-height sticky panel, which the theme's glass rule never blurs.

   RC-P06 — TWO COLUMNS. The frame is the left nav and the centre column,
   centred together as one pair. The right rail is gone from every route
   (CONTRACT §3.1); its slot remains for one tenant only, the legacy
   editor's workspace on /upload/blueprint, until RC-P08b removes it.

   BG-P18b — ONE GROUND AND ONE SURFACE. The nav and the centre column
   are not panels. Nothing in the frame paints a background: the page is
   `--bg` on html/body/#root, the nav sits directly on it, and the only
   separation between the two is a `--line` hairline down each side of
   the centre. The nav is the room; the centre is the stage.

   This component knows nothing about routing, auth, or data — the wired
   container (AppShell) supplies everything through props.

   BG-P14 — TWO LAYOUT MODES. `layout="standard"` is the frame most routes
   render: the 240px nav beside a 634px reading column, in a frame capped at
   1200px. `layout="wide"` is the same frame with the centre unpinned, for the
   surfaces that need a grid. The mode is one class on the root (`.fs-wide`) and every rule it turns
   on is scoped under it, so a standard frame is byte-for-byte the frame it was.
   Which routes are wide is decided by `wideRoutes.ts`, not here and not by a
   page.
──────────────────────────────────────────────── */

export interface FlatShellNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  route: string;
  badge?: string | null;
  /** Render the badge in the muted grey style (used by Drafts). */
  badgeMuted?: boolean;
  /** Render a small orange dot instead of a numbered badge (Library unseen saves). */
  dot?: boolean;
  /** Draw a divider line above this row. */
  divider?: boolean;
}

export interface FlatShellUser {
  name: string;
  initials: string;
  avatarUrl?: string;
  /** The @handle under the name in the rail's account block. */
  handle?: string;
}

export interface FlatShellProps {
  navItems: FlatShellNavItem[];
  activeKey: string;
  onNavClick: (item: FlatShellNavItem) => void;
  user: FlatShellUser | null;
  onSignIn: () => void;
  onJoin: () => void;
  /** Called when the user picks "Sign out" from the "..." menu. */
  onUserMenu: () => void;
  onLogoClick: () => void;
  /**
   * The right-hand slot. RC-P06: nothing but the legacy editor's workspace on
   * /upload/blueprint fills it, and only in standard mode; RC-P08b removes it.
   */
  rightRail: ReactNode;
  children: ReactNode;
  isMobile: boolean;
  /** Optional slot rendered above the user block (e.g. the XP progress chip). */
  beforeUserSlot?: ReactNode;
  /**
   * BG-P18b. The theme control, at the very bottom of the left rail.
   *
   * A SLOT OF ITS OWN RATHER THAN `beforeUserSlot`, because the order is the
   * decision. BG-P02 mounted the toggle in the slot above the account block,
   * which put a setting between the nav and the one thing a signed-out rail is
   * for. A theme is a setting, not a call to action: it sits last, under the
   * account block, and this is the slot that says so.
   */
  themeControl?: ReactNode;
  /** Hide the left rail (blueprint editor on small desktops). */
  hideLeftRail?: boolean;
  /** Keep the editor workspace slot visible on tablet (/upload/blueprint). */
  forceRightRail?: boolean;
  /**
   * BG-P14. Which of the frame's two layout modes to render.
   *
   * `"standard"` (the default) is the nav beside a 634px reading column in a
   * frame capped at 1200px. `"wide"` opens the frame to 1600px and lets the
   * centre take whatever the nav leaves, for the surfaces that need a grid
   * rather than a measure.
   *
   * THIS IS DECIDED BY THE ROUTE TABLE, NOT BY THE PAGE. `AppShell` reads
   * `WIDE_ROUTES` and threads the answer down here, exactly as it threads
   * `hideLeftRail`; a page component never sets it.
   */
  layout?: "standard" | "wide";
}

export function FlatShell({
  navItems,
  activeKey,
  onNavClick,
  user,
  onSignIn,
  onJoin,
  onUserMenu,
  onLogoClick,
  rightRail,
  children,
  isMobile,
  beforeUserSlot,
  themeControl,
  hideLeftRail,
  forceRightRail,
  layout = "standard",
}: FlatShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isWide = layout === "wide";

  /* RC-P06. The slot renders only when the container supplied something for
     it, and never in wide mode or on a phone. Today that is the editor's
     workspace on /upload/blueprint and nothing else. */
  const showRightRail = !isMobile && rightRail != null && !isWide;

  // Close the "..." menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <div className={`fs-root${isWide ? " fs-wide" : ""}`} data-layout={layout}>
      <div className="fs-frame">
        {/* ═══ LEFT RAIL ═══ */}
        {!isMobile && !hideLeftRail && (
          <nav className="fs-rail fs-left" aria-label="Primary" data-testid="frame-left">
            <div className="fs-logo" onClick={onLogoClick}>buildgallery</div>
            <ul className="fs-nav-list">
              {navItems.map((item, idx) => (
                <li key={item.key}>
                  {item.divider && idx > 0 && <div className="fs-nav-divider" />}
                  <div
                    className={`fs-nav-item${activeKey === item.key ? " active" : ""}`}
                    onClick={() => onNavClick(item)}
                  >
                    <span className="fs-nav-icon">{item.icon}</span>
                    <span className="fs-nav-label">{item.label}</span>
                    {item.badge && (
                      <span className={`fs-nav-badge${item.badgeMuted ? " muted" : ""}`}>
                        {item.badge}
                      </span>
                    )}
                    {item.dot && !item.badge && <span className="fs-nav-dot" />}
                  </div>
                </li>
              ))}
            </ul>

            {beforeUserSlot}

            {/* ═══ THE ACCOUNT BLOCK, then the theme control, and in that order.
                Signed out the rail showed three nav rows at the top and a theme
                toggle plus two buttons at the bottom with roughly 700px of
                nothing between them — two groups that did not relate, with the
                setting sitting above the sign-up it was competing with. The
                spacer is the nav list's `flex: 1`; what is pinned to the bottom
                is the account block, and 16px under it, last, the setting. ═══ */}
            <div className="fs-user-section" ref={menuRef}>
              {user ? (
                <>
                  <button className="fs-user-btn" onClick={() => setMenuOpen((o) => !o)}>
                    <div className="fs-user-avatar">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.initials}
                    </div>
                    <span className="fs-user-id">
                      <span className="fs-user-name">{user.name}</span>
                      {user.handle ? (
                        <span className="fs-user-handle">@{user.handle}</span>
                      ) : null}
                    </span>
                    <span className="fs-user-dots">⋯</span>
                  </button>
                  {menuOpen && (
                    <div className="fs-user-menu">
                      <button onClick={() => { setMenuOpen(false); onUserMenu(); }}>
                        <LogOut size={14} /> Sign out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Primary first: the rail's one --action fill is the thing a
                   signed-out rail exists for, and it was sitting under the
                   quieter control. */
                <div className="fs-auth-btns">
                  <button className="fs-auth-btn join" onClick={onJoin}>Join free</button>
                  <button className="fs-auth-btn signin" onClick={onSignIn}>Sign in</button>
                </div>
              )}
            </div>

            {themeControl ? (
              <div style={{ marginTop: 16 }}>{themeControl}</div>
            ) : null}
          </nav>
        )}

        {/* ═══ CENTRE COLUMN ═══ */}
        <main className="fs-centre" data-testid="frame-centre">
          <div className="fs-page-body">{children}</div>
        </main>

        {/* ═══ THE EDITOR'S WORKSPACE SLOT — /upload/blueprint only, until RC-P08b ═══ */}
        {showRightRail && (
          <aside
            className={`fs-rail fs-right${forceRightRail ? " fs-right--force" : ""}`}
            aria-label="Editor workspace"
          >
            {rightRail}
          </aside>
        )}
      </div>
    </div>
  );
}

export default FlatShell;
