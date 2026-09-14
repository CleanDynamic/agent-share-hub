import * as React from 'react';
import type { Editor } from '@tiptap/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table as TableIcon } from 'lucide-react';

interface TablePickerPopoverProps {
  editor: Editor | null;
  trigger: React.ReactNode;
}

const MAX = 5;

export function TablePickerPopover({ editor, trigger }: TablePickerPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState<{ r: number; c: number }>({ r: 0, c: 0 });

  React.useEffect(() => {
    if (!open) setHover({ r: 0, c: 0 });
  }, [open]);

  const insert = (rows: number, cols: number) => {
    if (!editor || rows < 1 || cols < 1) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setOpen(false);
  };

  const label =
    hover.r > 0 && hover.c > 0 ? `${hover.r} × ${hover.c}` : 'Pick size';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-3 w-auto"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          boxShadow: '0 8px 24px var(--line)',
          fontFamily: 'Figtree, sans-serif',
          color: 'var(--text)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text2)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}
        >
          Insert table
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${MAX}, 20px)`,
            gridAutoRows: '20px',
            gap: 3,
            marginBottom: 8,
          }}
          onMouseLeave={() => setHover({ r: 0, c: 0 })}
        >
          {Array.from({ length: MAX * MAX }).map((_, i) => {
            const r = Math.floor(i / MAX) + 1;
            const c = (i % MAX) + 1;
            const active = r <= hover.r && c <= hover.c;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setHover({ r, c })}
                onClick={() => insert(r, c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 3,
                  padding: 0,
                  cursor: 'pointer',
                  background: active
                    ? 'var(--recess)'
                    : 'var(--text2)',
                  border: '1px solid var(--line)',
                }}
                aria-label={`${r}×${c}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          disabled={hover.r < 1 || hover.c < 1}
          onClick={() => insert(hover.r, hover.c)}
          style={{
            width: '100%',
            height: 28,
            borderRadius: 6,
            border: '1px solid var(--line)',
            background: 'var(--recess)',
            color: 'var(--text)',
            fontSize: 11,
            fontFamily: 'Figtree, sans-serif',
            cursor: hover.r > 0 ? 'pointer' : 'not-allowed',
            opacity: hover.r > 0 ? 1 : 0.5,
          }}
        >
          Insert {label}
        </button>
      </PopoverContent>
    </Popover>
  );
}

// Re-export the icon so consumers don't double-import
export { TableIcon };
