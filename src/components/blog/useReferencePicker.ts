import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ReferenceType,
  ResultItem,
  BlueprintResult,
  StageResult,
  BlockResult,
} from './ReferencePickerModal';
import { queryBlueprints } from '@/lib/discover/queryBlueprints';
import { queryStages } from '@/lib/discover/queryStages';
import { queryBlocks } from '@/lib/discover/queryBlocks';
import { supabase } from '@/integrations/supabase/client';

const BLOCK_TYPE_COLORS: Record<string, string> = {
  prompt: '#E8571A',
  output: '#2EC4B6',
  text: '#9CA3AF',
  image: '#F59E0B',
  code: '#A78BFA',
  data: '#60A5FA',
  decision: '#F472B6',
  variable: '#34D399',
};

function colorFor(type: string): string {
  return BLOCK_TYPE_COLORS[type?.toLowerCase()] ?? '#9CA3AF';
}

function fmtCount(n: number | null | undefined): string {
  if (!n) return '0';
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  if (n < 1_000_000) return Math.round(n / 1000) + 'k';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Cached counts across all three types — fetched once per modal-open session. */
export function useReferenceCounts(isOpen: boolean) {
  return useQuery({
    queryKey: ['ref_picker_counts'],
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const blueprintsP = supabase
        .from('content_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .in('post_type', ['blueprint', 'bounty']);

      const stageAggP = supabase
        .from('content_items')
        .select('stage_count')
        .eq('status', 'approved')
        .in('post_type', ['blueprint', 'bounty']);

      const blocksP = supabase
        .from('content_blocks')
        .select('id', { count: 'exact', head: true });

      const [bp, st, bl] = await Promise.all([blueprintsP, stageAggP, blocksP]);
      const blueprints = bp.count ?? 0;
      const stages = (st.data ?? []).reduce(
        (s, r: any) => s + (Number(r.stage_count) || 0),
        0,
      );
      const blocks = bl.count ?? 0;
      return {
        blueprints: fmtCount(blueprints),
        stages: fmtCount(stages),
        blocks: fmtCount(blocks),
      };
    },
  });
}

/** Live results for the active type tab. Debounces query 200ms. */
export function useReferenceResults(
  isOpen: boolean,
  activeType: ReferenceType,
  rawQuery: string,
): { results: ResultItem[]; isLoading: boolean } {
  const debounced = useDebounced(rawQuery, 200);

  const { data, isLoading } = useQuery({
    queryKey: ['ref_picker_results', activeType, debounced],
    enabled: isOpen,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ResultItem[]> => {
      if (activeType === 'blueprints') {
        const out: BlueprintResult[] = [];
        // Fetch blueprints + bounties: two passes (queryBlueprints scopes by single postType)
        const [bp, bo] = await Promise.all([
          queryBlueprints({ query: debounced, postType: 'blueprint', limit: 15 }),
          queryBlueprints({ query: debounced, postType: 'bounty', limit: 5 }),
        ]);
        for (const r of [...bp.rows, ...bo.rows].slice(0, 20)) {
          out.push({
            type: 'blueprint',
            id: r.id,
            title: r.title,
            useCase: r.description ?? r.use_cases?.[0] ?? '',
            authorAvatar: r.author?.avatar_url ?? '',
            blockTypes: (r.ai_tools ?? [])
              .slice(0, 4)
              .map((t: string) => ({ color: colorFor(t) })),
          });
        }
        return out;
      }
      if (activeType === 'stages') {
        const res = await queryStages({
          query: debounced,
          postType: undefined,
          limit: 20,
        });
        return res.rows.map<StageResult>((r) => ({
          type: 'stage',
          id: r.stage.id,
          name: r.stage.name,
          blueprintTitle: r.parent.blueprintTitle,
          blueprintId: r.parent.blueprintId,
          blockCount: r.blockCount,
          connectionCount: r.connectionCount,
        }));
      }
      // blocks
      const res = await queryBlocks({
        query: debounced,
        postType: undefined,
        limit: 20,
      });
      return res.rows.map<BlockResult>((r) => ({
        type: 'block',
        id: r.block.id,
        name: r.block.name ?? r.block.content?.slice(0, 60) ?? null,
        stageName: r.parent.stageName,
        blueprintTitle: r.parent.blueprintTitle,
        blueprintId: r.parent.blueprintId,
        blockType: r.block.type,
        blockTypeColor: colorFor(r.block.type),
      }));
    },
  });

  return { results: data ?? [], isLoading };
}
