/* CA-02 P4 — the model menu, which follows the tool.

   It reads `modelMenu(tool)` and draws one of five things:

   - pick-tool: the menu button, disabled, reading `model`, named "Pick a tool first".
   - options: a Radix menu. Each group is a menu label (the lab's name, 11.5/500, `--label`) over its models; when the
     tool takes a typed model, a last item "Other model…" turns the menu into a 40-character field with Save and
     Cancel. A typed model is saved as typed.
   - tiers: the tool's tiers as items; the tier's name is what is saved ("v0 Max").
   - hidden: no menu; the tool's note in quiet text ("Manus picks its own model").
   - none: nothing.

   Pure but for its own open state. The button keeps the accessible name the composer's model menu always had:
   "model", or "model {name}" once one is chosen. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";
import { harnessTool, modelMenu } from "@/lib/tools/modelRules";
import { t } from "@/lib/theme/tokens";

import { TextButton } from "./composeControls";
import { menuItem, menuSurface, text, wellField } from "./refinedStyles";

/** The longest model name a maker can type. */
export const MODEL_TYPED_MAX = 40;

/** How long the "Model cleared" line stays. */
export const MODEL_CLEARED_MS = 6000;

export const MODEL_PICKER_COPY = {
  model: "model",
  pickToolFirst: "Pick a tool first",
  noModel: "No model",
  other: "Other model…",
  otherField: "Other model",
  otherPlaceholder: "The model's name",
  save: "Save",
  cancel: "Cancel",
  /** The tool changed and does not offer the model that was chosen. */
  cleared: (tool: string, model: string) => `${tool} doesn't offer ${model}. Model cleared.`,
} as const;

export interface ModelPickerProps {
  /** The tool the model is picked for: an id, a typed name, or null. */
  tool: string | null;
  /** The model as saved: a name, a tier, or as typed. */
  value: string | null;
  onChange: (value: string | null) => void;
  phone: boolean;
  /** Offer "No model" first. On by default; an agent's model is required. */
  allowNone?: boolean;
  /** Words before "model" in the accessible name, as "Model 2" for an agent's second row. Absent: "model". */
  name?: string;
  /** Opens the menu now: the Details note's "Change the model" (CA-02 P8). */
  openSignal?: number;
  /** With no tool, offer every current text model and a typed one instead of asking for a tool (Details, where the tool cannot be picked). */
  anyWithoutTool?: boolean;
}

const labelStyle: CSSProperties = { ...text(11.5, 500, t.label), padding: "8px 10px 4px" };

const quiet: CSSProperties = text(12, 400, t.text2);

export function ModelPicker({ tool, value, onChange, phone, allowNone = true, name, openSignal, anyWithoutTool = false }: ModelPickerProps) {
  const menu = modelMenu(anyWithoutTool ? harnessTool(tool) : tool);
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const seen = useRef(openSignal);
  const opens = menu.state === "options" || menu.state === "tiers";

  /* "Change the model" opens the menu once each time it is asked. */
  useEffect(() => {
    if (openSignal === undefined || openSignal === seen.current) return;
    seen.current = openSignal;
    if (opens) setOpen(true);
  }, [openSignal, opens]);

  const word = name ?? MODEL_PICKER_COPY.model;
  const buttonStyle: CSSProperties = { maxWidth: "100%", ...(phone ? { height: 44 } : null) };

  if (menu.state === "none") return null;
  if (menu.state === "hidden") return <span style={quiet}>{menu.note}</span>;
  if (menu.state === "pick-tool") {
    return <MenuButton label={word} value="" disabled aria-label={MODEL_PICKER_COPY.pickToolFirst} style={{ ...buttonStyle, cursor: "default", opacity: 0.6 }} />;
  }

  const openChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setTyping(false);
      setDraft("");
    }
  };

  const save = () => {
    const typed = draft.trim().slice(0, MODEL_TYPED_MAX);
    if (!typed) return;
    onChange(typed);
    openChange(false);
  };

  const item = (key: string, saved: string, label: string = saved) => (
    <Menu.RadioItem key={key} value={saved} style={{ ...menuItem(true, phone), gap: 6 }}>
      <span style={{ width: 14, display: "inline-flex" }}>
        <Menu.ItemIndicator>
          <Glyph name="check" size={14} />
        </Menu.ItemIndicator>
      </span>
      {label}
    </Menu.RadioItem>
  );

  return (
    <Menu.Root open={open} onOpenChange={openChange}>
      <Menu.Trigger asChild>
        <MenuButton label={value ? `${word} ${value}` : word} value="" style={buttonStyle} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          collisionPadding={16}
          style={{ ...menuSurface(), maxHeight: "min(360px, var(--radix-dropdown-menu-content-available-height))", overflowY: "auto" }}
        >
          {typing ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save();
              }}
              style={{ display: "flex", flexDirection: "column", gap: 8, padding: 6, width: 240, maxWidth: "calc(100vw - 48px)" }}
            >
              <input
                autoFocus
                type="text"
                aria-label={MODEL_PICKER_COPY.otherField}
                placeholder={MODEL_PICKER_COPY.otherPlaceholder}
                value={draft}
                maxLength={MODEL_TYPED_MAX}
                autoComplete="off"
                onChange={(event) => setDraft(event.target.value)}
                /* The menu's typeahead and arrow keys must not take the keys typed here. */
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setTyping(false);
                  }
                  event.stopPropagation();
                }}
                style={{ ...wellField, height: phone ? 44 : 32, padding: "0 10px", fontSize: phone ? 16 : 13 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <TextButton onClick={() => setTyping(false)} target={phone} style={text(12.5, 500, t.text2)}>
                  {MODEL_PICKER_COPY.cancel}
                </TextButton>
                <TextButton onClick={save} disabled={!draft.trim()} target={phone} style={text(12.5, 500, draft.trim() ? t.text : t.text2)}>
                  {MODEL_PICKER_COPY.save}
                </TextButton>
              </div>
            </form>
          ) : (
            <>
              <Menu.RadioGroup value={value ?? ""} onValueChange={(next) => onChange(next || null)}>
                {allowNone ? item("none", "", MODEL_PICKER_COPY.noModel) : null}
                {menu.state === "tiers"
                  ? menu.tiers.map((tier) => item(tier, tier))
                  : menu.groups.map((group) => (
                      <Menu.Group key={group.lab}>
                        <Menu.Label style={labelStyle}>{group.lab}</Menu.Label>
                        {group.models.map((version) => item(version.id, version.name))}
                      </Menu.Group>
                    ))}
              </Menu.RadioGroup>
              {menu.state === "options" && menu.other ? (
                <Menu.Item
                  onSelect={(event) => {
                    event.preventDefault();
                    setDraft("");
                    setTyping(true);
                  }}
                  style={{ ...menuItem(true, phone), paddingLeft: 30 }}
                >
                  {MODEL_PICKER_COPY.other}
                </Menu.Item>
              ) : null}
            </>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export default ModelPicker;
