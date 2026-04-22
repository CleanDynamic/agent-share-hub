import { useMemo } from 'react';
import { Boxes } from 'lucide-react';

import { useSelection } from '@/hooks/useSelection';
import { useDocumentStore } from '@/lib/documentStore';

import { InspectorDocument } from './InspectorDocument';
import { EmptyPanelState } from './toolPanelStyles';

type Visibility = 'public' | 'private' | 'unlisted';
type Status = 'draft' | 'published';

interface ArticleMeta {
  title?: string;
  description?: string;
  cover_url?: string;
  slug?: string;
  visibility?: Visibility;
  published_at?: string | null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function readMeta(body: unknown): ArticleMeta {
  if (!isObject(body)) return {};
  return {
    title: typeof body.title === 'string' ? body.title : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    cover_url: typeof body.cover_url === 'string' ? body.cover_url : undefined,
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    visibility:
      body.visibility === 'public' || body.visibility === 'private' || body.visibility === 'unlisted'
        ? body.visibility
        : undefined,
    published_at: typeof body.published_at === 'string' ? body.published_at : null,
  };
}

function countWordsInTipTap(node: unknown): number {
  if (!isObject(node)) return 0;
  let count = 0;
  if (node.type === 'text' && typeof node.text === 'string') {
    const trimmed = node.text.trim();
    if (trimmed.length > 0) {
      count += trimmed.split(/\s+/).length;
    }
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      count += countWordsInTipTap(child);
    }
  }
  return count;
}

function countWordsInString(s: unknown): number {
  if (typeof s !== 'string') return 0;
  const trimmed = s.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function PlaceholderInspector({ label }: { label: string }) {
  return (
    <EmptyPanelState
      icon={Boxes}
      title="Inspector details coming soon"
      description={label}
    />
  );
}

function DocumentInspectorContainer() {
  const articleBody = useDocumentStore((s) => s.articleBody);
  const setArticleBody = useDocumentStore((s) => s.setArticleBody);
  const stages = useDocumentStore((s) => s.stages);
  const blocks = useDocumentStore((s) => s.blocks);

  const meta = useMemo(() => readMeta(articleBody), [articleBody]);

  const updateMeta = (patch: Partial<ArticleMeta>) => {
    const base = isObject(articleBody) ? articleBody : {};
    setArticleBody({ ...base, ...patch });
  };

  const words = useMemo(() => {
    let total = countWordsInTipTap(articleBody);
    for (const block of Object.values(blocks)) {
      const props = block.properties ?? {};
      total += countWordsInString((props as Record<string, unknown>).text);
      total += countWordsInString((props as Record<string, unknown>).content);
    }
    return total;
  }, [articleBody, blocks]);

  const minToRead = Math.max(1, Math.ceil(words / 220));
  const stageCount = Object.keys(stages).length;
  const blockCount = Object.keys(blocks).length;

  const title = meta.title ?? '';
  const description = meta.description ?? '';
  const slug = meta.slug ?? '';
  const visibility: Visibility = meta.visibility ?? 'private';
  const status: Status = meta.published_at ? 'published' : 'draft';
  const publishDisabled = title.trim().length === 0 || slug.trim().length === 0;

  const handleCoverAdd = () => {
    const url = window.prompt('Cover image URL');
    if (url && url.trim()) {
      updateMeta({ cover_url: url.trim() });
    }
  };

  const handleCoverRemove = () => {
    updateMeta({ cover_url: undefined });
  };

  const handlePublish = () => {
    if (publishDisabled) return;
    updateMeta({ published_at: new Date().toISOString() });
  };

  return (
    <InspectorDocument
      title={title}
      onTitleChange={(value) => updateMeta({ title: value })}
      description={description}
      onDescriptionChange={(value) => updateMeta({ description: value })}
      coverUrl={meta.cover_url}
      onCoverAdd={handleCoverAdd}
      onCoverRemove={handleCoverRemove}
      words={words}
      minToRead={minToRead}
      stages={stageCount}
      blocks={blockCount}
      slug={slug}
      onSlugChange={(value) => updateMeta({ slug: value })}
      visibility={visibility}
      onVisibilityChange={(value) => updateMeta({ visibility: value })}
      status={status}
      onPublish={handlePublish}
      publishDisabled={publishDisabled}
    />
  );
}

export function InspectorTool() {
  const { selection } = useSelection();

  switch (selection.kind) {
    case 'none':
      return <DocumentInspectorContainer />;
    case 'block':
      return <PlaceholderInspector label="Block inspector coming in Step 2" />;
    case 'stage':
      return <PlaceholderInspector label="Stage inspector coming in Step 3" />;
    case 'arrow':
      return <PlaceholderInspector label="Arrow inspector coming in Step 4" />;
    case 'prose':
      return <PlaceholderInspector label="Prose inspector coming in Step 5" />;
    case 'multi':
      return <PlaceholderInspector label="Multi-select inspector coming later" />;
    default:
      return <DocumentInspectorContainer />;
  }
}
