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
import { useEffect, useRef, useCallback, useState } from 'react';
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
  // Blocks available for BlockRef insertion
  availableBlocks?: Array<{
    id: string;
    stageIndex: string;
    label: string;
    type: string;
  }>;
}

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

  // Handler called when creator inserts a stage grid
  const handleInsertStageGrid = useCallback(
    async (label: string) => {
      if (!contentId) return;

      // Create a new article_stage_grids row
      const stageGridId = crypto.randomUUID();

      // Create the stage in canvas_stages
      const { data: stageData } = await supabase
        .from('canvas_stages')
        .insert({
          id: stageGridId,
          content_id: contentId,
          stage_number: 1,
          title: label,
          block_ids: [],
          colour: 'rgba(232,87,26,0.06)',
        } as any)
        .select()
        .single();

      // Insert into article_stage_grids
      await supabase.from('article_stage_grids').insert({
        id: stageGridId,
        content_id: contentId,
        stage_id: stageData?.id ?? stageGridId,
        article_node_index: 0,
        label,
      } as any);

      // Insert the node into the editor
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
          codeBlock: false, // use our custom CodeBlock
          heading: {
            levels: [1, 2, 3],
          },
        }),
        Placeholder.configure({
          placeholder: ({ node }) => {
            if (node.type.name === 'heading') {
              return 'Heading...';
            }
            return 'Write your article... press / to insert a stage, heading, or media';
          },
          showOnlyCurrent: true,
          showOnlyWhenEditable: true,
        }),
        CodeBlock.configure({
          languageClassPrefix: 'language-',
        }),
        Image.configure({
          inline: false,
          allowBase64: true,
        }),
        HorizontalRule,
        Highlight,
        Typography,
        Link.configure({
          openOnClick: mode === 'view',
          autolink: true,
        }),
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
      // Detect / at empty line for slash commands
      editorProps: {
        handleKeyDown: (view, event) => {
          // Forward keyboard events to slash menu when open
          if (slashMenuPos && slashMenuRef.current) {
            const handled = slashMenuRef.current.onKeyDown({ event });
            if (handled) return true;
          }

          if (event.key === '/' && mode === 'edit') {
            const { $from } = view.state.selection;
            const isEmptyLine = $from.parent.textContent === '';
            if (isEmptyLine) {
              // Position the slash menu
              const domPos = view.coordsAtPos($from.pos);
              const containerRect =
                containerRef.current?.getBoundingClientRect();
              if (containerRect) {
                setSlashMenuPos({
                  top: domPos.bottom - containerRect.top,
                  left: domPos.left - containerRect.left,
                });
                setSlashFilter('');
              }
              return false; // let / appear in editor
            }
          }
          // Escape dismisses slash menu
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

  // Sync content when initialContent changes externally
  useEffect(() => {
    if (!editor || !initialContent) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(initialContent);
    if (current !== incoming) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent]);

  // Command handler: deletes the slash text and dismisses the menu
  const handleSlashCommand = useCallback(
    (_props: { id: string }) => {
      if (!editor) return;
      // Delete the '/' character that triggered the menu
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

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* The TipTap editor */}
      <EditorContent editor={editor} style={{ outline: 'none' }} />

      {/* Floating format toolbar (BubbleMenu) */}
      {mode === 'edit' && editor && (
        <ArticleFormatToolbar
          editor={editor}
          availableBlocks={availableBlocks}
        />
      )}

      {/* Slash command menu */}
      {slashMenuPos && mode === 'edit' && editor && (
        <div
          style={{
            position: 'absolute',
            top: slashMenuPos.top,
            left: slashMenuPos.left,
            zIndex: 50,
          }}
        >
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
