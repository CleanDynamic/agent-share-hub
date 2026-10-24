// CA-26 P2 (test only): a menu whose item opens a window, as the tile menus do.

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

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
