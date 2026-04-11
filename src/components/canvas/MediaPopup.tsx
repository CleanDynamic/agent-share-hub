import { useEffect } from 'react';
import { X } from 'lucide-react';

export type MediaPopupKind = 'image' | 'video';

interface MediaPopupProps {
  open: boolean;
  onClose: () => void;
  kind: MediaPopupKind;
  src: string;              // image URL, video URL, or embed URL
  embedUrl?: string | null; // YouTube/Vimeo embed URL, if applicable
  description?: string | null;
}

/**
 * Full-screen overlay for viewing an image or video at full resolution.
 * Click outside the media to close. Press Escape to close.
 */
export function MediaPopup({
  open, onClose, kind, src, embedUrl, description,
}: MediaPopupProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          color: '#fff',
          cursor: 'pointer',
          zIndex: 1,
        }}
      >
        <X size={24} />
      </button>

      {/* Content wrapper — clicking here should NOT close */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {kind === 'image' ? (
          <img
            src={src}
            alt={description ?? ''}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.40)',
              display: 'block',
            }}
          />
        ) : embedUrl ? (
          <iframe
            src={embedUrl}
            title={description ?? 'Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: 'min(90vw, 1280px)',
              aspectRatio: '16 / 9',
              maxHeight: '85vh',
              border: 'none',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.60)',
            }}
          />
        ) : (
          <video
            src={src}
            controls
            autoPlay
            playsInline
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.60)',
              display: 'block',
            }}
          />
        )}

        {description && (
          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.70)',
              fontFamily: 'Inter, sans-serif',
              fontStyle: 'italic',
              margin: 0,
              textAlign: 'center',
              maxWidth: '80vw',
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────

/**
 * Extract a YouTube video ID from a URL. Returns null if not a YouTube URL.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
  );
  return m ? m[1] : null;
}

/**
 * Extract a Vimeo video ID from a URL. Returns null if not a Vimeo URL.
 */
export function extractVimeoId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? m[1] : null;
}

/**
 * Given a user-supplied video URL, derive a thumbnail URL and the
 * appropriate embed URL (for iframes). For direct video URLs the
 * thumbnail is null and the src should be used with a <video> element.
 */
export function resolveVideoSources(url: string): {
  kind: 'youtube' | 'vimeo' | 'direct' | 'empty';
  thumbnailUrl: string | null;
  embedUrl: string | null;
  sourceUrl: string;
} {
  if (!url) {
    return { kind: 'empty', thumbnailUrl: null, embedUrl: null, sourceUrl: '' };
  }
  const yt = extractYouTubeId(url);
  if (yt) {
    return {
      kind: 'youtube',
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/mqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${yt}`,
      sourceUrl: url,
    };
  }
  const vimeo = extractVimeoId(url);
  if (vimeo) {
    return {
      kind: 'vimeo',
      thumbnailUrl: null,
      embedUrl: `https://player.vimeo.com/video/${vimeo}`,
      sourceUrl: url,
    };
  }
  return {
    kind: 'direct',
    thumbnailUrl: null,
    embedUrl: null,
    sourceUrl: url,
  };
}
