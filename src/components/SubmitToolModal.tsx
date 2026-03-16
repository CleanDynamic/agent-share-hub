import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2 } from "lucide-react";

const CATEGORIES = [
  { value: "ai_chat", label: "AI Chat" },
  { value: "automation", label: "Automation" },
  { value: "image", label: "Image Generation" },
  { value: "voice", label: "Voice" },
  { value: "code", label: "Code" },
  { value: "other", label: "Other" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubmitToolModal({ open, onOpenChange }: Props) {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState("");

  async function checkDuplicate(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) { setDuplicateMsg(""); return; }
    const { data } = await supabase
      .from("ai_tools_registry" as any)
      .select("name, status")
      .ilike("name", trimmed);
    const match = (data as any[] | null)?.find(
      (r: any) => r.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (match) {
      setDuplicateMsg(
        match.status === "approved"
          ? "This tool is already in our list."
          : "This tool has already been submitted and is under review."
      );
    } else {
      setDuplicateMsg("");
    }
  }

  function handleNameChange(val: string) {
    const clean = val.replace(/[^a-zA-Z0-9 .\-]/g, "").slice(0, 50);
    setName(clean);
    checkDuplicate(clean);
  }

  async function handleSubmit() {
    if (!isLoggedIn) {
      navigate("/signup?after_submit=tool");
      onOpenChange(false);
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName || !website.trim() || !description.trim() || !category || !confirmed) return;
    if (!website.trim().startsWith("https://")) {
      toast({ title: "Website must start with https://", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSubmitting(false); return; }

    const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const { error } = await supabase.from("ai_tools_registry" as any).insert({
      name: trimmedName,
      slug,
      description: description.trim(),
      website_url: website.trim(),
      category,
      submitted_by: user.id,
    } as any);

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "This tool already exists or is pending review." });
      } else {
        toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
      }
      return;
    }

    setSuccess(true);
  }

  function handleClose() {
    onOpenChange(false);
    // Reset after animation
    setTimeout(() => {
      setName(""); setWebsite(""); setDescription(""); setCategory("");
      setConfirmed(false); setSuccess(false); setDuplicateMsg("");
    }, 300);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        {success ? (
          <div className="flex flex-col items-center text-center gap-4 py-6">
            <CheckCircle2 className="h-10 w-10 text-primary" />
            <DialogTitle className="text-lg font-bold text-foreground">Thanks!</DialogTitle>
            <p className="text-sm text-muted-foreground max-w-sm">
              We'll verify <span className="font-medium text-foreground">{name}</span> and add it to the list if it checks out. This usually takes 1–3 days.
            </p>
            <Button onClick={handleClose} className="mt-2">Done</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">Submit an AI Tool</DialogTitle>
              <DialogDescription>
                Know a tool that's missing from our list? Submit it for review.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Tool name */}
              <div className="space-y-1.5">
                <Label htmlFor="tool-name">Tool name *</Label>
                <Input
                  id="tool-name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Perplexity"
                  className="bg-background border-border rounded-xl"
                />
                {duplicateMsg && (
                  <p className="text-xs text-destructive">{duplicateMsg}</p>
                )}
              </div>

              {/* Website */}
              <div className="space-y-1.5">
                <Label htmlFor="tool-website">Tool website *</Label>
                <Input
                  id="tool-website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="bg-background border-border rounded-xl"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="tool-desc">What it does *</Label>
                <Input
                  id="tool-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 120))}
                  placeholder="AI-powered search engine with citations"
                  maxLength={120}
                  className="bg-background border-border rounded-xl"
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/120</p>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-background border-border rounded-xl">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Confirmation checkbox */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="tool-confirm"
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                />
                <Label htmlFor="tool-confirm" className="text-xs text-muted-foreground font-normal cursor-pointer">
                  I have used this tool myself
                </Label>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={
                  submitting || !name.trim() || !website.trim() || !description.trim() || !category || !confirmed || !!duplicateMsg
                }
                className="w-full"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Submit for review
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
