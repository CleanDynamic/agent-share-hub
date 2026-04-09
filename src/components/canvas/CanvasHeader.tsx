import { getPrimaryTypeLabel } from '@/lib/content-types';

interface CanvasHeaderProps {
  mode: 'edit' | 'view';
  title: string;
  description: string;
  postType: string;
  difficulty?: string | null;
  coverPreview?: string | null;
  onTitleChange?: (v: string) => void;
  onDescriptionChange?: (v: string) => void;
  onPostTypeClick?: () => void;
  onCoverChange?: (
    file: File | null, preview: string | null
  ) => void;
}

export function CanvasHeader({
  mode, title, description, postType,
  difficulty, coverPreview,
  onTitleChange, onDescriptionChange,
  onPostTypeClick, onCoverChange,
}: CanvasHeaderProps) {
  const typeInfo = getPrimaryTypeLabel(postType);

  // Post type colour config
  const typeColors: Record<string, {
    color: string; bg: string; border: string
  }> = {
    build: {
      color: '#E8571A',
      bg: 'rgba(232,87,26,0.12)',
      border: 'rgba(232,87,26,0.25)',
    },
    technique: {
      color: '#2EC4B6',
      bg: 'rgba(46,196,182,0.12)',
      border: 'rgba(46,196,182,0.25)',
    },
    discovery: {
      color: '#7C3AED',
      bg: 'rgba(124,58,237,0.12)',
      border: 'rgba(124,58,237,0.25)',
    },
    discussion: {
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.12)',
      border: 'rgba(59,130,246,0.25)',
    },
  };
  const tc = typeColors[postType] ?? typeColors.build;

  return (
    <div style={{
      padding: '16px 16px 12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>

      {/* Cover image — compact chip in edit, full in view */}
      {mode === 'edit' && (
        <div style={{ marginBottom: 12 }}>
          {!coverPreview ? (
            <label style={{
              display: 'inline-flex',
              alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 9999,
              fontSize: 11, cursor: 'pointer',
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.35)',
            }}>
              Add cover image
              <input type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = URL.createObjectURL(f);
                  onCoverChange?.(f, url);
                }}
              />
            </label>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 8,
            }}>
              <img src={coverPreview} style={{
                width: 56, height: 36,
                objectFit: 'cover', borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.10)',
              }} />
              <span style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.40)',
              }}>
                Cover added
              </span>
              <button type="button"
                onClick={() => onCoverChange?.(
                  null, null
                )}
                style={{
                  fontSize: 11, background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                }}>
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cover image view mode */}
      {mode === 'view' && coverPreview && (
        <div style={{
          marginBottom: 16,
          borderRadius: 10, overflow: 'hidden',
        }}>
          <img src={coverPreview} style={{
            width: '100%', height: 160,
            objectFit: 'cover',
          }} />
        </div>
      )}

      {/* Badges row */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 8, flexWrap: 'wrap', marginBottom: 12,
      }}>
        {/* Post type badge */}
        <div
          onClick={mode === 'edit'
            ? onPostTypeClick : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center', gap: 6,
            padding: '3px 12px', borderRadius: 9999,
            background: tc.bg,
            border: `1px solid ${tc.border}`,
            cursor: mode === 'edit'
              ? 'pointer' : 'default',
          }}
        >
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: tc.color, textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            {typeInfo.label}
          </span>
          {typeInfo.sub && (
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.35)',
              textTransform: 'uppercase',
              borderLeft:
                '1px solid rgba(255,255,255,0.15)',
              paddingLeft: 6, marginLeft: 2,
            }}>
              {typeInfo.sub}
            </span>
          )}
          {mode === 'edit' && (
            <span style={{
              fontSize: 9,
              color: 'rgba(255,255,255,0.25)',
            }}>
              ↕
            </span>
          )}
        </div>

        {/* Difficulty badge */}
        {difficulty && (
          <div style={{
            padding: '3px 10px', borderRadius: 9999,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.09)',
            fontSize: 10, fontWeight: 500,
            color: 'rgba(255,255,255,0.50)',
          }}>
            {difficulty}
          </div>
        )}
      </div>

      {/* Title */}
      {mode === 'edit' ? (
        <input
          value={title}
          onChange={e => onTitleChange?.(e.target.value)}
          placeholder="Title your Blueprint..."
          maxLength={120}
          style={{
            width: '100%',
            fontFamily:
              "'Playfair Display', Georgia, serif",
            fontSize: 22, fontWeight: 700,
            color: 'rgba(255,255,255,0.95)',
            background: 'transparent', border: 'none',
            borderBottom:
              '1px solid rgba(255,255,255,0.06)',
            outline: 'none',
            padding: '2px 0 10px 0',
            marginBottom: 12, lineHeight: 1.25,
            letterSpacing: '-0.3px',
            boxSizing: 'border-box',
          }}
          onFocus={e =>
            e.target.style.borderBottomColor =
              'rgba(255,255,255,0.15)'}
          onBlur={e =>
            e.target.style.borderBottomColor =
              'rgba(255,255,255,0.06)'}
        />
      ) : (
        <h1 style={{
          fontFamily:
            "'Playfair Display', Georgia, serif",
          fontSize: 22, fontWeight: 700,
          color: 'rgba(255,255,255,0.95)',
          margin: '0 0 12px 0', lineHeight: 1.25,
          letterSpacing: '-0.3px',
        }}>
          {title || 'Untitled'}
        </h1>
      )}

      {/* Description */}
      {mode === 'edit' ? (
        <textarea
          value={description}
          onChange={e =>
            onDescriptionChange?.(e.target.value)}
          placeholder="Describe what this is and why it matters..."
          rows={2}
          style={{
            width: '100%', fontSize: 14,
            color: 'rgba(255,255,255,0.62)',
            lineHeight: 1.70, background: 'transparent',
            border: 'none', outline: 'none',
            resize: 'none', padding: 0,
            fontFamily: 'Inter, sans-serif',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <p style={{
          fontSize: 14, fontWeight: 400,
          color: 'rgba(255,255,255,0.62)',
          lineHeight: 1.70, margin: 0,
          fontFamily: 'Inter, sans-serif',
        }}>
          {description}
        </p>
      )}
    </div>
  );
}
