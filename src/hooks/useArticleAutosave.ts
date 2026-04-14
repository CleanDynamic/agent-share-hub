import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useArticleAutosave(
  contentId: string | null,
  articleBody: any,
  formTitle: string,
  formDescription: string,
  delay = 2500
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');

  const save = useCallback(async () => {
    if (!contentId || !articleBody) return;
    const serialised = JSON.stringify({
      body: articleBody,
      title: formTitle,
      description: formDescription,
    });
    if (serialised === lastSavedRef.current) return;

    await supabase
      .from('content_items')
      .update({
        article_body: articleBody,
        editor_mode: 'article',
        title: formTitle || undefined,
        description: formDescription || undefined,
      } as any)
      .eq('id', contentId);

    lastSavedRef.current = serialised;
  }, [contentId, articleBody, formTitle, formDescription]);

  // Debounce on any change
  useEffect(() => {
    if (!contentId) return;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(save, delay);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [articleBody, formTitle, formDescription, contentId, save, delay]);

  return { saveNow: save };
}
