/* UI-P48 — Made with: filled in from the build's sessions, changed in place.

   PURE. Chips in, intentions out.

   THE LINE. "Made with", one chip per session ("Claude Code · Sonnet 5.5",
   deduplicated), "from your sessions.", then "Change". A model the maker left
   out stays on the line, struck through, so the line still says what the
   sessions ran on and Change can bring it back. Whatever was typed by hand
   follows. With no sessions the line offers "+ Add a tool or model", the same
   input as "Other…" under Add model.

   CHANGE opens one toggle per chip that has something to untick: a session's
   model, or an entry typed by hand. A session whose model is not known has
   nothing to untick. While the row is open, an entry unticked keeps its toggle
   (off) so it can be ticked back; "Done" lets it go. */

import * as Popover from "@radix-ui/react-popover";
import { Check } from "lucide-react";
import { useId, useState, type CSSProperties, type FormEvent } from "react";

import { Button } from "@/components/brand/Button";
import { VISUALLY_HIDDEN } from "@/components/brand/VisuallyHidden";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE } from "@/lib/theme/type";

import { TextButton } from "./composeControls";
import { fieldBase } from "./composeFields";
import { MADE_WITH_ENTRY_MAX, type MadeWithChip } from "./composeModel";

export interface MadeWithLineProps {
  phone: boolean;
  chips: readonly MadeWithChip[];
  /** The build has sessions: the line says "from your sessions." and offers no free entry. */
  hasSessions: boolean;
  onToggle: (chip: MadeWithChip, on: boolean) => void;
  /** A tool or model typed by hand. */
  onAdd: (name: string) => void;
}

const floating: CSSProperties = {
  boxSizing: "border-box",
  width: 280,
  maxWidth: "calc(100vw - 32px)",
  padding: 12,
  borderRadius: r.panel,
  background: t.solid,
  border: `1px solid ${t.line}`,
  boxShadow: t.shadowFloat,
  color: t.text,
  zIndex: 50,
};

function Chip({ chip }: { chip: MadeWithChip }) {
  const out = chip.kind === "model" && !chip.on;
  return (
    <span
      data-testid="made-with-chip"
      data-on={chip.on ? "true" : "false"}
      style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text, background: t.cell, borderRadius: r.chip, padding: "2px 8px", whiteSpace: "nowrap" }}
    >
      {out ? (
        <>
          {chip.tool ? `${chip.tool} · ` : null}
          <s style={{ color: t.text2 }}>{chip.model}</s>
          <span style={VISUALLY_HIDDEN}> (left out)</span>
        </>
      ) : (
        chip.label
      )}
    </span>
  );
}

function Toggle({ chip, phone, onToggle }: { chip: MadeWithChip; phone: boolean; onToggle: MadeWithLineProps["onToggle"] }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      aria-pressed={chip.on}
      onClick={() => onToggle(chip, !chip.on)}
      {...handlers}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        height: phone ? 44 : 36,
        padding: "0 12px",
        borderRadius: r.control,
        border: `1px solid ${state.hovered ? t.text2 : t.line}`,
        background: t.field,
        color: t.text,
        fontFamily: FIGTREE,
        fontSize: 13,
        cursor: "pointer",
        boxSizing: "border-box",
        ...ring(state.focusVisible),
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          background: chip.on ? t.text : "transparent",
          border: `1.5px solid ${chip.on ? t.text : t.line}`,
        }}
      >
        {chip.on ? <Check size={12} strokeWidth={2.4} color="var(--field)" /> : null}
      </span>
      {chip.label}
    </button>
  );
}

/** "+ Add a tool or model": the free-text input "Other…" opens, on its own. */
function AddEntry({ phone, onAdd }: { phone: boolean; onAdd: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const id = useId();
  const trigger = useInteractive<HTMLButtonElement>();

  const save = (event: FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    onAdd(value);
    setName("");
    setOpen(false);
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        {...trigger.handlers}
        style={{
          fontFamily: FIGTREE,
          fontSize: 14,
          color: t.text2,
          textDecoration: "underline",
          background: "transparent",
          border: 0,
          padding: 0,
          borderRadius: 6,
          cursor: "pointer",
          ...(phone ? { padding: "12px 4px", margin: "-12px -4px", minHeight: 44 } : null),
          ...ring(trigger.state.focusVisible),
        }}
      >
        + Add a tool or model
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} collisionPadding={16} style={floating}>
          <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label htmlFor={`${id}-name`} style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 600 }}>
              A tool or model
            </label>
            <input
              id={`${id}-name`}
              type="text"
              placeholder="The tool's or model's name"
              value={name}
              maxLength={MADE_WITH_ENTRY_MAX}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
              style={{ ...fieldBase, height: phone ? 44 : 40, padding: "0 10px", fontSize: phone ? 16 : 15 }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" size={phone ? 44 : 36} fontSize={13} disabled={!name.trim()}>
                Add
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function MadeWithLine({ phone, chips, hasSessions, onToggle, onAdd }: MadeWithLineProps) {
  const [open, setOpen] = useState(false);
  /** The chips as they were when Change opened, so an entry unticked keeps its toggle until Done. */
  const [opened, setOpened] = useState<readonly MadeWithChip[]>([]);

  const fromSessions = chips.filter((chip) => chip.kind !== "entry");
  const typed = chips.filter((chip) => chip.kind === "entry");
  const changeable = chips.some((chip) => chip.kind !== "tool");

  const toggles: MadeWithChip[] = (() => {
    const now = chips.filter((chip) => chip.kind !== "tool");
    const gone = opened.filter((chip) => chip.kind === "entry" && !now.some((current) => current.key === chip.key)).map((chip) => ({ ...chip, on: false }));
    return [...now, ...gone];
  })();

  const flip = () => {
    if (!open) setOpened(chips);
    setOpen((value) => !value);
  };

  return (
    <div data-testid="compose-made-with" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 8px", fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
        <span>Made with</span>
        {fromSessions.map((chip) => (
          <Chip key={chip.key} chip={chip} />
        ))}
        {hasSessions ? <span>from your sessions.</span> : null}
        {typed.map((chip) => (
          <Chip key={chip.key} chip={chip} />
        ))}
        {hasSessions ? null : <AddEntry phone={phone} onAdd={onAdd} />}
        {changeable || open ? (
          <TextButton underline target={phone} aria-expanded={open} onClick={flip}>
            {open ? "Done" : "Change"}
          </TextButton>
        ) : null}
      </div>
      {open ? (
        <div role="group" aria-label="What it was made with" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {toggles.map((chip) => (
            <Toggle key={chip.key} chip={chip} phone={phone} onToggle={onToggle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
