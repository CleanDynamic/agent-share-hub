import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, X, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { insertNotification } from "@/lib/notifications";
import {
  GEN1_BOUNTY_RESPONSES_ENABLED,
  assertGen1BountyResponsesEnabled,
} from "@/lib/bounty-gen1/flags";

const TESTED_ON_OPTIONS = ["Any Tool", "ChatGPT", "Claude", "Gemini", "Grok", "Make", "Zapier", "n8n", "Other"];

interface Props {
  bountyContentId: string;
  bountyTitle: string;
  bountyCreatorId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

type SourceMode = "link" | "write";

function BountyResponseComposerImpl({ bountyContentId, bountyTitle, bountyCreatorId, onClose, onSubmitted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sourceMode, setSourceMode] = useState<SourceMode>("write");
  const [howItFixes, setHowItFixes] = useState("");
  const [testedOn, setTestedOn] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Link mode
  const [bpSearch, setBpSearch] = useState("");
  const [selectedBpId, setSelectedBpId] = useState<string | null>(null);
  const [selectedBpTitle, setSelectedBpTitle] = useState<string | null>(null);

  // Write mode (inline)
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineText, setInlineText] = useState("");

  // Fetch user's published Blueprints for link mode
  const { data: myBlueprints } = useQuery({
    queryKey: ["my_blueprints", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_items")
        .select("id, title, content_type")
        .eq("creator_id", user!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      return (data ?? []) as { id: string; title: string; content_type: string }[];
    },
    enabled: !!user?.id && sourceMode === "link",
  });

  const filteredBps = (myBlueprints ?? []).filter((bp) =>
    bpSearch.trim() === "" || bp.title.toLowerCase().includes(bpSearch.toLowerCase())
  );

  function toggleTool(tool: string) {
    setTestedOn((prev) => prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]);
  }

  const canSubmit = (() => {
    if (!howItFixes.trim()) return false;
    if (sourceMode === "link") return !!selectedBpId;
    return inlineTitle.trim().length > 0 && inlineText.trim().length > 0;
  })();

