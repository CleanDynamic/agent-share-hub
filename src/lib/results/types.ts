export type ResultKind = 'photo' | 'video' | 'written';

export interface ContentItemResult {
  id: string;
  content_item_id: string;
  kind: ResultKind;
  media_url: string | null;
  text_content: string | null;
  caption: string | null;
  position: number;
  created_at: string;
}

// Convenience: extend a content_items row with an optional results slide array.
export type WithResults<T> = T & { results?: ContentItemResult[] };
