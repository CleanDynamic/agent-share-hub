import { useState, useEffect } from 'react';

interface TOCItem {
  id: string;
  text: string;
  level: 'h1' | 'h2' | 'h3' | 'stage';
  anchor: string;
}

interface ArticleTOCProps {
  articleBody: any; // TipTap JSON
  open: boolean;
  onToggle: () => void;
}

export function ArticleTOC({
  articleBody, open, onToggle,
}: ArticleTOCProps) {
  const [items, setItems] = useState<TOCItem[]>([]);
  const [activeAnchor, setActiveAnchor] =
    useState<string | null>(null);

  // Parse TOC items from TipTap JSON
  useEffect(() => {
    if (!articleBody?.content) return;
    const tocItems: TOCItem[] = [];
    let stageCount = 0;
    let headingCount = 0;

    articleBody.content.forEach((node: any) => {
      if (node.type === 'heading') {
        headingCount++;
        const text = node.content
          ?.map((n: any) => n.text ?? '')
          .join('') ?? '';
        const anchor = `heading-${headingCount}`;
        tocItems.push({
          id: anchor, text, anchor,
          level: `h${node.attrs?.level ?? 2}` as any,
        });
      }
      if (node.type === 'stageGrid') {
        stageCount++;
        const label = node.attrs?.label ?? `Stage ${stageCount}`;
        const anchor = `stage-${node.attrs?.stageGridId}`;
        tocItems.push({
          id: anchor, text: label, anchor,
          level: 'stage',
        });
      }
    });

    setItems(tocItems);
  }, [articleBody]);

  // Scroll spy — update activeAnchor on scroll
  useEffect(() => {
    const handler = () => {
      const headings = document.querySelectorAll(
        '[data-toc-anchor]'
      );
      let current: string | null = null;
      headings.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) {
          current = el.getAttribute('data-toc-anchor');
        }
      });
      setActiveAnchor(current);
    };
    document.addEventListener('scroll', handler, {
      passive: true
    });
    return () => document.removeEventListener(
      'scroll', handler
    );
  }, []);

  const scrollToAnchor = (anchor: string) => {
    const el = document.querySelector(
      `[data-toc-anchor="${anchor}"]`
    );
    el?.scrollIntoView({ behavior: 'smooth',
      block: 'start' });
  };

  return (
    <div style={{
      width: open ? 200 : 32,
      flexShrink: 0,
      transition: 'width 0.20s ease',
      display: 'flex', flexDirection: 'column',
      borderRight:
        '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(6,6,10,0.95)',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Toggle */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute',
          top: 16, right: open ? 8 : 6,
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.30)',
          cursor: 'pointer', fontSize: 11,
          fontWeight: 700, padding: 4,
          writingMode: open
            ? 'horizontal-tb' : 'vertical-rl',
          textTransform: 'uppercase',
          letterSpacing: open ? 0 : '0.12em',
          whiteSpace: 'nowrap',
          zIndex: 2,
        }}
      >
        {open ? '< Hide' : 'TOC'}
      </button>

      {open && (
        <div style={{
          flex: 1, overflowY: 'auto',
          paddingTop: 44, padding: '44px 0 16px 0',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: 'rgba(255,255,255,0.22)',
            padding: '0 12px 10px 12px',
            borderBottom:
              '1px solid rgba(255,255,255,0.05)',
            marginBottom: 8,
          }}>
            Contents
          </div>

          {items.length === 0 && (
            <div style={{
              padding: '16px 12px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.18)',
              fontStyle: 'italic',
            }}>
              Add headings or stage grids to build
              a table of contents
            </div>
          )}

          {items.map(item => {
            const isActive =
              activeAnchor === item.anchor;
            const isStage = item.level === 'stage';
            return (
              <button
                key={item.id}
                onClick={() =>
                  scrollToAnchor(item.anchor)
                }
                style={{
                  display: 'block', width: '100%',
                  textAlign: 'left', border: 'none',
                  background: isActive
                    ? 'rgba(232,87,26,0.08)'
                    : 'transparent',
                  cursor: 'pointer',
                  padding: isStage
                    ? '6px 12px' : {
                        h1: '5px 12px',
                        h2: '4px 12px',
                        h3: '4px 12px 4px 20px',
                      }[item.level] ?? '4px 12px',
                  fontSize: isStage ? 12 : {
                    h1: 13, h2: 12, h3: 11,
                  }[item.level] ?? 11,
                  fontWeight: isStage || item.level === 'h1'
                    ? 700 : 400,
                  color: isActive
                    ? (isStage
                      ? '#E8571A'
                      : 'rgba(255,255,255,0.80)')
                    : isStage
                      ? 'rgba(232,87,26,0.70)'
                      : 'rgba(255,255,255,0.42)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.5,
                  borderLeft: isActive
                    ? '2px solid #E8571A'
                    : '2px solid transparent',
                  transition: 'all 0.12s',
                }}
              >
                {isStage && (
                  <span style={{
                    display: 'inline-block',
                    width: 6, height: 6,
                    borderRadius: '50%',
                    background: 'currentColor',
                    marginRight: 6,
                    verticalAlign: 'middle',
                    opacity: 0.7,
                  }} />
                )}
                {item.text || 'Untitled'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
