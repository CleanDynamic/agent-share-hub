import { useRef, useEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Assign sequential data-toc-anchor to heading elements after render
  // so the ArticleTOC scroll spy can find them
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Small delay to ensure TipTap has finished rendering
    const timer = setTimeout(() => {
      const headings = el.querySelectorAll('h1, h2, h3');
      let count = 0;
      headings.forEach(h => {
        count++;
        h.setAttribute('data-toc-anchor', `heading-${count}`);
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [article]);

  return (
    <div
      ref={containerRef}
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
