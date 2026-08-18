import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import "./flat-shell.css";

/* ────────────────────────────────────────────────
   FlatShell — pure presentational app frame.

   A flat, standard-2D replacement for NeoScaleShell's compositing-heavy
   frame. Hard rules (see flat-shell.css): no SVG filters, no 3D
   transforms, no scale wrapper; backdrop-filter only on the two rails.

   This component knows nothing about routing, auth, or data — the wired
   container (AppShell) supplies everything through props.
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
}: FlatShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className="fs-root">
      <div className="fs-frame">
        {/* ═══ LEFT RAIL ═══ */}
        {!isMobile && !hideLeftRail && (
          <nav className="fs-rail fs-left" aria-label="Primary">
            <div className="fs-logo" onClick={onLogoClick}>NeoScale</div>
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
        {!isMobile && rightRail != null && (
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
