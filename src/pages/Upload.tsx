import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { SubmitToolModal } from "@/components/SubmitToolModal";
import { ContentBlockBuilder, emptyBlock, type ContentBlock } from "@/components/ContentBlockBuilder";

const CONTENT_TYPES = [
  "Prompt File", "Prompt Tutorial", "Agent Blueprint", "Workflow Template",
  "Agent Stack", "Model Config Guide", "Integration Guide", "Evaluation Framework", "Failure Library",
];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance"];
const ACCEPTED_TYPES = [".txt", ".md", ".json", ".pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content_type: z.string().min(1, "Select a content type"),
  description: z.string().trim().min(1, "Description is required").max(120, "Max 120 characters"),
  difficulty: z.string().min(1, "Select a difficulty level"),
  ai_tools: z.array(z.string()).min(1, "Select at least one AI tool"),
  use_cases: z.array(z.string()),
  use_instructions: z.string().trim().min(1, "Instructions are required").max(5000),
  what_to_expect: z.string().trim().min(1, "This field is required").max(2000),
  monetisation_type: z.enum(["free", "paid", "donation"]),
  price_gbp: z.coerce.number().min(1, "Minimum price is £1").optional(),
  donation_enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;


const Upload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([emptyBlock("text")]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitToolOpen, setSubmitToolOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      content_type: "",
      description: "",
      difficulty: "",
      ai_tools: [],
      use_cases: [],
      use_instructions: "",
      what_to_expect: "",
      monetisation_type: "free",
      price_gbp: undefined,
      donation_enabled: false,
    },
  });

  const monetisationType = form.watch("monetisation_type");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError("");
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = "." + f.name.split(".").pop()?.toLowerCase();
    if (!ACCEPTED_TYPES.includes(ext)) {
      setFileError("Only .txt, .md, .json, and .pdf files are accepted.");
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError("File must be under 10MB.");
      return;
    }
    setFile(f);
  }

  async function onSubmit(values: FormValues) {
    if (!file) {
      setFileError("Please upload a file.");
      return;
    }

    setSubmitting(true);

    try {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in before uploading.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("content-files")
        .upload(filePath, file);

      if (uploadError) {
        toast({ title: "File upload failed", description: "Please try again.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      // Insert content_items row
      const { error: insertError } = await supabase.from("content_items").insert({
        creator_id: user.id,
        title: values.title,
        content_type: values.content_type,
        description: values.description,
        difficulty: values.difficulty,
        ai_tools: values.ai_tools,
        use_cases: values.use_cases,
        file_url: filePath,
        use_instructions: values.use_instructions,
        what_to_expect: values.what_to_expect,
        status: "pending",
        monetisation_type: values.monetisation_type,
        price_gbp: values.monetisation_type === "paid" ? values.price_gbp ?? null : null,
        donation_enabled: values.donation_enabled,
      });

      if (insertError) {
        toast({ title: "Submission failed", description: insertError.message, variant: "destructive" });
        setSubmitting(false);
        return;
      }

      setSuccess(true);
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="py-20 px-6 flex flex-col items-center justify-center text-center gap-4">
        <CheckCircle2 className="h-12 w-12 text-secondary" />
        <h2 className="text-xl font-bold text-foreground">Submission Received</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your submission has been received. We will review it and get back to you within 48 hours.
        </p>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" onClick={() => navigate("/browse")}>Browse Content</Button>
          <Button onClick={() => { setSuccess(false); form.reset(); setFile(null); }}>Upload Another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 px-6">
      <SeoHead title="Upload — NeoScale AI" description="Share your AI assistants, blueprints and workflows with the community." path="/upload" />
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Share Your Work</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All submissions are reviewed and tested before going live. We aim to respond within 48 hours.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 1. Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="E.g. Email Summariser" className="bg-card border-border rounded-xl" {...field} />
                  </FormControl>
                  <FormDescription>Give it a clear name. E.g. 'Email Summariser' or 'Daily Tweet Writer'</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 2. Content Type */}
            <FormField
              control={form.control}
              name="content_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-card border-border rounded-xl">
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border">
                      {CONTENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Not sure? Prompt File is the simplest. Blueprint includes setup steps.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 3. Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>One-line description</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Turns your AI into a specialist that…"
                      maxLength={120}
                      className="bg-card border-border rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe what it does in plain English. Start with a verb. Max 120 characters.
                    <span className="ml-2 text-muted-foreground">{field.value.length}/120</span>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 4. Difficulty */}
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Difficulty</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-card border-border rounded-xl">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-border">
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Beginner = anyone can use this immediately. Advanced = multiple tools required.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 5. AI Tools (checkboxes) */}
            <FormField
              control={form.control}
              name="ai_tools"
              render={() => (
                <FormItem>
                  <FormLabel>AI Tools Required</FormLabel>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                    {AI_TOOLS.map((tool) => (
                      <FormField
                        key={tool}
                        control={form.control}
                        name="ai_tools"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(tool)}
                                onCheckedChange={(checked) => {
                                  field.onChange(
                                    checked
                                      ? [...(field.value ?? []), tool]
                                      : (field.value ?? []).filter((v) => v !== tool)
                                  );
                                }}
                              />
                            </FormControl>
                            <Label className="text-xs text-foreground font-normal cursor-pointer">{tool}</Label>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  {/* Suggest a tool */}
                  <button type="button" onClick={() => setSubmitToolOpen(true)} className="text-xs text-primary hover:underline mt-2">
                    Don't see your AI tool? Submit it →
                  </button>
                  <FormDescription>Tick every tool you have tested this with. Tick 'Any Tool' if it works everywhere.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 6. Use Case Tags (pills) */}
            <FormField
              control={form.control}
              name="use_cases"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Use Case Tags</FormLabel>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {USE_CASES.map((uc) => {
                      const selected = field.value.includes(uc);
                      return (
                        <button
                          key={uc}
                          type="button"
                          onClick={() =>
                            field.onChange(
                              selected
                                ? field.value.filter((v) => v !== uc)
                                : [...field.value, uc]
                            )
                          }
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            selected
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
                          }`}
                        >
                          {uc}
                        </button>
                      );
                    })}
                  </div>
                  <FormDescription>Select all that apply. This helps people find your content.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 7. File Upload */}
            <div className="space-y-2">
              <Label>File Upload</Label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-xl bg-card cursor-pointer hover:border-primary/40 transition-colors">
                <UploadIcon className="h-6 w-6 text-muted-foreground mb-2" />
                {file ? (
                  <span className="text-sm text-foreground">{file.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Click to select a file</span>
                )}
                <span className="text-[10px] text-muted-foreground mt-1">.txt, .md, .json, .pdf — max 10MB</span>
                <input
                  type="file"
                  accept=".txt,.md,.json,.pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-muted-foreground">
                Upload the actual file. .txt and .md work for prompt files. .json for workflows.
              </p>
              {fileError && <p className="text-sm font-medium text-destructive">{fileError}</p>}
            </div>

            {/* 8. Use Instructions */}
            <FormField
              control={form.control}
              name="use_instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Use Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder={"1. Open ChatGPT.\n2. Paste the file content into the message box.\n3. Type your first instruction."}
                      className="bg-card border-border rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Number each step. Write as if explaining to someone who has never used AI.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 9. What to expect */}
            <FormField
              control={form.control}
              name="what_to_expect"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What to Expect</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Describe what a good output looks like so the user knows it worked."
                      className="bg-card border-border rounded-xl"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe what a good output looks like so the user knows it worked.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monetisation */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monetisation</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Optional — free by default</p>
              </div>

              {/* Free / Paid toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Free download</p>
                    <p className="text-xs text-muted-foreground">Anyone can download for free</p>
                  </div>
                  <Switch
                    checked={monetisationType === "free"}
                    onCheckedChange={(checked) =>
                      form.setValue("monetisation_type", checked ? "free" : "paid")
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Paid download</p>
                    <p className="text-xs text-muted-foreground">Set a price in GBP</p>
                  </div>
                  <Switch
                    checked={monetisationType === "paid"}
                    onCheckedChange={(checked) =>
                      form.setValue("monetisation_type", checked ? "paid" : "free")
                    }
                  />
                </div>

                {monetisationType === "paid" && (
                  <FormField
                    control={form.control}
                    name="price_gbp"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground font-medium">£</span>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min="1"
                              placeholder="4.99"
                              className="bg-background border-border rounded-xl w-32"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-sm text-foreground">Donation button</p>
                    <p className="text-xs text-muted-foreground">Add a tip button so readers can support your work</p>
                  </div>
                  <FormField
                    control={form.control}
                    name="donation_enabled"
                    render={({ field }) => (
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Submit for Review"
              )}
            </Button>
          </form>
        </Form>
      </div>

      <SubmitToolModal open={submitToolOpen} onOpenChange={setSubmitToolOpen} />
    </div>
  );
};

export default Upload;
