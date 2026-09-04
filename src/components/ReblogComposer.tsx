/**
 * ReblogComposer — two-panel modal for creating a reblog post.
 *
 * Left panel: reblogger's contribution (main comment, thread items,
 *             block annotations, block comparisons)
 * Right panel: original post, scrollable, each block annotatable/comparable
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { insertNotification } from "@/lib/notifications";
import { type } from "@/lib/theme/type";

// ── Types ────────────────────────────────────────────────────

export interface ReblogComposerOriginal {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  creatorUsername: string;
  creatorDisplayName?: string;
  contentType?: string;
  viewCount?: number;
  downloadCount?: number;
}

interface ReblogComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  original: ReblogComposerOriginal;
  onSuccess?: (newId: string) => void;
}

interface Annotation {
  id: string;
  blockId: string;
  blockType: string;
  blockPreview: string; // first 80 chars of block content
  text: string;
}

interface Comparison {
  id: string;
  blockId: string;
  blockPreview: string;
  sideA: string; // original block preview
  sideB: string; // reblogger's alternative
  sideALabel: string;
  sideBLabel: string;
}

// ── ReblogComposePanel (left side) ───────────────────────────

function ReblogComposePanel({
  form,
  annotations, setAnnotations,
  comparisons, setComparisons,
  threads, setThreads,
  onSubmit, submitting,
}: {
  form: ReturnType<typeof useForm<{ description: string }>>;
  annotations: Annotation[];
  setAnnotations: React.Dispatch<React.SetStateAction<Annotation[]>>;
  comparisons: Comparison[];
  setComparisons: React.Dispatch<React.SetStateAction<Comparison[]>>;
  threads: string[];
  setThreads: React.Dispatch<React.SetStateAction<string[]>>;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const mainText = form.watch('description') ?? '';
  const charLimit = 500;
  const charsLeft = charLimit - mainText.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: 'rgba(255,255,255,0.30)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>↻ Your Reblog</span>
        <span style={{
          fontSize: 11, fontWeight: 400,
          color: charsLeft < 50 ? '#F59E0B' : 'rgba(255,255,255,0.20)',
        }}>
          {charsLeft}
        </span>
      </div>

      {/* Scrollable compose area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Main comment — tweet style */}
        <textarea
          {...form.register('description')}
          placeholder="Add your take on this... (optional — leave blank to repost)"
          rows={4}
          style={{
            width: '100%', background: 'transparent',
            border: 'none', outline: 'none',
             color: 'rgba(255,255,255,0.88)',
             resize: 'none',
            ...type.cardTitle,
            boxSizing: 'border-box',
            marginBottom: 8,
          }}
        />

        {/* Thread items */}
        {threads.map((t, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', width: 24, flexShrink: 0,
            }}>
              <div style={{
                width: 1, height: 16,
                background: 'rgba(31,122,109,0.25)',
              }} />
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(31,122,109,0.10)',
                border: '1px solid rgba(31,122,109,0.25)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8, color: 'rgba(31,122,109,0.60)',
                fontWeight: 700,
              }}>
                {i + 2}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <textarea
                value={t}
                onChange={e => {
                  const next = [...threads];
                  next[i] = e.target.value;
                  setThreads(next);
                }}
                placeholder="Continue your thread..."
                rows={2}
                style={{
                  width: '100%', background: 'transparent',
                  border: 'none', outline: 'none',
                  fontSize: 14, color: 'rgba(255,255,255,0.72)',
                  lineHeight: 1.65, resize: 'none',
                  fontFamily: 'Figtree, sans-serif',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setThreads(threads.filter((_, j) => j !== i))}
                style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.25)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', padding: 0,
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {/* Annotation items */}
        {annotations.map((ann, i) => (
          <div key={ann.id} style={{
            marginTop: 16,
            border: '1px solid rgba(139,69,19,0.20)',
            borderLeft: '3px solid rgba(139,69,19,0.50)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {/* Referenced block preview */}
            <div style={{
              padding: '8px 12px',
              background: 'rgba(139,69,19,0.06)',
              borderBottom: '1px solid rgba(139,69,19,0.12)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                fontSize: 11, color: 'rgba(255,255,255,0.45)',
                overflow: 'hidden', textOverflow: 'ellipsis',
                whiteSpace: 'nowrap', flex: 1,
              }}>
                ↳ {ann.blockType}: "{ann.blockPreview}"
              </div>
              <button
                type="button"
                onClick={() => setAnnotations(annotations.filter((_, j) => j !== i))}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  cursor: 'pointer', fontSize: 14,
                  marginLeft: 8, flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>
            <textarea
              value={ann.text}
              onChange={e => {
                const next = [...annotations];
                next[i] = { ...ann, text: e.target.value };
                setAnnotations(next);
              }}
              placeholder="Your annotation on this block..."
              rows={2}
              style={{
                width: '100%', background: 'transparent',
                border: 'none', outline: 'none',
                padding: '10px 12px', fontSize: 13,
                color: 'rgba(255,255,255,0.70)',
                lineHeight: 1.65, resize: 'none',
                fontFamily: 'Figtree, sans-serif',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        {/* Comparison items */}
        {comparisons.map((cmp, i) => (
          <div key={cmp.id} style={{
            marginTop: 16,
            border: '1px solid rgba(124,58,237,0.20)',
            borderLeft: '3px solid rgba(124,58,237,0.45)',
            borderRadius: 8, overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px',
              background: 'rgba(124,58,237,0.06)',
              borderBottom: '1px solid rgba(124,58,237,0.12)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
                ↔ Comparison
              </span>
              <button
                type="button"
                onClick={() => setComparisons(comparisons.filter((_, j) => j !== i))}
                style={{
                  background: 'none', border: 'none',
                  color: 'rgba(255,255,255,0.25)',
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: 'flex' }}>
              {/* Side A — original */}
              <div style={{
                flex: 1, padding: '10px 12px',
                borderRight: '1px solid rgba(255, 255, 255, 0.14)',
              }}>
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.25)',
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  Original
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.45)',
                  fontStyle: 'italic', lineHeight: 1.5,
                }}>
                  "{cmp.blockPreview}"
                </div>
              </div>
              {/* Side B — reblogger's version */}
              <div style={{ flex: 1, padding: '10px 12px' }}>
                <div style={{
                  fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'rgba(124,58,237,0.70)',
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>
                  My version
                </div>
                <textarea
                  value={cmp.sideB}
                  onChange={e => {
                    const next = [...comparisons];
                    next[i] = { ...cmp, sideB: e.target.value };
                    setComparisons(next);
                  }}
                  placeholder="Your alternative..."
                  rows={3}
                  style={{
                    width: '100%', background: 'transparent',
                    border: 'none', outline: 'none',
                    fontSize: 13, color: 'rgba(255,255,255,0.70)',
                    resize: 'none', lineHeight: 1.6,
                    fontFamily: 'Figtree, sans-serif',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        {/* Add to thread button */}
        <button
          type="button"
          onClick={() => setThreads([...threads, ''])}
          style={{
            marginTop: 14, fontSize: 12,
            color: 'rgba(31,122,109,0.55)',
            background: 'none', border: 'none',
            cursor: 'pointer', padding: 0,
          }}
        >
          + Add to thread
        </button>
        <div style={{ fontSize: 11, marginTop: 8, color: 'rgba(255,255,255,0.18)' }}>
          Or click a block on the right to annotate or compare it →
        </div>
      </div>

      {/* Submit bar */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255, 255, 255, 0.14)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
          {annotations.length + comparisons.length > 0 && (
            `${annotations.length} annotation${annotations.length !== 1 ? 's' : ''}, ${comparisons.length} comparison${comparisons.length !== 1 ? 's' : ''}`
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: '8px 20px', borderRadius: 9999,
            background: '#1F7A6D', border: 'none',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Reblogging...' : '↻ Reblog'}
        </button>
      </div>
    </div>
  );
}

// ── OriginalPostPanel (right side) ───────────────────────────

function OriginalPostPanel({
  original, originalBlocks, onAnnotateBlock,
  onCompareBlock, annotatedBlockIds,
}: {
  original: ReblogComposerOriginal;
  originalBlocks: any[];
  onAnnotateBlock: (block: any) => void;
  onCompareBlock: (block: any) => void;
  annotatedBlockIds: string[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.14)',
        fontSize: 11, fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: 'rgba(255,255,255,0.30)',
      }}>
        Original Post
      </div>

      {/* Scrollable original */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

        {/* Title */}
        {original?.title && (
          <h3 style={{
            ...type.cardTitle,

            color: 'rgba(255,255,255,0.88)',
            margin: '0 0 10px 0',
          }}>
            {original.title}
          </h3>
        )}

        {/* Description */}
        {original?.description && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.50)',
            lineHeight: 1.65, margin: '0 0 16px 0',
          }}>
            {original.description}
          </p>
        )}

        {/* Blocks — each clickable to annotate */}
        {(originalBlocks ?? []).map((block: any, index: number) => {
          const isAnnotated = annotatedBlockIds.includes(block.id);
          return (
            <div
              key={block.id}
              style={{
                marginBottom: 16,
                border: isAnnotated
                  ? '1px solid rgba(139,69,19,0.30)'
                  : '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: 8, overflow: 'hidden',
                transition: 'border-color 0.15s',
                cursor: 'pointer',
                opacity: isAnnotated ? 0.75 : 1,
              }}
              onMouseEnter={e => {
                if (!isAnnotated) {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    'rgba(255,255,255,0.15)';
                }
              }}
              onMouseLeave={e => {
                if (!isAnnotated) {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    'rgba(255, 255, 255, 0.14)';
                }
              }}
            >
              {/* Block header */}
              <div style={{
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'rgba(255,255,255,0.30)',
                }}>
                  {block.block_type?.replace(/_/g, ' ')}
                </span>

                {/* Action buttons */}
                {!isAnnotated && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => onAnnotateBlock(block)}
                      style={{
                        fontSize: 9, padding: '2px 7px',
                        borderRadius: 4, cursor: 'pointer',
                        background: 'rgba(139,69,19,0.10)',
                        border: '1px solid rgba(139,69,19,0.25)',
                        color: '#8B4513', fontWeight: 700,
                      }}
                    >
                      ↳ Annotate
                    </button>
                    <button
                      type="button"
                      onClick={() => onCompareBlock(block)}
                      style={{
                        fontSize: 9, padding: '2px 7px',
                        borderRadius: 4, cursor: 'pointer',
                        background: 'rgba(124,58,237,0.10)',
                        border: '1px solid rgba(124,58,237,0.25)',
                        color: '#7C3AED', fontWeight: 700,
                      }}
                    >
                      ↔ Compare
                    </button>
                  </div>
                )}
                {isAnnotated && (
                  <span style={{
                    fontSize: 9,
                    color: 'rgba(139,69,19,0.60)',
                    fontWeight: 700,
                  }}>
                    ✓ Referenced
                  </span>
                )}
              </div>

              {/* Block content preview */}
              <div style={{ padding: '8px 10px' }}>
                <p style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.45)',
                  lineHeight: 1.55, margin: 0,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                } as React.CSSProperties}>
                  {block.text_content
                    || block.subheading
                    || `[${block.block_type}]`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main composer ─────────────────────────────────────────────

export function ReblogComposer({ open, onOpenChange, original, onSuccess }: ReblogComposerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const reblogForm = useForm<{ description: string }>({
    defaultValues: { description: '' },
  });

  // Thread items (tweet-chain below main comment)
  const [threads, setThreads] = useState<string[]>([]);

  // Annotation items: comment on a specific block
  const [annotations, setAnnotations] = useState<Annotation[]>([]);

  // Comparison items: original block vs reblogger's version
  const [comparisons, setComparisons] = useState<Comparison[]>([]);

  // IDs of blocks that have been annotated or compared
  const annotatedBlockIds = [
    ...annotations.map(a => a.blockId),
    ...comparisons.map(c => c.blockId),
  ];

  const [submitting, setSubmitting] = useState(false);

  // Fetch blocks of the original post for the right panel
  const { data: originalBlocks = [] } = useQuery({
    queryKey: ['reblog_original_blocks', original.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('content_blocks')
        .select('*')
        .eq('content_id', original.id)
        .order('position', { ascending: true });
      return (data ?? []) as any[];
    },
    staleTime: 120_000,
    enabled: open && !!original.id,
  });

  // ── Handlers ────────────────────────────────────────────────

  const handleAnnotateBlock = (block: any) => {
    const preview = (block.text_content || block.subheading || '').slice(0, 80);
    setAnnotations(prev => [...prev, {
      id: crypto.randomUUID(),
      blockId: block.id,
      blockType: block.block_type?.replace(/_/g, ' ') ?? 'block',
      blockPreview: preview,
      text: '',
    }]);
  };

  const handleCompareBlock = (block: any) => {
    const preview = (block.text_content || block.subheading || '').slice(0, 120);
    setComparisons(prev => [...prev, {
      id: crypto.randomUUID(),
      blockId: block.id,
      blockPreview: preview,
      sideA: preview,
      sideB: '',
      sideALabel: 'Original',
      sideBLabel: 'My version',
    }]);
  };

  const handleSubmit = async () => {
    if (!user || !profile) return;

    setSubmitting(true);
    try {
      const description = reblogForm.getValues('description') ?? '';

      const { data: newItem, error } = await supabase
        .from('content_items')
        .insert({
          creator_id: user.id,
          is_reblog: true,
          reblog_of_id: original.id,
          post_category: 'blog',
          content_type: 'Blog',
          status: 'approved',
          approved_at: new Date().toISOString(),
          difficulty: 'Any',
          ai_tools: [],
          topics: [],
          custom_tags: [],
          tags: [],
          monetisation_type: 'free',
          is_free: true,
          bounty_enabled: false,
          view_count: 0,
          download_count: 0,
        } as any)
        .select('id')
        .single();

      if (error || !newItem) throw error ?? new Error('Insert failed');

      const reblogContentId = newItem.id;

      // Insert main comment as block 1
      if (description.trim()) {
        await supabase.from('content_blocks').insert({
          content_id: reblogContentId,
          position: 1,
          block_type: 'text',
          text_content: description,
          formatting_type: 'paragraph',
          is_preview: true,
        } as any);
      }

      // Insert thread items as subsequent blocks
      let blockPosition = 2;
      for (const threadText of threads) {
        if (threadText.trim()) {
          await supabase.from('content_blocks').insert({
            content_id: reblogContentId,
            position: blockPosition,
            block_type: 'text',
            text_content: threadText,
            formatting_type: 'paragraph',
            is_preview: false,
          } as any);
          blockPosition++;
        }
      }

      // Update thread count
      const threadCount = threads.filter(t => t.trim()).length;
      if (threadCount > 0) {
        await supabase
          .from('content_items')
          .update({ reblog_thread_count: threadCount } as any)
          .eq('id', reblogContentId);
      }

      // Store annotations and comparisons as what_to_expect_blocks JSONB
      const reblogBlocks = [
        ...annotations.map(a => ({
          type: 'annotation',
          blockId: a.blockId,
          blockPreview: a.blockPreview,
          content: a.text,
        })),
        ...comparisons.map(c => ({
          type: 'comparison',
          blockId: c.blockId,
          sideA: c.sideA,
          sideB: c.sideB,
        })),
        ...threads.map((t, i) => ({
          type: 'thread',
          position: i + 1,
          content: t,
        })),
      ];

      if (reblogBlocks.length > 0) {
        await supabase
          .from('content_items')
          .update({ what_to_expect_blocks: reblogBlocks as any } as any)
          .eq('id', reblogContentId);
      }

      // Notify original creator
      if (original.creatorId && original.creatorId !== user.id) {
        await insertNotification({
          recipient_id: original.creatorId,
          actor_id: user.id,
          notification_type: 'post_reblogged',
          content_id: original.id,
          metadata: {
            reblogger_username: profile.username,
            reblog_id: reblogContentId,
            original_title: original.title,
          },
        });
      }

      qc.invalidateQueries({ queryKey: ['home_recent_blueprints'] });
      qc.invalidateQueries({ queryKey: ['reblog_count', original.id] });

      onSuccess?.(reblogContentId);
      onOpenChange(false);

      // Reset state
      reblogForm.reset();
      setThreads([]);
      setAnnotations([]);
      setComparisons([]);

      toast({
        title: 'Reblogged ✓',
        action: (
          <button
            className="text-xs underline text-primary"
            onClick={() => navigate(`/content/${reblogContentId}`)}
          >
            View it →
          </button>
        ) as any,
      });
    } catch (err: any) {
      toast({ title: 'Failed to reblog', description: err?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0"
        data-visual-slot="modal-surface"
        style={{
          maxWidth: '900px',
          width: '92vw',
          maxHeight: '88vh',
          background: '#0E0E16',
          border: '1px solid rgba(255,255,255,0.07)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex',
          height: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
        }}>

          {/* LEFT — Reblogger's contribution */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid rgba(255,255,255,0.07)',
            overflow: 'hidden',
          }}>
            <ReblogComposePanel
              form={reblogForm}
              annotations={annotations}
              setAnnotations={setAnnotations}
              comparisons={comparisons}
              setComparisons={setComparisons}
              threads={threads}
              setThreads={setThreads}
              onSubmit={handleSubmit}
              submitting={submitting}
            />
          </div>

          {/* RIGHT — Original post */}
          <div style={{
            width: '45%',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <OriginalPostPanel
              original={original}
              originalBlocks={originalBlocks}
              onAnnotateBlock={handleAnnotateBlock}
              onCompareBlock={handleCompareBlock}
              annotatedBlockIds={annotatedBlockIds}
            />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
