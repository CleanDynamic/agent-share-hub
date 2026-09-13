import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import "./flat-shell.css";

/* ────────────────────────────────────────────────
   FlatShell — pure presentational app frame.

   The application's frame, flat and standard-2D. It replaced the
   compositing-heavy NeoScaleShell, which BG-P17 deleted — so this is now
   the only frame, not an alternative to one. Hard rules (see
   flat-shell.css): no SVG filters, no 3D transforms, no scale wrapper,
   and — since BG-P13 — no backdrop-filter at all: both rails are
   full-height fixed panels, which the theme's glass rule never blurs.

   This component knows nothing about routing, auth, or data — the wired
   container (AppShell) supplies everything through props.

   BG-P14 — TWO LAYOUT MODES. `layout="standard"` is the frame every route
   renders today: a 1200px shell around a 600px reading column. `layout="wide"`
   is the same frame with the centre unpinned, for the surfaces that need a
   grid. The mode is one class on the root (`.fs-wide`) and every rule it turns
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
  rightRail: ReactNode;
  children: ReactNode;
  isMobile: boolean;
  /** Optional slot rendered above the user block (e.g. the XP progress chip). */
  beforeUserSlot?: ReactNode;
  /** Hide the left rail (blueprint editor on small desktops). */
  hideLeftRail?: boolean;
  /** Keep the right rail visible on tablet (blueprint editor workspace). */
  forceRightRail?: boolean;
  /**
   * BG-P14. Which of the frame's two layout modes to render.
   *
   * `"standard"` (the default, and what every route renders today) is the
   * 1200px frame with a 600px reading column. `"wide"` opens the frame to
   * 1600px and lets the centre take whatever the rails leave, for the
   * surfaces that need a grid rather than a measure.
   *
   * THIS IS DECIDED BY THE ROUTE TABLE, NOT BY THE PAGE. `AppShell` reads
   * `WIDE_ROUTES` and threads the answer down here, exactly as it threads
   * `hideLeftRail`; a page component never sets it.
   */
  layout?: "standard" | "wide";
  /**
   * BG-P14. Mount the right rail in wide mode. Ignored in standard mode,
   * where the rail's visibility is `rightRail != null` as it always was.
   *
   * Default false — wide mode suppresses the rail unless the route asks. See
   * `WideRoute.rightRail` in wideRoutes.ts for why the default is the quieter
   * answer.
   */
  wideRightRail?: boolean;
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
  hideLeftRail,
  forceRightRail,
  layout = "standard",
  wideRightRail = false,
}: FlatShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isWide = layout === "wide";

  /* The right rail's two modes. Standard is untouched: a rail renders when the
     container supplied one. Wide adds the route's opt-in on top, so a wide
     route that did not ask for the rail does not pay for it in the DOM either
     — the CSS hiding it below 1280 is for the route that DID ask. */
  const showRightRail = !isMobile && rightRail != null && (!isWide || wideRightRail);

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
          <nav className="fs-rail fs-left" aria-label="Primary">
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

            <div className="fs-user-section" ref={menuRef}>
              {user ? (
                <>
                  <button className="fs-user-btn" onClick={() => setMenuOpen((o) => !o)}>
                    <div className="fs-user-avatar">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.initials}
                    </div>
                    <span className="fs-user-name">{user.name}</span>
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
                <div className="fs-auth-btns">
                  <button className="fs-auth-btn signin" onClick={onSignIn}>Sign in</button>
                  <button className="fs-auth-btn join" onClick={onJoin}>Join free</button>
                </div>
              )}
            </div>
          </nav>
        )}

        {/* ═══ CENTRE COLUMN ═══ */}
        <main className="fs-centre">
          <div className="fs-page-body">{children}</div>
        </main>

        {/* ═══ RIGHT RAIL ═══ */}
        {showRightRail && (
          <aside
            className={`fs-rail fs-right${forceRightRail ? " fs-right--force" : ""}`}
            aria-label="Explore"
          >
            {rightRail}
          </aside>
        )}
      </div>
    </div>
  );
}

export default FlatShell;
