/* SV-28 P7 and P8: Show setup prompt. The setup prompt of an agent or a team, read-only, with its character count and the same copy
   action as the menu's. "Rebuild in" (hidden for a vendor-hosted agent) lists the harnesses whose documentation was read
   (`harnessMap.ts`), starting at the agent's own; what has no documented equivalent there is listed above the text under
   "Doesn't carry over". Built from `modalRecipes.tsx`. Shared by the composer and the build page; its own chunk. */

import { useState } from "react";

import { useIsPhone } from "@/components/shell/useMinWidth";
import { REBUILD_COPY, harnessEntry, mappedHarnesses } from "@/lib/build/harnessMap";
import { SETUP_PROMPT_COPY, isVendorHosted, setupPromptOf } from "@/lib/build/setupPrompt";
import type { NodeTree } from "@/lib/build/types";
import { t } from "@/lib/theme/tokens";
import { DM_MONO } from "@/lib/theme/type";

import { ModalShell } from "./ModalFrame";
import { FOOT_NOTE, LABEL, RecipeButton, bodyStyle, footerStyle } from "./modalRecipes";
import { PickMenu } from "./PickMenu";

const OWN = "own";

export interface SetupPromptWindowProps {
  /** The agent or team it is for; null keeps the window closed. */
  id: string | null;
  tree: readonly NodeTree[];
  /** Its title, for the window's subtitle. */
  name?: string;
  onCopy: (text: string) => void;
  onClose: () => void;
  /** Rebuild in starts at this harness rather than the agent's own (a dev page's screens). */
  harness?: string;
}

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const flat = (nodes: readonly NodeTree[]): NodeTree[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);

/** The harness an agent or team says it runs in: its own, or its first agent's. */
export function ownHarnessOf(tree: readonly NodeTree[], id: string): string {
  const all = flat(tree);
  const node = all.find((entry) => entry.id === id);
  const lead = node?.type === "team" ? all.filter((entry) => entry.parent_id === id && entry.type === "agent_config").sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0] : node;
  const harness = record(lead?.payload).harness;
  return typeof harness === "string" ? harness : "";
}

export function SetupPromptWindow({ id, tree, name, onCopy, onClose, harness }: SetupPromptWindowProps) {
  const phone = useIsPhone();
  const own = id ? ownHarnessOf(tree, id) : "";
  const [target, setTarget] = useState<string>(() => harnessEntry(harness ?? own)?.harness ?? OWN);
  if (!id) return null;
  const prompt = setupPromptOf(id, { tree: tree as NodeTree[] }, target === OWN ? undefined : target);
  const vendor = isVendorHosted(own);
  return (
    <ModalShell open onOpenChange={(next) => !next && onClose()} title={SETUP_PROMPT_COPY.title} subtitle={name ?? flat(tree).find((node) => node.id === id)?.title ?? SETUP_PROMPT_COPY.title} testId="setup-prompt-window">
      <div style={{ ...bodyStyle(phone), display: "flex", flexDirection: "column", gap: 12, padding: 20 }}>
        {vendor ? null : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span id="setup-prompt-rebuild" style={LABEL}>
              {REBUILD_COPY.label}
            </span>
            <PickMenu<string>
              label={REBUILD_COPY.label}
              options={[{ value: OWN, label: "As the maker set it up" }, ...mappedHarnesses().map((entry) => ({ value: entry.harness, label: entry.name }))]}
              value={target}
              phone={phone}
              onChange={setTarget}
            />
          </div>
        )}
        {prompt.notCarried.length > 0 ? (
          <section aria-label={REBUILD_COPY.notCarried} data-testid="setup-not-carried" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h3 style={{ ...LABEL, margin: 0 }}>{REBUILD_COPY.notCarried}</h3>
            {prompt.notCarried.map((line) => (
              <p key={line} style={{ margin: 0, fontSize: 12.5, lineHeight: "18px", color: t.text2 }}>
                {line}
              </p>
            ))}
          </section>
        ) : null}
        <pre data-testid="setup-prompt-text" tabIndex={0} aria-label={SETUP_PROMPT_COPY.title} style={{ margin: 0, padding: 12, maxHeight: phone ? "50vh" : 420, overflow: "auto", whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontFamily: DM_MONO, fontSize: 12, lineHeight: "18px", color: t.text, background: t.well, border: `1px solid ${t.wellBorder}`, borderRadius: 6 }}>
          {prompt.text}
        </pre>
      </div>
      <div style={footerStyle(phone)}>
        <span data-testid="setup-prompt-count" style={{ ...FOOT_NOTE, fontVariantNumeric: "tabular-nums" }}>
          {SETUP_PROMPT_COPY.characters(prompt.text.length)}
        </span>
        <RecipeButton variant="primary" small={!phone} phone={phone} onClick={() => onCopy(prompt.text)}>
          {SETUP_PROMPT_COPY.copy}
        </RecipeButton>
      </div>
    </ModalShell>
  );
}

export default SetupPromptWindow;