  async function handleSubmit() {
    if (!user || !canSubmit) return;
    setSubmitting(true);
    try {
      // NS-P44 — the generation-1 write gate. First statement inside the try so
      // a frozen submit surfaces as the same toast any other failure would,
      // rather than as an unhandled rejection.
      assertGen1BountyResponsesEnabled();

      const inlineBlocks = sourceMode === "write" && inlineText.trim()
        ? [{ position: 1, block_type: "text", formatting_type: "paragraph", text_content: inlineText.trim() }]
        : null;

      const { error } = await supabase.from("bounty_responses" as any).insert({
        bounty_content_id: bountyContentId,
        responder_id: user.id,
        blueprint_content_id: sourceMode === "link" ? selectedBpId : null,
        inline_title: sourceMode === "write" ? inlineTitle.trim() || null : null,
        inline_blocks: inlineBlocks,
        how_it_fixes: howItFixes.trim(),
        tested_on: testedOn.length > 0 ? testedOn : null,
      } as any);

      if (error) throw error;

      // Notify bounty poster
      await insertNotification({
        recipient_id: bountyCreatorId,
        actor_id: user.id,
        notification_type: "bounty_response",
        content_id: bountyContentId,
        metadata: { bounty_title: bountyTitle, responder_username: user.email },
      });

      toast({ title: "Blueprint submitted. Good luck! ★" });
      onSubmitted();
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet/Modal */}
      <div
        className="relative w-full sm:max-w-xl bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-y-auto"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border bg-card z-10">
          <div>
            <p className="text-base font-bold text-foreground">Submit your Blueprint</p>
            <p className="text-xs text-muted-foreground mt-0.5">Responses must directly address the failure. Generic prompts will be downvoted.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/40 transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* SECTION 1 — Blueprint Source */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Blueprint source</Label>
            <div className="grid grid-cols-2 gap-3">
              {(["link", "write"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSourceMode(mode)}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border-2 transition-colors text-left ${
                    sourceMode === mode ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"
                  }`}
                >
                  <span className="text-base">{mode === "link" ? "🔗" : "✏️"}</span>
                  <p className="text-xs font-semibold text-foreground">
                    {mode === "link" ? "Link an existing Blueprint" : "Write a new one"}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Link mode — search published blueprints */}
          {sourceMode === "link" && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={bpSearch}
                  onChange={(e) => setBpSearch(e.target.value)}
                  placeholder="Search your published Blueprints..."
                  className="pl-8 bg-background border-border rounded-xl text-sm"
                />
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {filteredBps.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No published Blueprints found.</p>
                )}
                {filteredBps.map((bp) => (
                  <button
                    key={bp.id}
                    type="button"
                    onClick={() => { setSelectedBpId(bp.id); setSelectedBpTitle(bp.title); }}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors ${
                      selectedBpId === bp.id ? "bg-primary/10 text-primary" : "hover:bg-muted/30 text-foreground"
                    }`}
                  >
                    <span className="font-medium truncate">{bp.title}</span>
                    <span className="ml-auto text-muted-foreground shrink-0">{bp.content_type}</span>
                  </button>
                ))}
              </div>
              {selectedBpTitle && (
                <p className="text-xs text-primary">Selected: {selectedBpTitle}</p>
              )}
            </div>
          )}

          {/* Write mode — inline mini blueprint */}
          {sourceMode === "write" && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Blueprint title (required)</Label>
                <div className="relative">
                  <Input
                    value={inlineTitle}
                    onChange={(e) => setInlineTitle(e.target.value.slice(0, 80))}
                    placeholder="Short, descriptive title for your fix..."
                    className="bg-background border-border rounded-xl pr-14 text-sm"
                    maxLength={80}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{inlineTitle.length}/80</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Blueprint content (required)</Label>
                <Textarea
                  value={inlineText}
                  onChange={(e) => setInlineText(e.target.value)}
                  placeholder="Paste your prompt, workflow, or fix here..."
                  className="bg-background border-border rounded-xl text-sm min-h-[100px] resize-none"
                />
              </div>
            </div>
          )}

          {/* SECTION 2 — How it fixes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">How this fixes it <span className="text-red-400">*</span></Label>
              <span className="text-[10px] text-muted-foreground">{howItFixes.length}/280</span>
            </div>
            <Textarea
              value={howItFixes}
              onChange={(e) => setHowItFixes(e.target.value.slice(0, 280))}
              placeholder="Explain specifically how your Blueprint solves this failure. What does it do differently? Why will it work?"
              className="bg-background border-border rounded-xl text-sm min-h-[80px] resize-none"
              maxLength={280}
            />
          </div>

          {/* SECTION 3 — Tested on */}
          <div className="space-y-2">
            <div>
              <Label className="text-sm font-semibold">I've tested this on:</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Only check tools you've actually verified this works on.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {TESTED_ON_OPTIONS.map((tool) => (
                <button
                  key={tool}
                  type="button"
                  onClick={() => toggleTool(tool)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    testedOn.includes(tool)
                      ? "bg-primary/15 text-primary border-primary/30"
                      : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
                  }`}
                >
                  {tool}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full h-11 rounded-xl text-sm font-semibold"
            style={{ background: canSubmit ? "#8B4513" : undefined }}
          >
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting…</> : "Submit Blueprint"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * NS-P44 — the generation-1 authoring gate, at the component boundary.
 *
 * The implementation above is left whole: every hook, every field, every
 * branch of it still compiles and still works, which is what makes the
 * rollback in src/lib/bounty-gen1/flags.ts real rather than notional. What
 * changes while GEN1_BOUNTY_RESPONSES_ENABLED is false is that mounting this
 * component renders nothing at all — so the composer cannot be opened even by
 * a call site that has not been guarded, or one added after the freeze.
 *
 * The wrapper exists rather than an early return inside the implementation
 * because the implementation calls hooks; returning before them would make the
 * hook order conditional. Here there are no hooks to skip.
 */
export function BountyResponseComposer(props: Props) {
  if (!GEN1_BOUNTY_RESPONSES_ENABLED) return null;
  return <BountyResponseComposerImpl {...props} />;
}
