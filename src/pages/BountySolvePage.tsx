import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveBountyByLegacyItem } from "@/lib/bounty/resolveLegacy";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { SeoHead } from "@/components/SeoHead";
import { Skeleton } from "@/components/ui/skeleton";
import { SolutionSubmissionShell } from "@/components/bounty/SolutionSubmissionShell";
import {
  createSolutionDraft,
  updateSolutionDraft,
  submitSolution,
  deleteSolutionDraft,
} from "@/lib/bounty-solver";
import type { Solution, SlotKind } from "@/lib/bounty-solver/types";

interface SlotInfo {
  kind: SlotKind;
  id: string;
  name: string;
  missingDescription: string;
  blockType?: string;
}

export default function BountySolvePage() {
  const { slug, slotId } = useParams<{ slug: string; slotId: string }>();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();

  const slotKindFromQuery = (() => {
    if (typeof window === "undefined") return undefined;
    const k = new URLSearchParams(window.location.search).get("kind");
    return k === "stage" || k === "block" ? (k as SlotKind) : undefined;
  })();

  // Auth gate
  useEffect(() => {
    if (!isLoggedIn) {
      const here = window.location.pathname + window.location.search;
      navigate(`/auth?redirect=${encodeURIComponent(here)}`);
    }
  }, [isLoggedIn, navigate]);

  // Fetch bounty
  const { data: bounty, isLoading: loadingBounty, error: bountyErr } = useQuery({
    queryKey: ["bounty_for_solve", slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("content_items")
        .select(
          "id, slug, title, post_type, stage_grids, bounty_status, bounty_reward, bounty_deadline, bounty_acceptance_criteria, bounty_total_slots"
        )
        .eq("slug", slug!)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Bounty not found");
      if ((data as any).post_type !== "bounty") throw new Error("Not a bounty");
      return data;
    },
    enabled: !!slug,
  });

  // Resolve slot from stage_grids
  const slot: SlotInfo | null = useMemo(() => {
    if (!bounty || !slotId) return null;
    const grids = ((bounty as any).stage_grids ?? {}) as any;
    const stage = grids?.stages?.[slotId];
    const block = grids?.blocks?.[slotId];
    if (stage && (slotKindFromQuery === "stage" || !slotKindFromQuery)) {
      return {
        kind: "stage",
        id: slotId,
        name: stage.stage_name || stage.name || "Untitled stage",
        missingDescription: stage.missing_description || "",
      };
    }
    if (block) {
      return {
        kind: "block",
        id: slotId,
        name: block.name || `Untitled ${block.type ?? "block"}`,
        missingDescription: block.missing_description || "",
        blockType: block.type,
      };
    }
    return null;
  }, [bounty, slotId, slotKindFromQuery]);

  // Solution count for this slot (any non-draft submitted/accepted)
  const { data: solutionCount = 0 } = useQuery({
    queryKey: ["bounty_slot_solution_count", bounty?.id, slotId],
    queryFn: async () => {
      // NS-P50: solutions.bounty_id is a public.bounties id and this page is
      // routed on the content_items slug, so the header is resolved first. The
      // resolve is memoised for the session and the page has already made it.
      const bountyRowId = await resolveBountyByLegacyItem(bounty!.id);
      const { count } = await (supabase as any)
        .from("solutions")
        .select("id", { count: "exact", head: true })
        .eq("bounty_id", bountyRowId)
        .eq("slot_id", slotId!)
        .in("status", ["submitted", "accepted"]);
      return count ?? 0;
    },
    enabled: !!bounty?.id && !!slotId,
  });

  // Create-or-load draft
  const [draft, setDraft] = useState<Solution | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!bounty || !slot || !user?.id) return;
      setDraftLoading(true);
      try {
        const d = await createSolutionDraft({
          bountyId: bounty.id,
          slotKind: slot.kind,
          slotId: slot.id,
          solverId: user.id,
        });
        if (!cancelled) setDraft(d);
      } catch (e: any) {
        if (!cancelled) toast({ title: "Could not load draft", description: e?.message, variant: "destructive" });
      } finally {
        if (!cancelled) setDraftLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bounty, slot, user?.id, toast]);

  // Local payload + note state, hydrated from draft
  const [payload, setPayload] = useState<any>({});
  const [solverNote, setSolverNote] = useState("");
  const [isAcceptanceExpanded, setIsAcceptanceExpanded] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    if (draft) {
      setPayload(draft.content_payload ?? {});
      setSolverNote(draft.solver_note ?? "");
    }
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced autosave (800ms) for both payload + note
  const saveTimer = useRef<number | null>(null);
  const saveNow = useCallback(
    async (next: { payload?: any; note?: string }) => {
      if (!draft) return;
      try {
        await updateSolutionDraft(draft.id, {
          contentPayload: next.payload,
          solverNote: next.note,
        });
      } catch (e) {
        console.warn("[solve] autosave failed", e);
      }
    },
    [draft]
  );
  const queueAutosave = useCallback(
    (next: { payload?: any; note?: string }) => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => saveNow(next), 800);
    },
    [saveNow]
  );

  const handleNoteChange = useCallback(
    (v: string) => {
      setSolverNote(v);
      queueAutosave({ note: v });
    },
    [queueAutosave]
  );
  const handlePayloadChange = useCallback(
    (next: any) => {
      setPayload(next);
      queueAutosave({ payload: next });
    },
    [queueAutosave]
  );

  const handleSaveDraft = useCallback(async () => {
    if (!draft) return;
    try {
      await updateSolutionDraft(draft.id, {
        contentPayload: payload,
        solverNote,
      });
      toast({ title: "Draft saved" });
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    }
  }, [draft, payload, solverNote, toast]);

  const isPayloadNonEmpty = useMemo(() => {
    if (!payload) return false;
    if (typeof payload !== "object") return !!payload;
    return Object.keys(payload).length > 0;
  }, [payload]);

  const handleSubmit = useCallback(async () => {
    if (!draft) return;
    setIsSubmitting(true);
    try {
      // Persist latest before submitting
      await updateSolutionDraft(draft.id, { contentPayload: payload, solverNote });
      await submitSolution(draft.id);
      toast({ title: "Solution submitted" });
      window.dispatchEvent(
        new CustomEvent("gamification:post-xp", { detail: { xp: 30, label: "Solution submitted" } }),
      );
      navigate(`/b/${slug}`);
    } catch (e: any) {
      toast({ title: "Submit failed", description: e?.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, payload, solverNote, slug, navigate, toast]);

  const handleDiscard = useCallback(async () => {
    if (!draft) {
      navigate(`/b/${slug}`);
      return;
    }
    try {
      await deleteSolutionDraft(draft.id);
      toast({ title: "Draft discarded" });
      navigate(`/b/${slug}`);
    } catch (e: any) {
      toast({ title: "Discard failed", description: e?.message, variant: "destructive" });
    }
  }, [draft, slug, navigate, toast]);

  if (loadingBounty || draftLoading || !slot) {
    if (bountyErr) {
      return (
        <div className="py-20 px-6 text-center text-sm text-muted-foreground">
          {(bountyErr as Error).message}
        </div>
      );
    }
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const bountyMeta = {
    rewardType: "fixed",
    rewardAmount: ((bounty as any)?.bounty_reward as number) ?? 0,
    rewardCurrency: "USD",
    deadline: ((bounty as any)?.bounty_deadline as string) || "—",
    acceptanceCriteria:
      ((bounty as any)?.bounty_acceptance_criteria as string) ||
      slot.missingDescription ||
      "No acceptance criteria provided.",
    solutionCount,
  };

  return (
    <>
      <SeoHead
        title={`Solve · ${(bounty as any).title} — NeoScale`}
        description={`Submit a solution for ${slot.kind}: ${slot.name}`}
        path={`/b/${slug}/solve/${slotId}`}
        ogType="article"
      />
      <SolutionSubmissionShell
        bounty={{ id: (bounty as any).id, slug: (bounty as any).slug, title: (bounty as any).title }}
        slot={slot}
        bountyMeta={bountyMeta}
        isAcceptanceExpanded={isAcceptanceExpanded}
        onToggleAcceptance={() => setIsAcceptanceExpanded((v) => !v)}
        solverNote={solverNote}
        onSolverNoteChange={handleNoteChange}
        onSaveDraft={handleSaveDraft}
        onSubmit={handleSubmit}
        onDiscard={handleDiscard}
        isSubmitting={isSubmitting}
        canSubmit={isPayloadNonEmpty && !isSubmitting}
      >
        <SolverEditor slot={slot} payload={payload} onChange={handlePayloadChange} />
      </SolutionSubmissionShell>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Solver editor — minimal, slot-aware surface that produces a JSON payload.
// Stage slots: an inline list of blocks (name + body) that the solver can add,
// edit, reorder, remove. Block slots: a single editor for the specified type.
// ─────────────────────────────────────────────────────────────────────────────

interface SolverEditorProps {
  slot: SlotInfo;
  payload: any;
  onChange: (next: any) => void;
}

function SolverEditor({ slot, payload, onChange }: SolverEditorProps) {
  if (slot.kind === "block") {
    return <BlockSolveEditor slot={slot} payload={payload} onChange={onChange} />;
  }
  return <StageSolveEditor slot={slot} payload={payload} onChange={onChange} />;
}

function BlockSolveEditor({ slot, payload, onChange }: SolverEditorProps) {
  const blockType = slot.blockType ?? "text";
  const name = (payload?.name as string) ?? "";
  const body = (payload?.body as string) ?? "";
  const code = (payload?.code as string) ?? "";
  const language = (payload?.language as string) ?? "";

  const update = (patch: Record<string, any>) => {
    onChange({ ...(payload ?? {}), type: blockType, ...patch });
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Block type: {blockType}
      </div>
      <input
        value={name}
        onChange={(e) => update({ name: e.target.value })}
        placeholder="Block name"
        style={inputStyle}
      />
      {blockType === "code" || blockType === "prompt" ? (
        <>
          {blockType === "code" && (
            <input
              value={language}
              onChange={(e) => update({ language: e.target.value })}
              placeholder="Language (e.g. typescript)"
              style={inputStyle}
            />
          )}
          <textarea
            value={code || body}
            onChange={(e) =>
              blockType === "code" ? update({ code: e.target.value }) : update({ body: e.target.value })
            }
            placeholder={blockType === "code" ? "Paste code…" : "Write your prompt…"}
            style={{ ...textareaStyle, fontFamily: "ui-monospace, SFMono-Regular, monospace" }}
          />
        </>
      ) : (
        <textarea
          value={body}
          onChange={(e) => update({ body: e.target.value })}
          placeholder="Block content"
          style={textareaStyle}
        />
      )}
    </div>
  );
}

interface SolveBlock {
  id: string;
  name: string;
  type: string;
  body: string;
}

function StageSolveEditor({ payload, onChange }: SolverEditorProps) {
  const blocks: SolveBlock[] = Array.isArray(payload?.blocks) ? payload.blocks : [];

  const setBlocks = (next: SolveBlock[]) => onChange({ ...(payload ?? {}), blocks: next });

  const addBlock = () => {
    const id =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setBlocks([...blocks, { id, name: "", type: "text", body: "" }]);
  };
  const updateBlock = (id: string, patch: Partial<SolveBlock>) =>
    setBlocks(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlock = (id: string) => setBlocks(blocks.filter((b) => b.id !== id));
  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Stage solution — add blocks in order
      </div>

      {blocks.length === 0 && (
        <div style={{ fontFamily: "Figtree, sans-serif", fontSize: 12, fontStyle: "italic", color: "rgba(255,255,255,0.40)", padding: "16px 0" }}>
          No blocks yet. Click "Add block" to begin building this stage.
        </div>
      )}

      {blocks.map((b, i) => (
        <div
          key={b.id}
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "0.5px solid rgba(255,255,255,0.08)",
            borderRadius: 8,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "Figtree, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}>
              Block {i + 1}
            </span>
            <select
              value={b.type}
              onChange={(e) => updateBlock(b.id, { type: e.target.value })}
              style={{ ...inputStyle, padding: "4px 8px", flex: "0 0 auto" }}
            >
              <option value="text">text</option>
              <option value="prompt">prompt</option>
              <option value="code">code</option>
              <option value="note">note</option>
              <option value="result">result</option>
              <option value="tool">tool</option>
            </select>
            <div style={{ flex: 1 }} />
            <button onClick={() => move(b.id, -1)} disabled={i === 0} style={miniBtn}>↑</button>
            <button onClick={() => move(b.id, 1)} disabled={i === blocks.length - 1} style={miniBtn}>↓</button>
            <button onClick={() => removeBlock(b.id)} style={{ ...miniBtn, color: "rgba(239,68,68,0.85)" }}>
              Remove
            </button>
          </div>
          <input
            value={b.name}
            onChange={(e) => updateBlock(b.id, { name: e.target.value })}
            placeholder="Block name"
            style={inputStyle}
          />
          <textarea
            value={b.body}
            onChange={(e) => updateBlock(b.id, { body: e.target.value })}
            placeholder="Block content…"
            style={textareaStyle}
          />
        </div>
      ))}

      <button
        onClick={addBlock}
        style={{
          alignSelf: "flex-start",
          fontFamily: "Figtree, sans-serif",
          fontSize: 12,
          fontWeight: 600,
          padding: "6px 14px",
          borderRadius: 6,
          border: "0.5px solid rgba(46,196,182,0.40)",
          background: "rgba(46,196,182,0.10)",
          color: "#2EC4B6",
          cursor: "pointer",
        }}
      >
        + Add block
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 6,
  border: "0.5px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.90)",
  fontFamily: "Figtree, sans-serif",
  fontSize: 13,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 100,
  padding: "8px 10px",
  borderRadius: 6,
  border: "0.5px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.90)",
  fontFamily: "Figtree, sans-serif",
  fontSize: 13,
  outline: "none",
  resize: "vertical",
};

const miniBtn: React.CSSProperties = {
  fontFamily: "Figtree, sans-serif",
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 4,
  border: "0.5px solid rgba(255,255,255,0.10)",
  background: "transparent",
  color: "rgba(255,255,255,0.75)",
  cursor: "pointer",
};
