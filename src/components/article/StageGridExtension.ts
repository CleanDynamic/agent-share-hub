import { Node, mergeAttributes } from '@tiptap/react';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { StageGridNode } from './StageGridNode';

export const StageGridExtension = Node.create({
  name: 'stageGrid',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      stageId: { default: null },
      stageTitle: { default: 'Untitled Stage' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-stage-grid]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-stage-grid': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StageGridNode);
  },
});
