import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ChevronUp, ChevronDown, Trash2, Plus, CheckCircle2 } from "lucide-react";

const DIFFICULTY_RANGES = [
  "Beginner only",
  "Beginner to Intermediate",
  "Intermediate to Advanced",
  "Beginner to Advanced",
];

interface PathStep {
  contentId: string;
  contentTitle: string;
  stepLabel: string;
  stepNote: string;
}

export function LearningPathUploadForm() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficultyRange, setDifficultyRange] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [steps, setSteps] = useState<PathStep[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch user's approved content for step selector
  const { data: myContent } = useQuery({
    queryKey: ["my_approved_content", profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, content_type")
        .eq("creator_id", profile!.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  function addStep(contentId: string) {
    if (steps.length >= 20) return;
    const item = myContent?.find((c) => c.id === contentId);
    if (!item || steps.some((s) => s.contentId === contentId)) return;
    setSteps([...steps, { contentId, contentTitle: item.title, stepLabel: "", stepNote: "" }]);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx));
  }

  function moveStep(idx: number, dir: "up" | "down") {
    const arr = [...steps];
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    setSteps(arr);
  }

  function updateStep(idx: number, field: "stepLabel" | "stepNote", value: string) {
    const arr = [...steps];
    arr[idx] = { ...arr[idx], [field]: value };
    setSteps(arr);
  }

  async function handleSubmit() {
    if (!title.trim() || !description.trim() || !difficultyRange) {
      toast({ title: "Fill in required fields", variant: "destructive" });
      return;
    }
    if (steps.length < 3) {
      toast({ title: "Add at least 3 steps", variant: "destructive" });
      return;
    }
    if (!profile) return;
    setSubmitting(true);
    try {
      const { data: pathRow, error } = await supabase
        .from("learning_paths")
        .insert({
          creator_id: profile.id,
          title: title.trim(),
          description: description.trim(),
          difficulty_range: difficultyRange,
          estimated_time_minutes: estimatedTime ? parseInt(estimatedTime) : null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error || !pathRow) throw error;

      // Insert steps
      const stepInserts = steps.map((s, i) => ({
        path_id: pathRow.id,
        content_id: s.contentId,
        position: i + 1,
        step_label: s.stepLabel.trim() || null,
        step_note: s.stepNote.trim() || null,
      }));
      const { error: stepError } = await supabase.from("learning_path_steps").insert(stepInserts);
      if (stepError) throw stepError;

      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err?.message, variant: "destructive" });
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4 py-12">
        <CheckCircle2 className="h-12 w-12 text-secondary" />
        <h2 className="text-xl font-bold text-foreground">Learning Path Submitted</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your learning path has been submitted for review. We'll get back to you within 48 hours.
        </p>
        <Button variant="outline" onClick={() => navigate("/browse?tab=paths")}>Browse Paths</Button>
      </div>
    );
  }

  const availableContent = (myContent ?? []).filter((c) => !steps.some((s) => s.contentId === c.id));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Path title *</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 100))}
          placeholder="E.g. Getting started with AI agents"
          className="bg-card border-border rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 300))}
          placeholder="What will learners achieve by completing this path?"
          className="bg-card border-border rounded-xl min-h-[80px]"
        />
        <p className="text-[10px] text-muted-foreground">{description.length}/300</p>
      </div>

      <div className="space-y-2">
        <Label>Difficulty range *</Label>
        <Select value={difficultyRange} onValueChange={setDifficultyRange}>
          <SelectTrigger className="bg-card border-border rounded-xl">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {DIFFICULTY_RANGES.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Estimated time (minutes, optional)</Label>
        <Input
          type="number"
          value={estimatedTime}
          onChange={(e) => setEstimatedTime(e.target.value)}
          placeholder="E.g. 45"
          className="bg-card border-border rounded-xl w-32"
          min={1}
        />
      </div>

      {/* Step builder */}
      <div className="space-y-3">
        <Label>Steps ({steps.length}/20) — minimum 3</Label>

        {steps.map((step, idx) => (
          <div key={step.contentId} className="border border-border rounded-xl p-3 bg-card">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-secondary/20 text-secondary flex items-center justify-center text-xs font-bold shrink-0">
                {idx + 1}
              </span>
              <p className="text-sm font-medium text-foreground flex-1 truncate">{step.contentTitle}</p>
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => moveStep(idx, "up")} disabled={idx === 0} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button onClick={() => moveStep(idx, "down")} disabled={idx === steps.length - 1} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
                <button onClick={() => removeStep(idx)} className="p-1 text-destructive hover:text-destructive/80"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Input
                value={step.stepLabel}
                onChange={(e) => updateStep(idx, "stepLabel", e.target.value)}
                placeholder="Label (e.g. Start here)"
                className="h-8 text-xs bg-accent border-border"
              />
              <Input
                value={step.stepNote}
                onChange={(e) => updateStep(idx, "stepNote", e.target.value.slice(0, 200))}
                placeholder="Note (optional)"
                className="h-8 text-xs bg-accent border-border"
              />
            </div>
          </div>
        ))}

        {/* Add step selector */}
        {steps.length < 20 && availableContent.length > 0 && (
          <Select onValueChange={addStep}>
            <SelectTrigger className="bg-card border-border border-dashed rounded-xl">
              <SelectValue placeholder="+ Add a step from your posts" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              {availableContent.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="text-xs">{c.title}</span>
                  <span className="text-[10px] text-muted-foreground ml-2">({c.content_type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {availableContent.length === 0 && steps.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            You need approved content to create a learning path. Upload some content first.
          </p>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || steps.length < 3 || !title.trim() || !description.trim() || !difficultyRange}
        className="w-full"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Submit Learning Path
      </Button>
    </div>
  );
}
