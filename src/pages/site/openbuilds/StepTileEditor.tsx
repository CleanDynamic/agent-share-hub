/* UX-06 Part 3: making a step tile inside a reply. PURE: the tile in, its changes out.

   A module box inside the reply box: `Segmented` Prompt and Code, `Saved to Drafts` (12 `--label`) at the top right, a textarea
   (mono for Code), Harness and Model in the words and lists the composer uses (read from `src/lib/`, never the composer's folder),
   and under them the line that says a session or a part is attached from Drafts. */

import type { CSSProperties } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PostControl } from "@/components/post/postControls";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HARNESS_COPY, NO_HARNESS } from "@/lib/build/harnessWords";
import { REPLY_HARNESSES, REPLY_MODELS, type ReplyStepTile } from "@/lib/openbuilds/replyDraft";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { MENU_Z } from "./PostReplies";

/** The composer's word for a session with no model (its session dialog's "Not named"). */
const MODEL_NOT_NAMED = "Not named";

export const ATTACH_FROM_DRAFTS = "To reply with a session or a part, attach it from your drafts.";

const KINDS = [
  { value: "prompt", label: "Prompt" },
  { value: "code", label: "Code" },
] as const;

const fieldBox = (phone: boolean): CSSProperties => ({ boxSizing: "border-box", width: "100%", borderRadius: r.control, border: `1px solid ${t.controlBorder}`, background: t.well, color: t.text, fontSize: phone ? 16 : 13, outline: "none" });

/** A chooser: its label in 12 `--label`, a control naming the choice, and a menu of the options as one radio group. */
function Choice({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  const current = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";
  return (
    <div style={{ flex: "1 1 160px", minWidth: 0 }}>
      <span id={`${id}-label`} style={{ display: "block", fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label, marginBottom: 4 }}>
        {label}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PostControl aria-label={`${label}: ${current}`}>{current}</PostControl>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" aria-labelledby={`${id}-label`} style={{ zIndex: MENU_Z, maxHeight: 320, overflowY: "auto" }}>
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem key={option.value || "none"} value={option.value}>
                {option.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function StepTileEditor({ tile, onChange, idPrefix }: { tile: ReplyStepTile; onChange: (tile: ReplyStepTile) => void; idPrefix: string }) {
  const phone = useIsPhone();
  const area = useInteractive<HTMLTextAreaElement>();
  const code = tile.kind === "code";
  return (
    <section aria-label="Step tile" style={{ background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Segmented label="Step tile kind" items={KINDS} value={tile.kind} onChange={(kind) => onChange({ ...tile, kind: kind as ReplyStepTile["kind"] })} size={28} fontSize={12} />
        <span style={{ fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label }}>Saved to Drafts</span>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-text`}>
          <VisuallyHidden>{code ? "Code" : "Prompt"}</VisuallyHidden>
        </label>
        <textarea
          id={`${idPrefix}-text`}
          rows={4}
          value={tile.text}
          onChange={(event) => onChange({ ...tile, text: event.target.value })}
          placeholder={code ? "The lines you ran" : "What you sent"}
          {...area.handlers}
          style={{ ...fieldBox(phone), minHeight: 88, padding: "8px 12px", fontFamily: code ? DM_MONO : FIGTREE, lineHeight: "20px", resize: "vertical", ...ring(area.state.focusVisible) }}
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Choice id={`${idPrefix}-harness`} label={HARNESS_COPY.label} value={tile.tool ?? ""} options={[{ value: "", label: NO_HARNESS }, ...REPLY_HARNESSES.map((tool) => ({ value: tool.id, label: tool.name }))]} onChange={(value) => onChange({ ...tile, tool: value || null })} />
        <Choice id={`${idPrefix}-model`} label="Model" value={tile.model ?? ""} options={[{ value: "", label: MODEL_NOT_NAMED }, ...REPLY_MODELS.map((model) => ({ value: model.id, label: model.name }))]} onChange={(value) => onChange({ ...tile, model: value || null })} />
      </div>
      <p style={{ margin: 0, fontFamily: FIGTREE, fontSize: 12, lineHeight: "16px", color: t.label }}>{ATTACH_FROM_DRAFTS}</p>
    </section>
  );
}
