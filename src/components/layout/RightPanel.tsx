import { useLocation } from "react-router-dom";

import { RightPanelExplore } from "./RightPanelExplore";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { useDocumentStore } from "@/lib/documentStore";

export function RightPanel() {
  const location = useLocation();
  const focusMode = useDocumentStore((s) => s.focusMode);
  const editorMode = useDocumentStore((s) => s.editorMode);

  const isEditorPage =
    location.pathname.startsWith("/upload/blueprint") ||
    location.pathname.startsWith("/upload/blog");
  // Blog mode: pure focus writing surface — no right workspace panel.
  const showWorkspace = isEditorPage && focusMode === "edit" && editorMode !== "blog";

  if (showWorkspace) {
    return <WorkspaceShell />;
  }

  return <RightPanelExplore />;
}
