import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BlockRefNodeView } from '../BlockRefNodeView';

export const BlockRefExtension = Node.create({
  name: 'blockRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      blockId: { default: null },
      stageIndex: { default: '' },
      label: { default: 'Block' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="block-ref"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'block-ref',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockRefNodeView);
  },
});
