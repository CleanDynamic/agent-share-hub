import { supabase } from '@/integrations/supabase/client';
import type { ContentItemResult, ResultKind } from './types';

interface AddSlideInput {
  contentItemId: string;
  kind: ResultKind;
  mediaUrl?: string | null;
  text?: string | null;
  caption?: string | null;
  position?: number;
}

/**
 * Append a new result slide. If `position` is omitted we append to the end.
 */
export async function addResultSlide(
  input: AddSlideInput,
): Promise<ContentItemResult> {
  let position = input.position;
  if (position === undefined) {
    const { data: existing, error: countErr } = await (supabase as any)
      .from('content_item_results')
      .select('position')
      .eq('content_item_id', input.contentItemId)
      .order('position', { ascending: false })
      .limit(1);
    if (countErr) throw countErr;
    position = existing?.[0] ? (existing[0].position as number) + 1 : 0;
  }

  const payload = {
    content_item_id: input.contentItemId,
    kind: input.kind,
    media_url: input.mediaUrl ?? null,
    text_content: input.text ?? null,
    caption: input.caption ?? null,
    position,
  } as any;

  const { data, error } = await (supabase as any)
    .from('content_item_results')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as ContentItemResult;
}

export interface UpdateSlidePatch {
  kind?: ResultKind;
  mediaUrl?: string | null;
  text?: string | null;
  caption?: string | null;
  position?: number;
}

export async function updateResultSlide(
  slideId: string,
  patch: UpdateSlidePatch,
): Promise<ContentItemResult> {
  const update: Record<string, unknown> = {};
  if (patch.kind !== undefined) update.kind = patch.kind;
  if (patch.mediaUrl !== undefined) update.media_url = patch.mediaUrl;
  if (patch.text !== undefined) update.text_content = patch.text;
  if (patch.caption !== undefined) update.caption = patch.caption;
  if (patch.position !== undefined) update.position = patch.position;

  const { data, error } = await (supabase as any)
    .from('content_item_results')
    .update(update as any)
    .eq('id', slideId)
    .select('*')
    .single();

  if (error) throw error;
  return data as ContentItemResult;
}

export async function removeResultSlide(slideId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from('content_item_results')
    .delete()
    .eq('id', slideId);
  if (error) throw error;
}

/**
 * Reorder slides by writing the index of each id in the provided list as the
 * new `position`. Done as a sequence of updates (RLS-safe).
 */
export async function reorderResultSlides(
  contentItemId: string,
  slideIdsInOrder: string[],
): Promise<void> {
  await Promise.all(
    slideIdsInOrder.map((id, idx) =>
      (supabase as any)
        .from('content_item_results')
        .update({ position: idx } as any)
        .eq('id', id)
        .eq('content_item_id', contentItemId),
    ),
  );
}
