import { useLocation } from "react-router-dom";

import { RightPanelExplore } from "./RightPanelExplore";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useDocumentStore } from "@/lib/documentStore";

export function RightPanel() {
  const location = useLocation();
  const focusMode = useDocumentStore((s) => s.focusMode);

  const isEditorPage = location.pathname === "/upload";
  const showWorkspace = isEditorPage && focusMode === "edit";

  if (showWorkspace) {
    return <WorkspaceShell />;
  }

  return <RightPanelExplore />;
}
