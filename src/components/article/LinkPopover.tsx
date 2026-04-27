import * as React from 'react';
import type { Editor } from '@tiptap/react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from '@floating-ui/react';

interface LinkPopoverProps {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkPopover({ editor, open, onOpenChange }: LinkPopoverProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [url, setUrl] = React.useState('');
  const [newTab, setNewTab] = React.useState(true);
  const hasExisting = !!editor?.isActive('link');

  // Build a virtual reference from the current selection rect
  const virtualRef = React.useMemo(() => {
    if (!editor || !open) return null;
    const { from, to } = editor.state.selection;
    try {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      const left = Math.min(start.left, end.left);
      const right = Math.max(start.right, end.right);
      const top = Math.min(start.top, end.top);
      const bottom = Math.max(start.bottom, end.bottom);
      const rect = {
        x: left,
        y: top,
        width: right - left || 1,
        height: bottom - top || 16,
        left,
        right,
        top,
        bottom,
      };
      return {
        getBoundingClientRect: () => rect as DOMRect,
      };
    } catch {
      return null;
    }
  }, [editor, open]);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: 'top',
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  React.useEffect(() => {
    if (virtualRef) refs.setReference(virtualRef);
  }, [virtualRef, refs]);

  const dismiss = useDismiss(context);
  const { getFloatingProps } = useInteractions([dismiss]);

  // Sync existing link attrs when opening
  React.useEffect(() => {
    if (!open || !editor) return;
    const attrs = editor.getAttributes('link') as {
      href?: string;
      target?: string;
    };
    setUrl(attrs.href ?? '');
    setNewTab(attrs.target === '_blank' || attrs.target === undefined ? true : attrs.target === '_blank');
    // autofocus
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [open, editor]);

  if (!editor || !open) return null;

  const apply = () => {
    const href = url.trim();
    if (!href) return;
    const normalized = /^(https?:|mailto:|tel:|#|\/)/i.test(href) ? href : `https://${href}`;
    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: normalized, target: newTab ? '_blank' : null })
      .run();
    onOpenChange(false);
  };

  const remove = () => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onOpenChange(false);
  };

  return (
    <FloatingPortal>
      <div
        ref={refs.setFloating}
        style={{
          ...floatingStyles,
          zIndex: 200,
          background: 'hsl(240 20% 8% / 0.98)',
          border: '1px solid hsl(var(--foreground) / 0.08)',
          borderRadius: 10,
          boxShadow: '0 8px 24px hsl(240 10% 2% / 0.5)',
          padding: 10,
          width: 300,
          fontFamily: 'Inter, sans-serif',
          color: 'hsl(var(--foreground) / 0.9)',
        }}
        {...getFloatingProps()}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'hsl(var(--foreground) / 0.6)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 6,
          }}
        >
          {hasExisting ? 'Edit link' : 'Add link'}
        </div>

        <input
          ref={inputRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              apply();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onOpenChange(false);
            }
          }}
          placeholder="https://example.com"
          style={{
            width: '100%',
            height: 30,
            borderRadius: 6,
            border: '1px solid hsl(var(--foreground) / 0.1)',
            background: 'hsl(var(--foreground) / 0.03)',
            color: 'hsl(var(--foreground) / 0.95)',
            padding: '0 8px',
            fontSize: 12,
            outline: 'none',
            marginBottom: 8,
          }}
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: 'hsl(var(--foreground) / 0.75)',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <input
            type="checkbox"
            checked={newTab}
            onChange={(e) => setNewTab(e.target.checked)}
            style={{ accentColor: 'hsl(var(--primary, 220 90% 60%))' }}
          />
          Open in new tab
        </label>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {hasExisting ? (
            <button
              type="button"
              onClick={remove}
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 6,
                border: '1px solid hsl(0 70% 50% / 0.4)',
                background: 'transparent',
                color: 'hsl(0 80% 70%)',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          ) : null}
          <button
            type="button"
            onClick={apply}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              border: '1px solid hsl(var(--foreground) / 0.12)',
              background: 'hsl(var(--foreground) / 0.08)',
              color: 'hsl(var(--foreground) / 0.95)',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </FloatingPortal>
  );
}
