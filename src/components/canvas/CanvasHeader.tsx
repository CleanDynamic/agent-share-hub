import { useState } from 'react';
import { getPrimaryTypeLabel } from '@/lib/content-types';
import { ChevronRight } from 'lucide-react';
import { type } from "@/lib/theme/type";

// ─── Evidence types ──────────────────────────────
export type EvidenceMediaType = 'photos' | 'video' | 'written';

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
  // Evidence props
  evidenceMediaType?: EvidenceMediaType;
  evidenceMediaFiles?: File[];
  evidenceMediaPreviews?: string[];
  evidenceCaption?: string;
  onEvidenceMediaTypeChange?: (t: EvidenceMediaType) => void;
  onEvidenceMediaFilesChange?: (files: File[], previews: string[]) => void;
  onEvidenceCaptionChange?: (v: string) => void;
}

// ─── Collapsible section ─────────────────────────
function CollapsibleSection({
  label, open, onToggle, required, isEmpty, children,
}: {
  label: string; open: boolean; onToggle: () => void;
  required?: boolean; isEmpty?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '8px 0',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.45)', fontSize: 12,
          fontWeight: 500,
          letterSpacing: '0.04em',
          fontFamily: 'Figtree, sans-serif',
          textTransform: 'none' as const,
        }}
      >
        <ChevronRight
          size={12}
          style={{
            color: 'rgba(255,255,255,0.30)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms',
            flexShrink: 0,
          }}
        />
        {label}
        {required && isEmpty && (
          <span style={{
            width: 4, height: 4, borderRadius: '50%',
            background: '#E8571A', flexShrink: 0,
            marginLeft: 6,
          }} />
        )}
      </button>
      {open && (
        <div style={{ paddingBottom: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function CanvasHeader({
  mode, title, description, postType,
  difficulty, coverPreview,
  onTitleChange, onDescriptionChange,
  onPostTypeClick, onCoverChange,
  evidenceMediaType = 'written',
  evidenceMediaFiles = [],
  evidenceMediaPreviews = [],
  evidenceCaption = '',
  onEvidenceMediaTypeChange,
  onEvidenceMediaFilesChange,
  onEvidenceCaptionChange,
}: CanvasHeaderProps) {
  const typeInfo = getPrimaryTypeLabel(postType);

  const [titleOpen, setTitleOpen] = useState(false);
  const [descOpen, setDescOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [titleFocused, setTitleFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  // Post type colour config
  const typeColors: Record<string, {
    color: string; bg: string; border: string
  }> = {
    build: {
      color: '#8B4513',
      bg: 'rgba(139,69,19,0.12)',
      border: 'rgba(139,69,19,0.25)',
    },
    technique: {
      color: '#1F7A6D',
      bg: 'rgba(31,122,109,0.12)',
      border: 'rgba(31,122,109,0.25)',
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

  const isEdit = mode === 'edit';

  // ── View mode: show everything expanded ─────────
  if (!isEdit) {
    return (
      <div style={{
        padding: '16px 16px 12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {coverPreview && (
          <div style={{ marginBottom: 16, borderRadius: 10, overflow: 'hidden' }}>
            <img src={coverPreview} style={{ width: '100%', height: 160, objectFit: 'cover' }} />
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 12px', borderRadius: 9999,
            background: tc.bg, border: `1px solid ${tc.border}`,
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: tc.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {typeInfo.label}
            </span>
            {typeInfo.sub && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 6, marginLeft: 2 }}>
                {typeInfo.sub}
              </span>
            )}
          </div>
          {difficulty && (
            <div style={{ padding: '3px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.50)' }}>
              {difficulty}
            </div>
          )}
        </div>
        <h1 style={{ ...type.cardTitle,   color: 'rgba(255,255,255,0.95)', margin: '0 0 12px 0',  }}>
          {title || 'Untitled'}
        </h1>
        <p style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.62)', lineHeight: 1.70, margin: 0, fontFamily: 'Figtree, sans-serif' }}>
          {description}
        </p>
      </div>
    );
  }

  // ── Edit mode: collapsible sections ─────────────
  return (
    <div style={{
      padding: '8px 16px 4px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      {/* Badges row — always visible */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 8, flexWrap: 'wrap', marginBottom: 4,
      }}>
        <div
          onClick={onPostTypeClick}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '3px 12px', borderRadius: 9999,
            background: tc.bg, border: `1px solid ${tc.border}`,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: tc.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {typeInfo.label}
          </span>
          {typeInfo.sub && (
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: 6, marginLeft: 2 }}>
              {typeInfo.sub}
            </span>
          )}
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>↕</span>
        </div>

        {difficulty && (
          <div style={{ padding: '3px 10px', borderRadius: 9999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.50)' }}>
            {difficulty}
          </div>
        )}

        {/* Cover image chip */}
        {!coverPreview ? (
          <label style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 9999, fontSize: 10,
            cursor: 'pointer', background: 'rgba(255,255,255,0.03)',
            border: '1px dashed rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.35)',
          }}>
            + Cover
            <input type="file" accept="image/*,video/*" style={{ display: 'none' }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (!f) return;
                onCoverChange?.(f, URL.createObjectURL(f));
              }}
            />
          </label>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 8px', borderRadius: 9999, background: 'rgba(255, 255, 255, 0.12)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <img src={coverPreview} style={{ width: 16, height: 16, objectFit: 'cover', borderRadius: '50%' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}>Cover</span>
            <button type="button" onClick={() => onCoverChange?.(null, null)}
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>
              ×
            </button>
          </div>
        )}
      </div>

      {/* ── Title (collapsible) ── */}
      <CollapsibleSection
        label="Title"
        open={titleOpen}
        onToggle={() => setTitleOpen(o => !o)}
        required
        isEmpty={!title.trim()}
      >
        <input
          value={title}
          onChange={e => onTitleChange?.(e.target.value)}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          placeholder="Title your Blueprint..."
          maxLength={120}
          style={{
            width: '100%',
            fontFamily: 'Figtree, sans-serif',
            fontSize: 15, fontWeight: 400,
            color: 'rgba(255,255,255,0.90)',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${titleFocused ? 'rgba(255,255,255,0.15)' : 'rgba(255, 255, 255, 0.14)'}`,
            borderRadius: 8,
            outline: 'none',
            padding: '12px 16px',
            lineHeight: 1.4,
            boxSizing: 'border-box' as const,
            transition: 'border-color 200ms',
          }}
        />
      </CollapsibleSection>

      {/* ── Description (collapsible) ── */}
      <CollapsibleSection
        label="Description"
        open={descOpen}
        onToggle={() => setDescOpen(o => !o)}
        required
        isEmpty={!description.trim()}
      >
        <textarea
          value={description}
          onChange={e => onDescriptionChange?.(e.target.value)}
          onFocus={() => setDescFocused(true)}
          onBlur={() => setDescFocused(false)}
          placeholder="Describe what this is and why it matters..."
          rows={2}
          maxLength={500}
          style={{
            width: '100%', fontSize: 15, fontWeight: 400,
            color: 'rgba(255,255,255,0.90)',
            lineHeight: 1.4,
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${descFocused ? 'rgba(255,255,255,0.15)' : 'rgba(255, 255, 255, 0.14)'}`,
            borderRadius: 8,
            outline: 'none',
            resize: 'none',
            padding: '12px 16px',
            minHeight: 60,
            fontFamily: 'Figtree, sans-serif',
            boxSizing: 'border-box' as const,
            transition: 'border-color 200ms',
          }}
        />
        <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.25)', textAlign: 'right', fontFamily: 'Figtree, sans-serif', marginTop: 4 }}>
          {description.length} / 500
        </div>
      </CollapsibleSection>

      {/* ── Your results / Evidence (collapsible) ── */}
      <CollapsibleSection
        label="Your results"
        open={evidenceOpen}
        onToggle={() => setEvidenceOpen(o => !o)}
      >
        <EvidenceEditor
          mediaType={evidenceMediaType}
          mediaFiles={evidenceMediaFiles}
          mediaPreviews={evidenceMediaPreviews}
          caption={evidenceCaption}
          onMediaTypeChange={onEvidenceMediaTypeChange}
          onMediaFilesChange={onEvidenceMediaFilesChange}
          onCaptionChange={onEvidenceCaptionChange}
        />
      </CollapsibleSection>
    </div>
  );
}

// ─── Evidence editor (compact) ───────────────────
function EvidenceEditor({
  mediaType, mediaFiles, mediaPreviews, caption,
  onMediaTypeChange, onMediaFilesChange, onCaptionChange,
}: {
  mediaType: EvidenceMediaType;
  mediaFiles: File[];
  mediaPreviews: string[];
  caption: string;
  onMediaTypeChange?: (t: EvidenceMediaType) => void;
  onMediaFilesChange?: (files: File[], previews: string[]) => void;
  onCaptionChange?: (v: string) => void;
}) {
  const TYPES: { value: EvidenceMediaType; label: string }[] = [
    { value: 'photos', label: '📷 Photo(s)' },
    { value: 'video', label: '🎬 Video' },
    { value: 'written', label: '✏️ Written' },
  ];

  return (
    <div>
      {/* Media type toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => onMediaTypeChange?.(t.value)}
            style={{
              padding: '4px 12px', borderRadius: 6, fontSize: 11,
              height: 28,
              cursor: 'pointer',
              background: mediaType === t.value ? 'rgba(232,87,26,0.10)' : 'transparent',
              border: `1px solid ${mediaType === t.value ? 'rgba(232,87,26,0.3)' : 'rgba(255,255,255,0.08)'}`,
              color: mediaType === t.value ? '#E8571A' : 'rgba(255,255,255,0.45)',
              fontFamily: 'Figtree, sans-serif',
              transition: 'all 200ms',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Photo(s) upload */}
      {mediaType === 'photos' && (
        <div style={{ marginBottom: 8 }}>
          {mediaPreviews.length > 0 && (
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }}>
              {mediaPreviews.map((p, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={p} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }} />
                  <button type="button"
                    onClick={() => {
                      const nf = [...mediaFiles]; nf.splice(i, 1);
                      const np = [...mediaPreviews]; np.splice(i, 1);
                      onMediaFilesChange?.(nf, np);
                    }}
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.70)', border: 'none',
                      color: '#fff', fontSize: 10, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {mediaPreviews.length < 5 && (
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, fontSize: 11,
              cursor: 'pointer', background: 'rgba(255, 255, 255, 0.12)',
              border: '1px dashed rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.40)',
            }}>
              + Add photos
              <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files ?? []).slice(0, 5 - mediaFiles.length);
                  const newFiles = [...mediaFiles, ...files];
                  const newPreviews = [...mediaPreviews, ...files.map(f => URL.createObjectURL(f))];
                  onMediaFilesChange?.(newFiles, newPreviews);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Video upload */}
      {mediaType === 'video' && (
        <div style={{ marginBottom: 8 }}>
          {mediaPreviews.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <video src={mediaPreviews[0]} style={{ width: 80, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>Video added</span>
              <button type="button"
                onClick={() => onMediaFilesChange?.([], [])}
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer' }}
              >Remove</button>
            </div>
          ) : (
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 6, fontSize: 11,
              cursor: 'pointer', background: 'rgba(255, 255, 255, 0.12)',
              border: '1px dashed rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.40)',
            }}>
              + Upload video
              <input type="file" accept="video/*" style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  onMediaFilesChange?.([f], [URL.createObjectURL(f)]);
                }}
              />
            </label>
          )}
        </div>
      )}

      {/* Caption (shared) */}
      <textarea
        value={caption}
        onChange={e => {
          if (e.target.value.length <= 500) onCaptionChange?.(e.target.value);
        }}
        placeholder="Add a caption describing your results..."
        rows={2}
        style={{
          width: '100%', fontSize: 12,
          color: 'rgba(255,255,255,0.60)',
          lineHeight: 1.60, background: 'transparent',
          border: 'none', outline: 'none',
          resize: 'none', padding: 0,
          fontFamily: 'Figtree, sans-serif',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', textAlign: 'right' }}>
        {caption.length} / 500
      </div>
    </div>
  );
}
