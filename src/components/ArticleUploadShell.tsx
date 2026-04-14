import { TipTapEditor } from './TipTapEditor';
import { useArticleAutosave } from '@/hooks/useArticleAutosave';

interface ArticleUploadShellProps {
  contentId: string | null;
  form: any;
  coverPreview: string | null;
  onCoverChange: (f: File | null, p: string | null) => void;
  onPostTypeClick: () => void;
  articleBody: any;
  onArticleBodyChange: (body: any) => void;
  onSave: () => void;
  onPublish: () => void;
  saving?: boolean;
  submitting?: boolean;
  onBack: () => void;
  postType: string;
}

export function ArticleUploadShell({
  contentId,
  form,
  coverPreview,
  onCoverChange,
  onPostTypeClick,
  articleBody,
  onArticleBodyChange,
  onSave,
  onPublish,
  saving,
  submitting,
  onBack,
  postType,
}: ArticleUploadShellProps) {
  const title = form.watch('title') ?? '';
  const description = form.watch('description') ?? '';

  const { saveNow } = useArticleAutosave(
    contentId,
    articleBody,
    title,
    description
  );

  // Post type config for the badge
  const POST_TYPE_CONFIG: Record<string, {
    label: string;
    color: string;
    bg: string;
    border: string;
  }> = {
    build: {
      label: 'Blueprint · Build',
      color: '#8B4513',
      bg: 'rgba(139,69,19,0.12)',
      border: 'rgba(139,69,19,0.25)',
    },
    technique: {
      label: 'Blueprint · Technique',
      color: '#1F7A6D',
      bg: 'rgba(31,122,109,0.12)',
      border: 'rgba(31,122,109,0.25)',
    },
    discovery: {
      label: 'Blueprint · Discovery',
      color: '#7C3AED',
      bg: 'rgba(124,58,237,0.12)',
      border: 'rgba(124,58,237,0.25)',
    },
    discussion: {
      label: 'Blog',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.25)',
    },
  };
  const ptc = POST_TYPE_CONFIG[postType] ?? POST_TYPE_CONFIG.build;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'rgba(6,6,10,1)',
        position: 'relative',
      }}
    >
      {/* Article scroll area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px 100px 28px',
        }}
      >
        {/* Post type badge + cover */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onPostTypeClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 12px',
              borderRadius: 9999,
              background: ptc.bg,
              border: `1px solid ${ptc.border}`,
              cursor: 'pointer',
              fontSize: 10,
              fontWeight: 700,
              color: ptc.color,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {ptc.label}
            <span
              style={{
                fontSize: 9,
                color: 'rgba(255,255,255,0.30)',
              }}
            >
              ↕
            </span>
          </button>

          {/* Cover image */}
          {!coverPreview ? (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 12px',
                borderRadius: 9999,
                fontSize: 10,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.04)',
                border: '1px dashed rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              + Cover
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = URL.createObjectURL(f);
                  onCoverChange(f, url);
                }}
              />
            </label>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <img
                src={coverPreview}
                style={{
                  width: 48,
                  height: 30,
                  objectFit: 'cover',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              />
              <button
                type="button"
                onClick={() => onCoverChange(null, null)}
                style={{
                  fontSize: 10,
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        {/* Title */}
        <input
          value={title}
          onChange={e => form.setValue('title', e.target.value)}
          placeholder="Title..."
          maxLength={120}
          style={{
            width: '100%',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 28,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0 0 4px 0',
            marginBottom: 10,
            lineHeight: 1.15,
            letterSpacing: '-0.4px',
            boxSizing: 'border-box',
          }}
        />

        {/* Description — feeds the feed card */}
        <input
          value={description}
          onChange={e => form.setValue('description', e.target.value)}
          placeholder="Short description (appears on feed card)..."
          maxLength={200}
          style={{
            width: '100%',
            fontFamily: 'Inter, sans-serif',
            fontSize: 14,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.45)',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0 0 20px 0',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            marginBottom: 24,
            boxSizing: 'border-box',
          }}
        />

        {/* TipTap article body — primary article editor with embedded StageGrid nodes */}
        <TipTapEditor
          contentId={contentId}
          initialContent={articleBody}
          mode="edit"
          onContentChange={onArticleBodyChange}
        />
      </div>

      {/* Fixed bottom toolbar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'rgba(6,6,10,0.96)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: 8,
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '6px 12px',
            borderRadius: 7,
            background: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>

        <div style={{ flex: 1 }} />

        <div
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.22)',
          }}
        >
          {saving ? 'Saving…' : 'Auto-saved'}
        </div>

        <button
          type="button"
          onClick={saveNow}
          disabled={saving}
          style={{
            padding: '7px 14px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.55)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={submitting}
          style={{
            padding: '7px 18px',
            borderRadius: 8,
            background: submitting ? 'rgba(139,69,19,0.40)' : '#8B4513',
            border: 'none',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Publishing…' : 'Publish'}
        </button>
      </div>
    </div>
  );
}
