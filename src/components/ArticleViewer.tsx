import { TipTapEditor } from './TipTapEditor';
import type { ArticleDocument } from '@/lib/article-types';

interface ArticleViewerProps {
  article: ArticleDocument;
  contentId: string;
}

export function ArticleViewer({
  article,
  contentId,
}: ArticleViewerProps) {
  return (
    <div
      data-visual-slot="article-viewer"
      style={{
        padding: '0 0 40px 0',
      }}
    >
      <TipTapEditor
        contentId={contentId}
        initialContent={article}
        mode="view"
      />
    </div>
  );
}
