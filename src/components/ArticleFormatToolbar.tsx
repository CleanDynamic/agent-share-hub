import { BubbleMenu } from '@tiptap/react/menus';
import { Editor } from '@tiptap/core';
import { useState } from 'react';

interface ArticleFormatToolbarProps {
  editor: Editor | null;
  availableBlocks: Array<{
    id: string; stageIndex: string; label: string;
  }>;
}

export function ArticleFormatToolbar({
  editor, availableBlocks,
}: ArticleFormatToolbarProps) {
  const [showBlockRefPicker, setShowBlockRefPicker] =
    useState(false);
  const [showLinkInput, setShowLinkInput] =
    useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!editor) return null;

  const toolbarButtons = [
    {
      label: 'B',
      title: 'Bold',
      isActive: editor.isActive('bold'),
      onClick: () =>
        editor.chain().focus().toggleBold().run(),
      style: { fontWeight: 700 } as React.CSSProperties,
    },
    {
      label: 'I',
      title: 'Italic',
      isActive: editor.isActive('italic'),
      onClick: () =>
        editor.chain().focus().toggleItalic().run(),
      style: { fontStyle: 'italic' } as React.CSSProperties,
    },
    {
      label: 'S',
      title: 'Strikethrough',
      isActive: editor.isActive('strike'),
      onClick: () =>
        editor.chain().focus().toggleStrike().run(),
      style: { textDecoration: 'line-through' } as React.CSSProperties,
    },
    {
      label: '`',
      title: 'Inline code',
      isActive: editor.isActive('code'),
      onClick: () =>
        editor.chain().focus().toggleCode().run(),
      style: { fontFamily: 'monospace' } as React.CSSProperties,
    },
    {
      label: '==',
      title: 'Highlight',
      isActive: editor.isActive('highlight'),
      onClick: () =>
        editor.chain().focus().toggleHighlight().run(),
      style: {} as React.CSSProperties,
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      options={{
        duration: 100,
        placement: 'top',
        arrow: false,
        theme: 'none',
      }}
      shouldShow={({ editor }: any) => {
        // Only show when text is selected
        // Do NOT show when a stage grid is selected
        const { selection } = editor.state;
        if (selection.empty) return false;
        if (editor.isActive('stageGrid')) return false;
        return true;
      }}
    >
      <div className="tiptap-bubble-menu">
        {/* Inline format buttons */}
        {toolbarButtons.map(btn => (
          <button
            key={btn.label}
            title={btn.title}
            onClick={btn.onClick}
            className={btn.isActive ? 'is-active' : ''}
            style={btn.style}
          >
            {btn.label}
          </button>
        ))}

        {/* Separator */}
        <div style={{
          width: 1, margin: '4px 2px',
          background: 'rgba(255,255,255,0.10)',
        }} />

        {/* Turn into: heading, blockquote */}
        <button
          onClick={() =>
            editor.chain().focus()
              .setHeading({ level: 2 }).run()
          }
          className={
            editor.isActive('heading', { level: 2 })
              ? 'is-active' : ''
          }
        >
          H2
        </button>
        <button
          onClick={() =>
            editor.chain().focus()
              .setHeading({ level: 3 }).run()
          }
          className={
            editor.isActive('heading', { level: 3 })
              ? 'is-active' : ''
          }
        >
          H3
        </button>
        <button
          onClick={() =>
            editor.chain().focus()
              .toggleBlockquote().run()
          }
          className={
            editor.isActive('blockquote')
              ? 'is-active' : ''
          }
        >
          &ldquo;
        </button>

        {/* Separator */}
        <div style={{
          width: 1, margin: '4px 2px',
          background: 'rgba(255,255,255,0.10)',
        }} />

        {/* Link */}
        {!showLinkInput ? (
          <button
            onClick={() => {
              const existing =
                editor.getAttributes('link').href;
              setLinkUrl(existing ?? '');
              setShowLinkInput(true);
            }}
            className={
              editor.isActive('link')
                ? 'is-active' : ''
            }
          >
            Link
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 4,
          }}>
            <input
              autoFocus
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  editor.chain().focus()
                    .setLink({ href: linkUrl }).run();
                  setShowLinkInput(false);
                }
                if (e.key === 'Escape') {
                  setShowLinkInput(false);
                }
              }}
              placeholder="https://..."
              style={{
                width: 160, padding: '2px 6px',
                background: 'rgba(255,255,255,0.08)',
                border:
                  '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                fontSize: 12, color: '#fff',
                outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            {editor.isActive('link') && (
              <button
                onClick={() => {
                  editor.chain().focus()
                    .unsetLink().run();
                  setShowLinkInput(false);
                }}
                style={{ color: '#ef4444' }}
              >
                Remove
              </button>
            )}
          </div>
        )}

        {/* Block ref insertion */}
        {availableBlocks.length > 0 && (
          <>
            <div style={{
              width: 1, margin: '4px 2px',
              background: 'rgba(255,255,255,0.10)',
            }} />
            <div style={{ position: 'relative' }}>
              <button
                onClick={() =>
                  setShowBlockRefPicker(o => !o)
                }
                title="Reference a block"
              >
                ①
              </button>
              {showBlockRefPicker && (
                <div style={{
                  position: 'absolute',
                  top: '100%', left: 0,
                  marginTop: 6, zIndex: 200,
                  background: 'rgba(10,10,16,0.99)',
                  border:
                    '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, padding: '4px 0',
                  minWidth: 200,
                  boxShadow:
                    '0 8px 24px rgba(0,0,0,0.50)',
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.10em',
                    color: 'rgba(255,255,255,0.25)',
                    padding: '4px 10px 6px 10px',
                  }}>
                    Reference a block
                  </div>
                  {availableBlocks.map(block => (
                    <button
                      key={block.id}
                      onClick={() => {
                        editor.chain().focus()
                          .insertContent({
                            type: 'blockRef',
                            attrs: {
                              blockId: block.id,
                              stageIndex:
                                block.stageIndex,
                              label: block.label,
                            },
                          }).run();
                        setShowBlockRefPicker(false);
                      }}
                      style={{
                        display: 'flex', width: '100%',
                        alignItems: 'center', gap: 8,
                        padding: '6px 10px',
                        background: 'none',
                        border: 'none', fontSize: 12,
                        color: 'rgba(255,255,255,0.60)',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: '#E8571A',
                        minWidth: 20,
                        fontFamily: 'monospace',
                      }}>
                        {block.stageIndex}
                      </span>
                      {block.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}
