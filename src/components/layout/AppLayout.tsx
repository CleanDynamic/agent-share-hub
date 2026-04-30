import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { MobileNav } from "./MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import { BlobBackground } from "@/components/BlobBackground";

export function AppLayout() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMessagesRoute = location.pathname === "/messages" || location.pathname.startsWith("/messages/");
  const isMessagesThread = isMessagesRoute && (searchParams.has("thread") || searchParams.has("recipient") || location.pathname.startsWith("/messages/"));

  if (isMobile) {
    return (
      <div className="min-h-screen" style={{ background: "#08080C" }}>
        <MobileNav />
        <main
          className="overflow-y-auto"
          style={{
            paddingTop: isMessagesThread ? 0 : 56,
            paddingBottom: isMessagesRoute ? 0 : "calc(56px + env(safe-area-inset-bottom))",
          }}
        >
          <Outlet />
        </main>
      </div>
    );
  }

  const collapsed = isTablet;
  const hideRightPanel = isTablet || isMessagesRoute;

  return (
    <div className="flex h-screen w-full justify-center" style={{ background: 'var(--bg)' }}>
      <div className="relative flex h-full w-full max-w-[1280px]" style={{ zIndex: 1 }}>
        <BlobBackground />

        <aside
          className="self-center shrink-0 overflow-y-auto"
          data-visual-slot="left-panel"
          style={{ width: collapsed ? 72 : 240, borderRight: '1px solid var(--border)' }}
        >
          <LeftPanel collapsed={collapsed} />
        </aside>

        <main
          className="flex-1 overflow-y-auto"
          data-visual-slot="centre-panel"
          style={{
            maxWidth: isMessagesRoute ? undefined : (isTablet ? undefined : 660),
            margin: isMessagesRoute ? undefined : (isTablet ? undefined : '0 auto'),
          }}
        >
          <Outlet />
        </main>

        {!hideRightPanel && (
          <aside
            className="h-screen shrink-0 overflow-y-auto"
            data-visual-slot="right-panel"
            style={{ width: 350, borderLeft: '1px solid var(--border)' }}
          >
            <RightPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
