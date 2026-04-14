import { Extension } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import {
  SlashCommandMenu,
  type SlashCommandMenuRef,
} from '@/components/SlashCommandMenu';

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      onInsertStageGrid: null as ((label: string) => void) | null,
    };
  },

  addProseMirrorPlugins() {
    const { onInsertStageGrid } = this.options;

    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }: any) => {
          // Delete the slash + query text
          editor.chain().focus().deleteRange(range).run();
        },
        items: ({ query }: { query: string }) => {
          // Return query string — filtering happens in the component
          return [query];
        },
        render: () => {
          let component: ReactRenderer<SlashCommandMenuRef> | null = null;
          let popup: TippyInstance[] | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashCommandMenu, {
                props: {
                  ...props,
                  onInsertStageGrid,
                },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                offset: [0, 4],
              });
            },

            onUpdate: (props: any) => {
              component?.updateProps({
                ...props,
                onInsertStageGrid,
              });

              if (popup && props.clientRect) {
                popup[0]?.setProps({
                  getReferenceClientRect: props.clientRect,
                });
              }
            },

            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});
