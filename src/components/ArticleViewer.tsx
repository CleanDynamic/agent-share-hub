import { useRef, useEffect } from 'react';
import { TipTapEditor } from './TipTapEditor';
import type { ArticleDocument } from '@/lib/article-types';

interface ArticleViewerProps {
  article: ArticleDocument;
  contentId: string;
  coverImageUrl?: string | null;
}

export function ArticleViewer({
  article,
  contentId,
  coverImageUrl,
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
      {/* Cover image — full-width above article body */}
      {coverImageUrl && (
        <div style={{
          marginBottom: 24,
          borderRadius: 10, overflow: 'hidden',
          margin: '0 -28px 24px -28px',
        }}>
          {/\.(mp4|webm|mov)$/i.test(coverImageUrl) ? (
            <video
              src={coverImageUrl}
              autoPlay muted loop playsInline
              style={{ width: '100%', maxHeight: 280,
                objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img src={coverImageUrl}
              style={{ width: '100%', maxHeight: 280,
                objectFit: 'cover', display: 'block' }} />
          )}
        </div>
      )}

      <TipTapEditor
        contentId={contentId}
        initialContent={article}
        mode="view"
      />
    </div>
  );
}
