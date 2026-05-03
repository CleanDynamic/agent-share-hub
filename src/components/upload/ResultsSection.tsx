import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  getResultsForContentItem,
  addResultSlide,
  updateResultSlide,
  removeResultSlide,
  reorderResultSlides,
} from '@/lib/results';
import type { ContentItemResult } from '@/lib/results/types';
import { ResultsCarouselEditor, type Slide } from './ResultsCarouselEditor';

const PHOTO_MAX = 10 * 1024 * 1024; // 10MB
const VIDEO_MAX = 100 * 1024 * 1024; // 100MB

interface ResultsSectionProps {
  contentItemId: string | null;
}

function rowToSlide(r: ContentItemResult): Slide {
  return {
    id: r.id,
    kind: r.kind,
    mediaUrl: r.media_url ?? undefined,
    text: r.text_content ?? undefined,
    caption: r.caption ?? '',
  };
}

export function ResultsSection({ contentItemId }: ResultsSectionProps) {
  const { toast } = useToast();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const captionTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const textTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refresh = useCallback(async () => {
    if (!contentItemId) {
      setSlides([]);
      return;
    }
    try {
      const rows = await getResultsForContentItem(contentItemId);
      setSlides(rows.map(rowToSlide));
    } catch (err) {
      console.warn('[ResultsSection] load failed', err);
    }
  }, [contentItemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const uploadFile = async (file: File, kind: 'photo' | 'video'): Promise<string | null> => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return null;
    }
    const ext = file.name.split('.').pop() ?? (kind === 'photo' ? 'jpg' : 'mp4');
    const path = `${uid}/${contentItemId ?? 'tmp'}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('content-results')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return null;
    }
    const { data } = supabase.storage.from('content-results').getPublicUrl(path);
    return data.publicUrl;
  };

  const validate = (file: File, kind: 'photo' | 'video'): boolean => {
    if (kind === 'photo') {
      if (!file.type.startsWith('image/')) {
        toast({ title: 'Wrong file type', description: 'Photos must be image files.', variant: 'destructive' });
        return false;
      }
      if (file.size > PHOTO_MAX) {
        toast({ title: 'Photo too large', description: 'Max 10 MB.', variant: 'destructive' });
        return false;
      }
    } else {
      if (!file.type.startsWith('video/')) {
        toast({ title: 'Wrong file type', description: 'Videos must be video files.', variant: 'destructive' });
        return false;
      }
      if (file.size > VIDEO_MAX) {
        toast({ title: 'Video too large', description: 'Max 100 MB.', variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const handleAddSlide = useCallback(
    async (kind: 'photo' | 'video' | 'written', files?: File[]) => {
      if (!contentItemId) {
        toast({ title: 'Save the draft first', description: 'Add a title to create the draft, then add results.' });
        return;
      }

      if (kind === 'written') {
        try {
          const row = await addResultSlide({
            contentItemId,
            kind: 'written',
            text: '',
            caption: '',
            position: slides.length,
          });
          setSlides((prev) => [...prev, rowToSlide(row)]);
          setActiveIndex(slides.length);
        } catch (err: any) {
          toast({ title: 'Could not add slide', description: err?.message, variant: 'destructive' });
        }
        return;
      }

      const list = (files ?? []).filter((f) => validate(f, kind));
      if (!list.length) return;
      setUploading(true);
      try {
        let pos = slides.length;
        let firstNewIndex = slides.length;
        for (const file of list) {
          const url = await uploadFile(file, kind);
          if (!url) continue;
          const row = await addResultSlide({
            contentItemId,
            kind,
            mediaUrl: url,
            caption: '',
            position: pos,
          });
          setSlides((prev) => [...prev, rowToSlide(row)]);
          pos += 1;
        }
        setActiveIndex(firstNewIndex);
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [contentItemId, slides.length, toast],
  );

  const handleRemoveSlide = useCallback(
    async (id: string) => {
      try {
        await removeResultSlide(id);
        setSlides((prev) => {
          const next = prev.filter((s) => s.id !== id);
          setActiveIndex((idx) => Math.max(0, Math.min(idx, next.length - 1)));
          return next;
        });
      } catch (err: any) {
        toast({ title: 'Could not remove slide', description: err?.message, variant: 'destructive' });
      }
    },
    [toast],
  );

  const handleReplaceSlide = useCallback(
    async (id: string, file: File) => {
      const slide = slides.find((s) => s.id === id);
      if (!slide || slide.kind === 'written') return;
      if (!validate(file, slide.kind)) return;
      setUploading(true);
      try {
        const url = await uploadFile(file, slide.kind);
        if (!url) return;
        await updateResultSlide(id, { mediaUrl: url });
        setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, mediaUrl: url } : s)));
      } catch (err: any) {
        toast({ title: 'Replace failed', description: err?.message, variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [slides, toast],
  );

  const handleUpdateCaption = useCallback((id: string, value: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, caption: value } : s)));
    const existing = captionTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      updateResultSlide(id, { caption: value }).catch((err) =>
        console.warn('[ResultsSection] caption save failed', err),
      );
    }, 800);
    captionTimers.current.set(id, t);
  }, []);

  const handleUpdateText = useCallback((id: string, value: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, text: value } : s)));
    const existing = textTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      updateResultSlide(id, { text: value }).catch((err) =>
        console.warn('[ResultsSection] text save failed', err),
      );
    }, 800);
    textTimers.current.set(id, t);
  }, []);

  const handleReorderSlides = useCallback(
    async (newOrder: string[]) => {
      setSlides((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        return newOrder.map((id) => map.get(id)!).filter(Boolean);
      });
      if (!contentItemId) return;
      try {
        await reorderResultSlides(contentItemId, newOrder);
      } catch (err) {
        console.warn('[ResultsSection] reorder failed', err);
      }
    },
    [contentItemId],
  );

  return (
    <ResultsCarouselEditor
      slides={slides}
      activeSlideIndex={activeIndex}
      onActiveSlideChange={setActiveIndex}
      onAddSlide={handleAddSlide}
      onRemoveSlide={handleRemoveSlide}
      onReplaceSlide={handleReplaceSlide}
      onUpdateCaption={handleUpdateCaption}
      onUpdateText={handleUpdateText}
      onReorderSlides={handleReorderSlides}
      isFileUploading={uploading}
    />
  );
}
