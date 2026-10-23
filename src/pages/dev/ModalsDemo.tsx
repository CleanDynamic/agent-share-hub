/* CA-15b - /dev/kit/pages/modals?modal=<name>&theme=noon|dusk&viewport=desktop|mobile.

   Each tile modal open on its own, for the screenshots beside the boards: result, tool, check, code, agent, decision, repo,
   system, dataset, manual and prompt. `modal=tiles` draws a List with one tile of every kind instead. Sample data only:
   nothing is read or written, and Add and Save do nothing. */

import { useSearchParams } from "react-router-dom";

import { useIsPhone } from "@/components/shell/useMinWidth";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";
import { sandboxListProps } from "@/dev/fixtures/sandbox";
import { buildSteps } from "@/lib/build/graph";
import type { NodeTree } from "@/lib/build/types";
import { AddAgentDialog } from "@/pages/site/compose/AddAgentDialog";
import { AddCheckDialog } from "@/pages/site/compose/AddCheckDialog";
import { AddCodeDialog } from "@/pages/site/compose/AddCodeDialog";
import { AddDatasetDialog } from "@/pages/site/compose/AddDatasetDialog";
import { AddDecisionDialog } from "@/pages/site/compose/AddDecisionDialog";
import { AddManualStepDialog } from "@/pages/site/compose/AddManualStepDialog";
import { AddRepoDialog } from "@/pages/site/compose/AddRepoDialog";
import { AddResultDialog } from "@/pages/site/compose/AddResultDialog";
import { AddSystemPromptDialog } from "@/pages/site/compose/AddSystemPromptDialog";
import { AddToolDialog } from "@/pages/site/compose/AddToolDialog";
import { BuildList, type BuildListProps } from "@/pages/site/compose/BuildList";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

let counter = 0;
const node = (type: string, payload: Record<string, unknown>, over: Partial<NodeTree> = {}): NodeTree => {
  counter += 1;
  return { id: `demo-${counter}`, build_id: "demo", type, title: null, note: null, payload, position: counter, parent_id: null, source_ref: null, event_id: null, is_gap: false, created_at: "2026-10-07T09:00:00Z", children: [], ...over } as unknown as NodeTree;
};

const CODE = ["import { Extension } from \"@tiptap/core\";", "", "export const Shortcuts = Extension.create({", "  name: \"shortcuts\",", "  addKeyboardShortcuts() {", "    return {", "      \"Mod-Enter\": () => this.editor.commands.blur(),", "      \"Mod-k\": () => this.editor.commands.toggleLink(),", "    };", "  },", "});", ""].join("\n");

