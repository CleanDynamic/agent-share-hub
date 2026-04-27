import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface TableContextMenuProps {
  editor: Editor | null;
  children: React.ReactNode;
}

export function TableContextMenu({ editor, children }: TableContextMenuProps) {
  const [inTable, setInTable] = React.useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editor) return;
    const target = e.target as HTMLElement;
    const isTable = !!target.closest('table');
    setInTable(isTable);
    if (isTable) {
      const view = editor.view;
      const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (pos) {
        const $pos = editor.state.doc.resolve(pos.pos);
        const tr = editor.state.tr.setSelection(TextSelection.near($pos));
        view.dispatch(tr);
      }
    }
  };

  if (!editor) return <>{children}</>;

  const run = (cmd: () => void) => () => {
    cmd();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onContextMenu={handleContextMenu}>
        <div>{children}</div>
      </ContextMenuTrigger>
      {inTable ? (
        <ContextMenuContent className="w-56">
          <ContextMenuItem onSelect={run(() => editor.chain().focus().addRowBefore().run())}>
            Add row above
          </ContextMenuItem>
          <ContextMenuItem onSelect={run(() => editor.chain().focus().addRowAfter().run())}>
            Add row below
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={run(() => editor.chain().focus().addColumnBefore().run())}>
            Add column left
          </ContextMenuItem>
          <ContextMenuItem onSelect={run(() => editor.chain().focus().addColumnAfter().run())}>
            Add column right
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={run(() => editor.chain().focus().deleteRow().run())}
            className="text-destructive focus:text-destructive"
          >
            Delete row
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={run(() => editor.chain().focus().deleteColumn().run())}
            className="text-destructive focus:text-destructive"
          >
            Delete column
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={run(() => editor.chain().focus().deleteTable().run())}
            className="text-destructive focus:text-destructive"
          >
            Delete table
          </ContextMenuItem>
        </ContextMenuContent>
      ) : (
        <ContextMenuContent className="hidden" />
      )}
    </ContextMenu>
  );
}
