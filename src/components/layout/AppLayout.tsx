import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { MobileNav } from "./MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";

export function AppLayout() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isMessagesRoute = location.pathname === "/messages";
  const isMessagesThread = isMessagesRoute && (searchParams.has("thread") || searchParams.has("recipient"));

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
    <div className="flex h-screen w-full justify-center" style={{ background: "#08080C" }}>
      <div className="flex h-full w-full max-w-[1280px]">
        <aside
          className="ns-panel-left h-screen shrink-0 overflow-y-auto"
          style={{
            width: collapsed ? 72 : 275,
            boxShadow: "0 0 50px rgba(46,196,182,0.08)",
          }}
        >
          <LeftPanel collapsed={collapsed} />
        </aside>

        <main
          className="ns-panel-centre flex-1 overflow-y-auto"
          style={{
            maxWidth: isMessagesRoute ? undefined : (isTablet ? undefined : 660),
            margin: isMessagesRoute ? undefined : (isTablet ? undefined : "0 auto"),
          }}
        >
          <Outlet />
        </main>

        {!hideRightPanel && (
          <aside className="ns-panel-right h-screen shrink-0 overflow-y-auto" style={{ width: 350 }}>
            <RightPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