/** One tile of every kind the boards draw, holding what they show. */
const TILES: NodeTree[] = [
  node("prompt", { text: "Create 10 detailed implementation prompts (UI-P42 to UI-P51) for the composer, one per screen, each with its acceptance checks.", reply: "Created comprehensive implementation prompts for Wave 6: UI-P42 to UI-P51." }),
  node("result", { summary: "The order screen", url: "https://shop.example.com/order", kind: "deployed" }),
  node("integration", { step: true, service: "Gmail", connection: "mcp", scopes: "Read the inbox, drafted replies", permissions: "write", plan: "Free" }),
  node("code", { source: CODE, language: "ts", filename: "src/editor/shortcuts.ts", tool: "claude-code" }, { title: "src/editor/shortcuts.ts" }),
  node("eval_run", { tested: "Places a test order for 2 sourdough loaves", passing: "The total shows £9.00", passed: 8, total: 10, run_at: "2026-10-12", cases: [{ input: "2 loaves", expected: "£9.00", actual: "£9.00", passed: true }, { input: "1 loaf", expected: "£4.50", actual: "£4.50", passed: true }, { input: "0", expected: "£0.00", actual: "£0.00", passed: true }] }, { title: "Places a test order for 2 sourdough loaves" }),
  node("document", { step: true, title: "menu-photos.zip", size: 2_200_000 }),
  node("manual_step", { text: "Open the stock sheet\nMark the sold-out loaves\nExport the sheet as CSV\nUpload it to the shared drive", tool: "Google Sheets" }, { title: "Update the stock sheet" }),
  node("system_prompt", { step: true, text: "You write for {company name} in plain British English, and never use buzzwords.", scope: "all" }, { title: "House voice" }),
  node("agent_config", { system_prompt: "Every Monday, write this week's menu from what is in stock.", model: "Sonnet 5.5", runs: { how: "event", detail: "a new row is added to the stock sheet" }, helpers: [{ provider: "scaledown", job: "summarize" }] }, { title: "Weekly menu writer" }),
  node("decision", { provider: "typesafe-jev", model: "jev-1.13.0", via: "api", questions: [{ id: "team", type: "choice", instructions: "Which team?", options: [{ key: "billing" }, { key: "delivery" }, { key: "account" }] }], answer: { team: { value: "billing", sure: 92 } } }, { title: "Route the message" }),
  node("repo", { step: true, url: "github.com/ueberdosis/tiptap", ownership: "third_party", description: "Rich text editor the composer is built on. Its keyboard shortcut extension was used.", usage: ["dependency", "docs"], language: "TypeScript", licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", author: "ueberdosis" }),
  node("dataset", { step: true, description: "Rated answers", use: "evaluation", format: "CSV", columns: ["input", "expected", "actual", "score"] }, { title: "Evaluation set" }),
];

const PROMPT = node("prompt", { text: "Create 10 detailed implementation prompts (UI-P42 to UI-P51) for the composer, one per screen, each with its acceptance checks and the board it must match.", reply: "Created comprehensive implementation prompts for Wave 6: UI-P42 to UI-P51." }, { title: "Create 10 detailed implementation prompts (UI-P42 to UI-P51)" });

export default function ModalsDemo(_: DesignPageProps) {
  const [params] = useSearchParams();
  const modal = params.get("modal") ?? "tool";
  const open = { open: true, onOpenChange: noop } as const;
  const phone = useIsPhone();

  if (modal === "tiles") {
    const base = sandboxListProps("bakery");
    const props = { ...base, phone, steps: buildSteps(TILES), dividers: new Map(), results: [], onSelect: noop, onRename: noop, onMove: noop, onRemove: noop, onAccept: noop, onDismiss: noop, onOpenPrompt: noop } as unknown as BuildListProps;
    return (
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", boxSizing: "border-box", minWidth: 0 }}>
        <BuildList {...props} />
      </div>
    );
  }
  if (modal === "result") return <AddResultDialog {...open} onAdd={noop} />;
  if (modal === "tool") return <AddToolDialog {...open} onAdd={noop} />;
  if (modal === "check") return <AddCheckDialog {...open} onAdd={noop} />;
  if (modal === "code") return <AddCodeDialog {...open} onAdd={noop} seed={CODE} />;
  if (modal === "agent") return <AddAgentDialog {...open} onAdd={noop} nextNumber={4} teamsAvailable />;
  if (modal === "decision") return <AddDecisionDialog {...open} onAdd={noop} codeTiles={[]} stepChoices={[]} />;
  if (modal === "repo") return <AddRepoDialog {...open} onAdd={noop} fetchRepo={() => Promise.resolve({ language: "TypeScript", licenceSpdx: "MIT", licenceName: "MIT License", pushedAt: "2026-10-01T00:00:00Z", stars: 30_000, fetchedAt: "2026-10-22T00:00:00Z" } as never)} />;
  if (modal === "system") return <AddSystemPromptDialog {...open} onAdd={noop} prompts={[{ id: "p1", label: "1 Create the prompts" }]} session="s1" />;
  if (modal === "dataset") return <AddDatasetDialog {...open} onAdd={noop} />;
  if (modal === "manual") return <AddManualStepDialog {...open} onAdd={noop} after="3 · Fix the mobile layout" available />;
  if (modal === "prompt") return <FullPromptWindow steps={buildSteps([PROMPT])} openId={PROMPT.id} mode="maker" onTitle={noop} onReply={noop} onExtras={noop} onText={noop} onClose={noop} />;
  return <div>Unknown modal</div>;
}
