import { SiteFrame } from "@/components/shell/SiteFrame";
import { FrameOutlet } from "@/components/shell/FrameOutlet";

export function AppShell() {
  return (
    <SiteFrame>
      <FrameOutlet />
    </SiteFrame>
  );
}

export default AppShell;
