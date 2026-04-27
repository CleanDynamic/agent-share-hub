import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CommentAnchorType = 'prose' | 'block' | 'stage' | 'arrow';

export interface CommentAnchor {
  type: CommentAnchorType;
  // prose: { from, to }; others: { id }
  data: Record<string, any>;
}

export interface DocumentComment {
  id: string;
  document_id: string;
  thread_id: string;
  parent_comment_id: string | null;
  author_id: string;
  body: string;
  anchor_type: CommentAnchorType;
  anchor_data: Record<string, any>;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  };
}

export interface CommentThread {
  threadId: string;
  anchor: CommentAnchor;
  comments: DocumentComment[];
  resolved: boolean;
  createdAt: string;
}

export function useDocumentComments(documentId: string | null) {
  const [comments, setComments] = useState<DocumentComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  // Fetch + realtime
  useEffect(() => {
    if (!documentId) {
      setComments([]);
      return;
    }
    let cancelled = false;
    setLoading(true);

    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('document_comments')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (!error && data) {
        // Hydrate authors
        const authorIds = Array.from(new Set(data.map((c: any) => c.author_id)));
        let profilesMap: Record<string, any> = {};
        if (authorIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url')
            .in('id', authorIds);
          profilesMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
        }
        if (cancelled) return;
        setComments(
          data.map((c: any) => ({ ...c, author: profilesMap[c.author_id] })) as DocumentComment[]
        );
      }
      setLoading(false);
    };

    fetchComments();

    const channel = supabase
      .channel(`document_comments_${documentId}_${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_comments',
          filter: `document_id=eq.${documentId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  const addComment = useCallback(
    async (params: {
      threadId?: string;
      parentCommentId?: string | null;
      body: string;
      anchor: CommentAnchor;
    }) => {
      if (!documentId || !currentUserId) return null;
      const threadId = params.threadId ?? crypto.randomUUID();
      const { data, error } = await supabase
        .from('document_comments')
        .insert({
          document_id: documentId,
          thread_id: threadId,
          parent_comment_id: params.parentCommentId ?? null,
          author_id: currentUserId,
          body: params.body,
          anchor_type: params.anchor.type,
          anchor_data: params.anchor.data,
        })
        .select()
        .single();
      if (error) {
        console.error('addComment failed', error);
        return null;
      }
      return data as DocumentComment;
    },
    [documentId, currentUserId]
  );

  const resolveThread = useCallback(
    async (threadId: string) => {
      if (!documentId) return;
      await supabase
        .from('document_comments')
        .update({ resolved: true, resolved_at: new Date().toISOString(), resolved_by: currentUserId })
        .eq('document_id', documentId)
        .eq('thread_id', threadId);
    },
    [documentId, currentUserId]
  );

  const reopenThread = useCallback(
    async (threadId: string) => {
      if (!documentId) return;
      await supabase
        .from('document_comments')
        .update({ resolved: false, resolved_at: null, resolved_by: null })
        .eq('document_id', documentId)
        .eq('thread_id', threadId);
    },
    [documentId]
  );

  const deleteComment = useCallback(async (id: string) => {
    await supabase.from('document_comments').delete().eq('id', id);
  }, []);

  // Group into threads
  const threads: CommentThread[] = (() => {
    const map = new Map<string, CommentThread>();
    const sorted = [...comments].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const c of sorted) {
      const existing = map.get(c.thread_id);
      if (!existing) {
        map.set(c.thread_id, {
          threadId: c.thread_id,
          anchor: { type: c.anchor_type, data: c.anchor_data },
          comments: [c],
          resolved: c.resolved,
          createdAt: c.created_at,
        });
      } else {
        existing.comments.push(c);
        // Resolved status: thread is resolved if any comment in it is marked resolved
        // (we update all rows in resolveThread)
        existing.resolved = existing.resolved || c.resolved;
      }
    }
    return Array.from(map.values());
  })();

  const unresolvedCount = threads.filter((t) => !t.resolved).length;

  return {
    comments,
    threads,
    unresolvedCount,
    loading,
    currentUserId,
    addComment,
    resolveThread,
    reopenThread,
    deleteComment,
  };
}
