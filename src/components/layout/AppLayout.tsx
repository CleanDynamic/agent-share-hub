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
      <div className="min-h-screen bg-background">
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
    <div className="flex h-screen w-full justify-center bg-background">
      <div className="flex h-full w-full max-w-[1280px]">
        <aside
          className="h-screen shrink-0 overflow-y-auto border-r border-border"
          style={{ width: collapsed ? 72 : 275 }}
        >
          <LeftPanel collapsed={collapsed} />
        </aside>

        <main
          className="flex-1 overflow-y-auto"
          style={{
            maxWidth: isMessagesRoute ? undefined : (isTablet ? undefined : 600),
            margin: isMessagesRoute ? undefined : (isTablet ? undefined : "0 auto"),
          }}
        >
          <Outlet />
        </main>

        {!hideRightPanel && (
          <aside className="h-screen shrink-0 overflow-y-auto border-l border-border" style={{ width: 350 }}>
            <RightPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
