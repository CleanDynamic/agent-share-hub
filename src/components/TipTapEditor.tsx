import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlock from '@tiptap/extension-code-block';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Link from '@tiptap/extension-link';
import { StageGridExtension } from '@/lib/tiptap-extensions/StageGridExtension';
import { BlockRefExtension } from '@/lib/tiptap-extensions/BlockRefExtension';
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ArticleDocument } from '@/lib/article-types';
import { SlashCommandMenu, SlashCommandMenuRef } from './SlashCommandMenu';
import { ArticleFormatToolbar } from './ArticleFormatToolbar';

interface TipTapEditorProps {
  contentId: string | null;
  initialContent: ArticleDocument | null;
  mode: 'edit' | 'view';
  onContentChange?: (doc: ArticleDocument) => void;
  onStageGridInsert?: (stageGridId: string) => void;
  availableBlocks?: Array<{
    id: string;
    stageIndex: string;
    label: string;
    type: string;
  }>;
}

const QUICK_INSERT_ITEMS = [
  { emoji: '⊞', label: 'Stage Grid', id: 'stage' },
  { emoji: 'H', label: 'Heading', id: 'h2' },
  { emoji: '{ }', label: 'Code', id: 'code' },
  { emoji: '🖼', label: 'Image', id: 'image' },
  { emoji: '•', label: 'List', id: 'bulletlist' },
];

