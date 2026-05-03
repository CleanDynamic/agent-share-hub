import { supabase } from '@/integrations/supabase/client';
import type { ContentItemResult } from './types';

/**
 * Fetch all result slides for a content item, ordered by position.
 */
export async function getResultsForContentItem(
  contentItemId: string,
): Promise<ContentItemResult[]> {
  const { data, error } = await (supabase as any)
    .from('content_item_results')
    .select('*')
    .eq('content_item_id', contentItemId)
    .order('position', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ContentItemResult[];
}
