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

  const leftWidth = collapsed ? 72 : 275;

  return (
    <div className="flex h-screen w-full justify-center bg-background">
      <div className="flex h-full w-full max-w-[1280px]">
        {/* LEFT PANEL — frosted glass */}
        <div
          style={{
            width: leftWidth,
            height: "100vh",
            position: "sticky",
            top: 0,
            left: 0,
            zIndex: 10,
            flexShrink: 0,
            overflowY: "auto",
            background: "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.05) 100%)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "inset 1px 0 0 rgba(255,255,255,0.05), 4px 0 24px rgba(0,0,0,0.40)",
          }}
        >
          <LeftPanel collapsed={collapsed} />
        </div>

        {/* CENTRE PANEL — lighter glass, content readable */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            maxWidth: isMessagesRoute ? undefined : (isTablet ? undefined : 600),
            margin: isMessagesRoute ? undefined : (isTablet ? undefined : "0 auto"),
            background: "rgba(10, 10, 15, 0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderLeft: "1px solid rgba(255,255,255,0.04)",
            borderRight: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <Outlet />
        </main>

        {/* RIGHT PANEL — frosted glass mirrored */}
        {!hideRightPanel && (
          <div
            style={{
              width: 350,
              height: "100vh",
              position: "sticky",
              top: 0,
              right: 0,
              zIndex: 10,
              flexShrink: 0,
              overflowY: "auto",
              background: "linear-gradient(200deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.05) 100%)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "inset -1px 0 0 rgba(255,255,255,0.05), -4px 0 24px rgba(0,0,0,0.40)",
            }}
          >
            <RightPanel />
          </div>
        )}
      </div>
    </div>
  );
}
