import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react';
import { BlockReferenceNode } from './BlockReferenceNode';

/**
 * BlockReferenceExtension
 *
 * Inline TipTap atom node "blockReference" that renders a chip pointing
 * to a block in the canvas/document. Triggered by typing "[[" which
 * opens a picker (handled in ArticleEditor).
 *
 * Attributes:
 *   - blockId
 *   - blockName
 *   - blockType
 *   - stageId
 */
export const BlockReferenceExtension = Node.create({
  name: 'blockReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      blockId: { default: '' },
      blockName: { default: '' },
      blockType: { default: 'text' },
      stageId: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-block-reference]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-block-reference': '',
        'data-block-id': HTMLAttributes.blockId,
      }),
      `@${HTMLAttributes.blockName || 'Untitled'}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(BlockReferenceNode);
  },
});
