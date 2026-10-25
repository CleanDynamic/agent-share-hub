// CA-26 P2 (test only): menus whose items open a window or remove their own button, as the tile menus do.

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

import { MenuContent } from "./ComposeMenu";
import { SmallWindow } from "./removePieces";

export default function Menus() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Menu.Root>
        <Menu.Trigger asChild>
          <button type="button">Menu</button>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content>
            <Menu.Item onSelect={() => setOpen(true)}>Remove</Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <SmallWindow open={open} onClose={() => setOpen(false)} title="Remove it?" testId="remove" buttons={<button type="button">Cancel</button>} />
    </>
  );
}

/** A list of two rows, each with its own menu; "Remove row" takes the row (and so the menu's button) away. */
export function RowMenus() {
  const [rows, setRows] = useState(["a", "b", "c"]);
  return (
    <div data-testid="build-list">
      {rows.map((row) => (
        <div key={row} data-testid="step-card" data-node-id={row} tabIndex={0} aria-label={`Prompt ${row}`}>
          <Menu.Root>
            <Menu.Trigger asChild>
              <button type="button">{`Row ${row} options`}</button>
            </Menu.Trigger>
            <Menu.Portal>
              <MenuContent>
                <Menu.Item onSelect={() => setRows((now) => now.filter((each) => each !== row))}>Remove row</Menu.Item>
              </MenuContent>
            </Menu.Portal>
          </Menu.Root>
        </div>
      ))}
    </div>
  );
}

/** A menu inside a window: Escape should close the menu, then the window. */
export function MenuInWindow({ onClose }: { onClose: () => void }) {
  return (
    <SmallWindow open onClose={onClose} title="Inside" testId="inside" buttons={<button type="button">Fine</button>}>
      <Menu.Root>
        <Menu.Trigger asChild>
          <button type="button">Pick</button>
        </Menu.Trigger>
        <Menu.Portal>
          <MenuContent>
            <Menu.Item>One</Menu.Item>
          </MenuContent>
        </Menu.Portal>
      </Menu.Root>
    </SmallWindow>
  );
}
