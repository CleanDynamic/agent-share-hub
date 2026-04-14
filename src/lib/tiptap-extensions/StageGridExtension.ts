import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { StageGridNodeView } from '../StageGridNodeView';

export const StageGridExtension = Node.create({
  name: 'stageGrid',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      stageGridId: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-stage-grid-id'),
        renderHTML: (attrs: Record<string, any>) => ({
          'data-stage-grid-id': attrs.stageGridId,
        }),
      },
      stageId: {
        default: null,
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-stage-id'),
        renderHTML: (attrs: Record<string, any>) => ({
          'data-stage-id': attrs.stageId,
        }),
      },
      label: {
        default: 'Stage',
        parseHTML: (el: HTMLElement) =>
          el.getAttribute('data-label'),
        renderHTML: (attrs: Record<string, any>) => ({
          'data-label': attrs.label,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="stage-grid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'stage-grid',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StageGridNodeView);
  },

  addCommands() {
    return {
      insertStageGrid:
        (attrs: {
          stageGridId: string;
          stageId: string | null;
          label: string;
        }) =>
        ({ commands }: any) => {
          return commands.insertContent({
            type: 'stageGrid',
            attrs,
          });
        },
    } as any;
  },
});
