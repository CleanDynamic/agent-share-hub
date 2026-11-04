// UX-02 P6: the Add step tile menu opened for a test, with every entry live. Shared by its budget test and its layout test.

import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AddMenu, type AddMenuProps } from "./SandboxView";

/** Every entry live and every handler given. */
export const everyEntry = (): AddMenuProps => ({
  onAddFile: vi.fn(),
  onAddPromptFocus: vi.fn(),
  onAddTool: vi.fn(),
  onAddResult: vi.fn(),
  onAddAgent: vi.fn(),
  onAddDecision: vi.fn(),
  decisionAvailable: true,
  onAddSystemPrompt: vi.fn(),
  onAddDataset: vi.fn(),
  onAddRepo: vi.fn(),
  onAddRetrieval: vi.fn(),
  retrievalAvailable: true,
  systemPromptAvailable: true,
  datasetAvailable: true,
  repoAvailable: true,
  onAddManual: vi.fn(),
  onAddCode: vi.fn(),
  onAddCheck: vi.fn(),
  checkable: true,
  onAddFromLibrary: vi.fn(),
  deploymentLive: () => true,
  onAddDeployment: vi.fn(),
});

export function openAddMenu(props: AddMenuProps) {
  render(<AddMenu phone={false} fixedSession="s1" {...props} />);
  fireEvent.keyDown(screen.getByTestId("add-to-session"), { key: "Enter" });
  return screen.getByRole("menu");
}

