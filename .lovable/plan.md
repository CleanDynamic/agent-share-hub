Adjust `.tiptap-article .ProseMirror` padding in `src/components/article/ArticleEditor.tsx` from `padding: 32px 2px 28px` to `padding: 12px 12px 28px 12px` — left edge shifts ~10px right (aligning with toolbar's inner content), and top padding drops from 32 → 12 so the first line sits closer to the toolbar.

No other changes.