import { Outlet } from "react-router-dom";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";

export function AppLayout() {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  // Mobile: full-width centre only (mobile nav handled in LAYOUT-3)
  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <main className="min-h-screen overflow-y-auto">
          <Outlet />
        </main>
      </div>
    );
  }

  const collapsed = isTablet;

  return (
    <div className="flex h-screen w-full justify-center bg-background">
      <div className="flex h-full w-full max-w-[1280px]">
        {/* Left Panel */}
        <aside
          className="h-screen shrink-0 overflow-y-auto border-r border-border"
          style={{ width: collapsed ? 72 : 275 }}
        >
          <LeftPanel collapsed={collapsed} />
        </aside>

        {/* Centre Panel */}
        <main className="flex-1 overflow-y-auto" style={{ maxWidth: isTablet ? undefined : 600, margin: isTablet ? undefined : "0 auto" }}>
          <Outlet />
        </main>

        {/* Right Panel — hidden on tablet */}
        {!isTablet && (
          <aside className="h-screen shrink-0 overflow-y-auto border-l border-border" style={{ width: 350 }}>
            <RightPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
