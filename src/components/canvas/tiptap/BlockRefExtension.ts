import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';
import { BlockRefNode } from './BlockRefNode';

/**
 * BlockRefExtension
 *
 * An inline TipTap node that renders a clickable chip referencing a
 * block in any stage of the current canvas document. Clicking is a
 * no-op for now — scroll-to-block will be wired up in Series I.
 *
 * Node name:   blockRef
 * Group:       inline
 * Attributes:  blockId, blockTitle, blockType, stageId
 */
export const BlockRefExtension = Node.create({
  name: 'blockRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      blockId: { default: '' },
      blockTitle: { default: '' },
      blockType: { default: 'text' },
      stageId: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-block-ref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-block-ref': '' }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockRefNode);
  },
});
