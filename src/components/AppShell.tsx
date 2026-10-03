import { Outlet } from "react-router-dom";
import { SiteFrame } from "@/components/shell/SiteFrame";

export function AppShell() {
  return (
    <SiteFrame>
      <Outlet />
    </SiteFrame>
  );
}

export default AppShell;
