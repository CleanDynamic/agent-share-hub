import { Outlet, useLocation, useSearchParams } from "react-router-dom";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { MobileNav } from "./MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import LiquidGlass from "liquid-glass-react";

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
        <LiquidGlass
          displacementScale={40}
          blurAmount={0.08}
          saturation={150}
          aberrationIntensity={1.5}
          elasticity={0.2}
          cornerRadius={0}
          style={{
            width: leftWidth,
            height: "100vh",
            position: "sticky",
            top: 0,
            left: 0,
            zIndex: 10,
            flexShrink: 0,
            borderRight: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div style={{ width: leftWidth, height: "100vh", overflowY: "auto" }}>
            <LeftPanel collapsed={collapsed} />
          </div>
        </LiquidGlass>

        <main
          className="flex-1 overflow-y-auto"
          style={{
            maxWidth: isMessagesRoute ? undefined : (isTablet ? undefined : 600),
            margin: isMessagesRoute ? undefined : (isTablet ? undefined : "0 auto"),
            background: "rgba(10, 10, 15, 0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <Outlet />
        </main>

        {!hideRightPanel && (
          <LiquidGlass
            displacementScale={40}
            blurAmount={0.08}
            saturation={150}
            aberrationIntensity={1.5}
            elasticity={0.2}
            cornerRadius={0}
            style={{
              width: 350,
              height: "100vh",
              position: "sticky",
              top: 0,
              right: 0,
              zIndex: 10,
              flexShrink: 0,
              borderLeft: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ width: 350, height: "100vh", overflowY: "auto" }}>
              <RightPanel />
            </div>
          </LiquidGlass>
        )}
      </div>
    </div>
  );
}
