// TipTap document JSON shape (simplified)
export interface ArticleDocument {
  type: 'doc';
  content: ArticleNode[];
}

export type ArticleNode =
  | ParagraphNode
  | HeadingNode
  | CodeBlockNode
  | BlockquoteNode
  | HorizontalRuleNode
  | ImageNode
  | StageGridNode
  | BlockRefNode;

export interface ParagraphNode {
  type: 'paragraph';
  content?: InlineNode[];
}

export interface HeadingNode {
  type: 'heading';
  attrs: { level: 1 | 2 | 3 };
  content?: InlineNode[];
}

export interface CodeBlockNode {
  type: 'codeBlock';
  attrs: { language: string | null };
  content?: [{ type: 'text'; text: string }];
}

export interface BlockquoteNode {
  type: 'blockquote';
  content?: ArticleNode[];
}

export interface HorizontalRuleNode {
  type: 'horizontalRule';
}

export interface ImageNode {
  type: 'image';
  attrs: {
    src: string;
    alt: string | null;
    title: string | null;
  };
}

// Custom node: embedded stage grid canvas
export interface StageGridNode {
  type: 'stageGrid';
  attrs: {
    stageGridId: string;  // article_stage_grids.id
    stageId: string | null; // canvas_stages.id
    label: string;
  };
}

// Custom node: inline block reference chip
export interface BlockRefNode {
  type: 'blockRef';
  attrs: {
    blockId: string;
    stageIndex: string; // e.g. '1a', '2b'
    label: string;
  };
}

export type InlineNode =
  | { type: 'text'; text: string; marks?: Mark[] }
  | BlockRefNode;

export interface Mark {
  type: 'bold' | 'italic' | 'code' | 'link' | 'highlight';
  attrs?: Record<string, any>;
}

// Empty article doc (starting state)
export function emptyArticleDoc(): ArticleDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [],
      },
    ],
  };
}
