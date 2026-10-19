/* CA-03 P2 — picking one from a short list (a model's role, a code language): the Components table's one drawing.

   `MenuButton` opens a Radix menu on `menuSurface`, its items `menuItem` with a `check` glyph by the chosen one. The
   trigger shows the chosen value alone ("plans", "Python"), or a quiet placeholder when there is none; the field
   label above says what it is, and the accessible name (`label`) carries the rest. Never a native select. */

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState, type CSSProperties } from "react";

import { Glyph } from "@/components/brand/Glyph";
import { MenuButton } from "@/components/brand/MenuButton";

import { FLOATING_Z } from "./ToolPicker";
import { menuItem, menuSurface } from "./refinedStyles";

export interface PickOption<V extends string> {
  value: V;
  /** What the menu and the trigger show; the value when absent. */
  label?: string;
}

export interface PickMenuProps<V extends string> {
  /** The trigger's accessible name: "Role of model 2", "Language". */
  label: string;
  options: readonly PickOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  phone: boolean;
  /** Shown in the trigger while nothing is chosen. */
  placeholder?: string;
  id?: string;
  style?: CSSProperties;
}

export function PickMenu<V extends string>({ label, options, value, onChange, phone, placeholder = "", id, style }: PickMenuProps<V>) {
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === value);
  const shown = chosen ? (chosen.label ?? chosen.value) : "";
  return (
    <Menu.Root open={open} onOpenChange={setOpen}>
      <Menu.Trigger asChild>
        <MenuButton
          id={id}
          aria-label={label}
          label={shown ? "" : placeholder}
          value={shown}
          open={open}
          style={{ maxWidth: "100%", ...(phone ? { height: 44 } : null), ...style }}
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="start"
          sideOffset={4}
          collisionPadding={16}
          style={{ ...menuSurface(), zIndex: FLOATING_Z, maxHeight: "min(360px, var(--radix-dropdown-menu-content-available-height))", overflowY: "auto" }}
        >
          <Menu.RadioGroup value={value ?? ""} onValueChange={(next) => onChange(next as V)}>
            {options.map((option) => (
              <Menu.RadioItem key={option.value} value={option.value} style={{ ...menuItem(true, phone), gap: 6 }}>
                <span style={{ width: 14, display: "inline-flex" }}>
                  <Menu.ItemIndicator>
                    <Glyph name="check" size={14} />
                  </Menu.ItemIndicator>
                </span>
                {option.label ?? option.value}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export default PickMenu;