export function TipTapEditor({
  contentId,
  initialContent,
  mode,
  onContentChange,
  onStageGridInsert,
  availableBlocks = [],
}: TipTapEditorProps) {
  const [slashMenuPos, setSlashMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [slashFilter, setSlashFilter] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const slashMenuRef = useRef<SlashCommandMenuRef>(null);

  const handleInsertStageGrid = useCallback(
    async (label: string) => {
      if (!contentId) return;
      const stageGridId = crypto.randomUUID();
      const { data: stageData } = await (supabase as any)
        .from('canvas_stages')
        .insert({
          id: stageGridId,
          content_id: contentId,
          stage_number: 1,
          title: label,
          block_ids: [],
          colour: 'rgba(139,69,19,0.06)',
        })
        .select()
        .single();

      await (supabase as any).from('article_stage_grids').insert({
        id: stageGridId,
        content_id: contentId,
        stage_id: stageData?.id ?? stageGridId,
        article_node_index: 0,
        label,
      });

      editor
        ?.chain()
        .focus()
        .insertContent({
          type: 'stageGrid',
          attrs: {
            stageGridId,
            stageId: stageData?.id ?? stageGridId,
            label,
          },
        })
        .run();

      onStageGridInsert?.(stageGridId);
      setSlashMenuPos(null);
    },
    [contentId, onStageGridInsert]
  );

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'heading') return 'Heading...';
            return 'Write your article... press / to insert a stage grid, heading, or media';
          },
          showOnlyCurrent: true,
          showOnlyWhenEditable: true,
        }),
        CodeBlock.configure({ languageClassPrefix: 'language-' }),
        Image.configure({ inline: false, allowBase64: true }),
        HorizontalRule,
        Highlight,
        Typography,
        Link.configure({ openOnClick: mode === 'view', autolink: true }),
        StageGridExtension,
        BlockRefExtension,
      ],
      content: initialContent ?? {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      },
      editable: mode === 'edit',
      onUpdate: ({ editor: ed }) => {
        const json = ed.getJSON();
        onContentChange?.(json as ArticleDocument);
      },
      editorProps: {
        handleKeyDown: (view, event) => {
          if (slashMenuPos && slashMenuRef.current) {
            const handled = slashMenuRef.current.onKeyDown({ event });
            if (handled) return true;
          }
          if (event.key === '/' && mode === 'edit') {
            const { $from } = view.state.selection;
            const isEmptyLine = $from.parent.textContent === '';
            if (isEmptyLine) {
              const domPos = view.coordsAtPos($from.pos);
              const containerRect = containerRef.current?.getBoundingClientRect();
              if (containerRect) {
                setSlashMenuPos({
                  top: domPos.bottom - containerRect.top,
                  left: domPos.left - containerRect.left,
                });
                setSlashFilter('');
              }
              return false;
            }
          }
          if (event.key === 'Escape' && slashMenuPos) {
            setSlashMenuPos(null);
            return true;
          }
          return false;
        },
      },
    },
    [mode]
  );

  useEffect(() => {
    if (!editor || !initialContent) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(initialContent);
    if (current !== incoming) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent]);

  const handleSlashCommand = useCallback(
    (_props: { id: string }) => {
      if (!editor) return;
      const { state } = editor;
      const { $from } = state.selection;
      const textBefore = $from.parent.textContent;
      if (textBefore.startsWith('/')) {
        const start = $from.start();
        editor
          .chain()
          .focus()
          .deleteRange({ from: start, to: start + textBefore.length })
          .run();
      }
      setSlashMenuPos(null);
    },
    [editor]
  );

  // Check if editor is empty
  const editorJson = editor?.getJSON();
  const isEmptyArticle = !editorJson ||
    (editorJson.content?.length === 1 &&
     editorJson.content[0].type === 'paragraph' &&
     !editorJson.content[0].content?.length);

  // Quick insert handler — triggers slash command actions directly
  const handleQuickInsert = useCallback((id: string) => {
    if (!editor) return;
    editor.chain().focus().run();

    if (id === 'stage') {
      handleInsertStageGrid('Stage');
      return;
    }
    if (id === 'h2') {
      editor.chain().focus().setHeading({ level: 2 }).run();
      return;
    }
    if (id === 'code') {
      editor.chain().focus().setCodeBlock().run();
      return;
    }
    if (id === 'image') {
      const url = window.prompt('Paste image or video URL:');
      if (!url) return;
      const isVideo = /\.(mp4|webm|mov|ogg)$/i.test(url);
      if (isVideo) {
        editor.chain().focus().insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text: `[video: ${url}]` }],
        }).run();
      } else {
        editor.chain().focus().setImage({ src: url }).run();
      }
      return;
    }
    if (id === 'bulletlist') {
      editor.chain().focus().toggleBulletList().run();
      return;
    }
  }, [editor, handleInsertStageGrid]);

  // Article structure stats
  const structureStats = useMemo(() => {
    if (!editorJson?.content) return null;
    let paragraphs = 0, headings = 0, stages = 0, codeBlocks = 0, images = 0;
    for (const node of editorJson.content) {
      if (node.type === 'paragraph' && node.content?.length) paragraphs++;
      if (node.type === 'heading') headings++;
      if (node.type === 'stageGrid') stages++;
      if (node.type === 'codeBlock') codeBlocks++;
      if (node.type === 'image') images++;
    }
    const total = paragraphs + headings + stages + codeBlocks + images;
    if (total === 0) return null;
    const parts: string[] = [];
    if (paragraphs) parts.push(`${paragraphs}¶`);
    if (headings) parts.push(`${headings}H`);
    if (stages) parts.push(`${stages}⊞`);
    if (codeBlocks) parts.push(`${codeBlocks}{ }`);
    if (images) parts.push(`${images}🖼`);
    return parts.join('  ');
  }, [editorJson]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Left guide line */}
      {mode === 'edit' && (
        <div style={{
          position: 'absolute', left: -16, top: 0, bottom: 0,
          width: 2, background: 'rgba(255,255,255,0.03)',
          borderRadius: 1,
        }} />
      )}

      {/* The TipTap editor */}
      <EditorContent editor={editor} style={{ outline: 'none' }} />

      {/* Empty state — quick insert buttons */}
      {isEmptyArticle && mode === 'edit' && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '32px 0 16px 0', gap: 16,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.20)',
            fontFamily: 'Inter, sans-serif',
          }}>
            Start writing above, or insert:
          </div>
          <div style={{
            display: 'flex', gap: 8, flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {QUICK_INSERT_ITEMS.map(item => (
              <button
                key={item.id}
                onClick={() => handleQuickInsert(item.id)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 9999,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(232,87,26,0.10)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,87,26,0.25)';
                  (e.currentTarget as HTMLElement).style.color = '#E8571A';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                }}
              >
                <span style={{
                  fontSize: item.emoji.length === 1 && item.emoji.charCodeAt(0) > 255 ? 14 : 11,
                  fontWeight: 700, fontFamily: 'monospace',
                }}>
                  {item.emoji}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Structure stats bar */}
      {structureStats && mode === 'edit' && (
        <div style={{
          marginTop: 12, padding: '6px 0',
          fontSize: 10, color: 'rgba(255,255,255,0.18)',
          fontFamily: 'monospace', letterSpacing: '0.05em',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}>
          {structureStats}
        </div>
      )}

      {/* Floating format toolbar (BubbleMenu) */}
      {mode === 'edit' && editor && (
        <ArticleFormatToolbar
          editor={editor}
          availableBlocks={availableBlocks}
        />
      )}

      {/* Slash command menu */}
      {slashMenuPos && mode === 'edit' && editor && (
        <div style={{
          position: 'absolute',
          top: slashMenuPos.top,
          left: slashMenuPos.left,
          zIndex: 50,
        }}>
          <SlashCommandMenu
            ref={slashMenuRef}
            editor={editor}
            query={slashFilter}
            command={handleSlashCommand}
            onInsertStageGrid={(label) => {
              handleInsertStageGrid(label);
              setSlashMenuPos(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
