import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, FileText, FolderOpen, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectUploadForm } from "@/components/ProjectUploadForm";
import { RevenueSplitPicker, type RevenueSplit } from "@/components/RevenueSplitPicker";
import { CollabInvitePicker, type CollabInvitee } from "@/components/CollabInvitePicker";
import { useToast } from "@/hooks/use-toast";
import { useApprovedToolNames } from "@/hooks/useApprovedTools";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MentionInput } from "@/components/MentionInput";
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
// LearningPathUploadForm removed from UI
import { DependencyPicker, type Dependency } from "@/components/DependencyPicker";
import { useMicrotagDefinitions } from "@/hooks/useMicrotags";
import { ORDERED_CONTENT_TYPES, DIFFICULTIES as DIFF_LIST, ANY_DIFFICULTY_TYPES, displayContentType } from "@/lib/content-types";

const CONTENT_TYPES = ORDERED_CONTENT_TYPES;
const DIFFICULTIES = [...DIFF_LIST, "Any"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];
const ACCEPTED_TYPES = [".txt", ".md", ".json", ".pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content_type: z.string().min(1, "Select a content type"),
  description: z.string().trim().min(1, "Description is required").max(500, "Max 500 characters"),
  difficulty: z.string().min(1, "Select a difficulty level"),
  ai_tools: z.array(z.string()).min(1, "Select at least one AI tool"),
  use_cases: z.array(z.string()),
  use_instructions: z.string().trim().max(5000).optional().or(z.literal("")),
  what_to_expect: z.string().trim().max(2000).optional().or(z.literal("")),
  monetisation_type: z.enum(["free", "paid", "donation"]),
  price_gbp: z.coerce.number().min(1, "Minimum price is £1").optional(),
  donation_enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;


const Upload = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const [uploadType, setUploadType] = useState<"single" | "project">("single");
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([emptyBlock("text")]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitToolOpen, setSubmitToolOpen] = useState(false);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [revenueSplits, setRevenueSplits] = useState<RevenueSplit[]>([]);
  const [collabInvitees, setCollabInvitees] = useState<CollabInvitee[]>([]);
  const [pwywFloor, setPwywFloor] = useState<number>(0);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [toolUrl, setToolUrl] = useState("");
  const [customUseCaseDesc, setCustomUseCaseDesc] = useState("");
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

  const watchedContentType = form.watch("content_type");
  const isAIToolsType = watchedContentType === "AI Tools (LLMs)";

  // Auto-set difficulty for AI Tools (LLMs)
  useEffect(() => {
    if (isAIToolsType) {
      form.setValue("difficulty", "Any");
    }
  }, [isAIToolsType, form]);

  const monetisationType = form.watch("monetisation_type");

  // (file handling now done inside ContentBlockBuilder)

  async function onSubmit(values: FormValues) {
    if (contentBlocks.length === 0) {
      toast({ title: "Add content", description: "Please add at least one content block.", variant: "destructive" });
      return;
    }
    if (selectedMicrotags.length < 3) {
      setMicrotagError("Please select at least 3 tags");
      return;
    }
    setMicrotagError("");

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in before uploading.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const isPwyw = monetisationType === "paid" && pwywFloor >= 0 && form.getValues("price_gbp") === undefined;
      // Determine if PWYW based on a separate flag
      const actualMonetisationType = monetisationType;
      const actualPriceGbp = monetisationType === "paid" && !isPwyw ? values.price_gbp ?? null : null;
      const actualPwywEnabled = isPwyw;
      const actualPwywFloor = isPwyw ? pwywFloor : null;

      // Insert content_items row (file_url left null — blocks hold the content now)
      const { data: insertedItem, error: insertError } = await supabase.from("content_items").insert({
        creator_id: user.id,
        title: values.title,
        content_type: values.content_type,
        description: values.description,
        difficulty: values.difficulty,
        ai_tools: values.ai_tools,
        use_cases: values.use_cases,
        file_url: null,
        use_instructions: values.use_instructions,
        what_to_expect: values.what_to_expect,
        status: "pending",
        monetisation_type: actualMonetisationType,
        price_gbp: actualPriceGbp,
        donation_enabled: values.donation_enabled,
        pwyw_enabled: actualPwywEnabled,
        pwyw_floor_gbp: actualPwywFloor,
        is_pwyw: actualPwywEnabled,
      } as any).select("id").single();

      if (insertError || !insertedItem) {
        toast({ title: "Submission failed", description: insertError?.message ?? "Unknown error", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const contentId = insertedItem.id;

      // Save tool_url if AI Tools type
      if (isAIToolsType && toolUrl.trim()) {
        await supabase.from("content_items").update({ tool_url: toolUrl.trim() } as any).eq("id", contentId);
      }

      // Save custom use case description
      if (customUseCaseDesc.trim() && values.use_cases.includes("Other")) {
        await supabase.from("content_items").update({ custom_use_case_description: customUseCaseDesc.trim() } as any).eq("id", contentId);
      }

      // Upload cover image if selected
      if (coverImageFile) {
        const coverPath = `covers/${contentId}/${coverImageFile.name}`;
        const { error: coverErr } = await supabase.storage.from("content-files").upload(coverPath, coverImageFile);
        if (!coverErr) {
          const { data: urlData } = supabase.storage.from("content-files").getPublicUrl(coverPath);
          if (urlData?.publicUrl) {
            await supabase.from("content_items").update({ cover_image_url: urlData.publicUrl } as any).eq("id", contentId);
          }
        }
      }

      // Save dependencies
      for (const dep of dependencies) {
        await supabase.from("content_dependencies").insert({
          content_id: contentId,
          requires_content_id: dep.content_id,
          dependency_note: dep.note || null,
        });
      }

      // Save revenue splits
      for (const split of revenueSplits) {
        await supabase.from("revenue_splits").insert({
          content_id: contentId,
          recipient_id: split.recipientId,
          percentage: split.percentage,
          set_by: user.id,
        } as any);
      }

      // Save collab invites
      for (const inv of collabInvitees) {
        const { data: inviteData } = await supabase.from("collab_invites").insert({
          content_id: contentId,
          inviter_id: user.id,
          invitee_id: inv.id,
          status: "pending",
        } as any).select("id").single();

        // Send notification
        await supabase.from("notifications").insert({
          recipient_id: inv.id,
          notification_type: "collab_invite",
          content_id: contentId,
          actor_id: user.id,
          metadata: {
            inviter_username: user.email?.split("@")[0] || "",
            content_title: values.title,
            invite_id: inviteData?.id,
          },
        } as any);
      }

      // Save each block
      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        const position = i + 1;

        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let fileSizeBytes: number | null = null;
        let imageUrl: string | null = null;

        // Upload block file
        if (block.type === "file" && block.file) {
          const path = `${contentId}/${position}/${block.file.name}`;
          const { error } = await supabase.storage.from("content-files").upload(path, block.file);
          if (error) throw new Error(`File upload failed: ${error.message}`);
          fileUrl = path;
          fileName = block.file.name;
          fileSizeBytes = block.file.size;
        }

        // Upload block image
        if (block.type === "image" && block.imageFile) {
          const path = `${contentId}/${position}/${block.imageFile.name}`;
          const { error } = await supabase.storage.from("content-files").upload(path, block.imageFile);
          if (error) throw new Error(`Image upload failed: ${error.message}`);
          imageUrl = path;
        }

        const { data: insertedBlock, error: blockError } = await supabase.from("content_blocks").insert({
          content_id: contentId,
          position,
          block_type: block.type === "long_text" ? "long_text" : block.type,
          text_content: (block.type === "text" || block.type === "long_text") ? block.textContent : null,
          formatting: (block.type === "text" || block.type === "long_text") ? { type: block.formatting } : null,
          file_url: fileUrl,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          image_url: imageUrl,
          image_description: block.type === "image" ? block.imageDescription : null,
          is_preview: block.isPreview ?? false,
        }).select("id").single();

        if (blockError || !insertedBlock) throw new Error(blockError?.message ?? "Block insert failed");

        // Save variations
        for (let vi = 0; vi < block.variations.length; vi++) {
          const v = block.variations[vi];
          let vFileUrl: string | null = null;
          let vFileName: string | null = null;
          let vImageUrl: string | null = null;

          if (v.type === "file" && v.file) {
            const path = `${contentId}/variations/${position}-${v.label}/${v.file.name}`;
            const { error } = await supabase.storage.from("content-files").upload(path, v.file);
            if (error) throw new Error(`Variation file upload failed: ${error.message}`);
            vFileUrl = path;
            vFileName = v.file.name;
          }

          if (v.type === "image" && v.imageFile) {
            const path = `${contentId}/variations/${position}-${v.label}/${v.imageFile.name}`;
            const { error } = await supabase.storage.from("content-files").upload(path, v.imageFile);
            if (error) throw new Error(`Variation image upload failed: ${error.message}`);
            vImageUrl = path;
          }

          await supabase.from("block_variations").insert({
            block_id: insertedBlock.id,
            variation_label: v.label,
            variation_type: v.type,
            text_content: v.type === "text" ? v.textContent : null,
            formatting: v.type === "text" ? { type: v.formatting } : null,
            file_url: vFileUrl,
            file_name: vFileName,
            image_url: vImageUrl,
            image_description: v.type === "image" ? v.imageDescription : null,
            position: vi + 1,
          });
        }
      }

      // Save microtags
      if (selectedMicrotags.length > 0) {
        await supabase.from("content_microtags").insert(
          selectedMicrotags.map((tag) => ({ content_id: contentId, tag }))
        );
      }

      setSuccess(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err?.message ?? "Please try again.", variant: "destructive" });
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
          <Button variant="outline" onClick={() => { setSuccess(false); form.reset(); setContentBlocks([emptyBlock("text")]); setDependencies([]); setCoverImageFile(null); setCoverImagePreview(null); }}>Upload Another</Button>
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

        {/* Upload type selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          <button
            type="button"
            onClick={() => setUploadType("single")}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
              uploadType === "single"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-muted-foreground/40"
            }`}
          >
            <FileText className={`h-6 w-6 mt-0.5 shrink-0 ${uploadType === "single" ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">Blueprint</p>
              <p className="text-xs text-muted-foreground mt-0.5">A prompt, tutorial, or guide</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setUploadType("project")}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${
              uploadType === "project"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-muted-foreground/40"
            }`}
          >
            <FolderOpen className={`h-6 w-6 mt-0.5 shrink-0 ${uploadType === "project" ? "text-primary" : "text-muted-foreground"}`} />
            <div>
              <p className="text-sm font-semibold text-foreground">Project</p>
              <p className="text-xs text-muted-foreground mt-0.5">A collection of related blueprints</p>
            </div>
          </button>
        </div>

        {uploadType === "project" ? (
          <ProjectUploadForm />
        ) : (
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

            {/* Cover Image (optional) */}
            <div className="space-y-2">
              <Label>Cover image (optional)</Label>
              <p className="text-xs text-muted-foreground">A visual that appears in the feed. Recommended: 1200×630px.</p>
              {coverImagePreview ? (
                <div className="relative">
                  <img src={coverImagePreview} alt="Cover preview" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  <button
                    type="button"
                    onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload (.jpg, .png, .webp — max 3MB)</span>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) {
                        toast({ title: "File too large", description: "Cover image must be under 3MB.", variant: "destructive" });
                        return;
                      }
                      setCoverImageFile(file);
                      setCoverImagePreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              )}
            </div>

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
                        <SelectItem key={t} value={t}>{displayContentType(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>Not sure? Prompt(s) is the simplest. Blueprint includes setup steps.</FormDescription>
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
                    <MentionInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Turns your AI into a specialist that…"
                      maxLength={120}
                      rows={1}
                    />
                  </FormControl>
                  <FormDescription>
                    Describe what it does in plain English. Start with a verb. Max 120 characters. Use @username to mention creators.
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
                  {field.value.includes("Other") && (
                    <div className="mt-2">
                      <Label className="text-xs text-muted-foreground">Describe your use case (optional)</Label>
                      <div className="relative mt-1">
                        <Input
                          value={customUseCaseDesc}
                          onChange={(e) => setCustomUseCaseDesc(e.target.value.slice(0, 50))}
                          placeholder="e.g. Legal research, Recipe planning..."
                          className="h-9 text-sm bg-card border-border pr-14"
                          maxLength={50}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{customUseCaseDesc.length} / 50</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">This appears on your post in the feed. It's still categorised as 'Other' in filters.</p>
                    </div>
                  )}
                  <FormDescription>Select all that apply. This helps people find your content.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Micro-tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tags — pick 3 to 5</label>
              <p className="text-xs text-muted-foreground">Answer the questions users ask before downloading.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {(microtagDefs ?? []).map((mt) => {
                  const selected = selectedMicrotags.includes(mt.tag);
                  const maxed = selectedMicrotags.length >= 5 && !selected;
                  return (
                    <button
                      key={mt.tag}
                      type="button"
                      title={mt.description || undefined}
                      disabled={maxed}
                      onClick={() => {
                        setMicrotagError("");
                        setSelectedMicrotags((prev) =>
                          selected ? prev.filter((t) => t !== mt.tag) : [...prev, mt.tag]
                        );
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        selected
                          ? "bg-[hsl(18,80%,51%)]/15 text-[hsl(18,80%,51%)] border-[hsl(18,80%,51%)]/30"
                          : maxed
                          ? "bg-[hsl(240,14%,15%)] text-[hsl(240,7%,60%)] border-border opacity-40 pointer-events-none"
                          : "bg-[hsl(240,14%,15%)] text-[hsl(240,7%,60%)] border-border hover:border-muted-foreground/40"
                      }`}
                    >
                      {mt.tag}
                    </button>
                  );
                })}
              </div>
              {microtagError && <p className="text-sm text-destructive">{microtagError}</p>}
            </div>

            {/* 7. Content Block Builder */}
            <ContentBlockBuilder blocks={contentBlocks} onChange={setContentBlocks} />

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

              {/* Free / Paid / PWYW selector */}
              <div className="space-y-4">
                {(["free", "paid"] as const).map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{type === "free" ? "Free download" : "Paid (fixed price)"}</p>
                      <p className="text-xs text-muted-foreground">{type === "free" ? "Anyone can download for free" : "Set a price in GBP"}</p>
                    </div>
                    <Switch
                      checked={monetisationType === type && !pwywFloor && !(monetisationType === "paid" && form.getValues("price_gbp") === undefined)}
                      onCheckedChange={(checked) => {
                        if (checked) { form.setValue("monetisation_type", type); setPwywFloor(0); }
                        else if (type === monetisationType) form.setValue("monetisation_type", "free");
                      }}
                    />
                  </div>
                ))}

                {monetisationType === "paid" && (
                  <FormField
                    control={form.control}
                    name="price_gbp"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground font-medium">£</span>
                          <FormControl>
                            <Input type="number" step="0.01" min="1" placeholder="4.99" className="bg-background border-border rounded-xl w-32" {...field} />
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

            {/* Revenue Splits — only for paid content */}
            {monetisationType === "paid" && (
              <RevenueSplitPicker splits={revenueSplits} onChange={setRevenueSplits} />
            )}

            {/* Dependencies */}
            <DependencyPicker dependencies={dependencies} onChange={setDependencies} />

            {/* Co-author invites */}
            <CollabInvitePicker invitees={collabInvitees} onChange={setCollabInvitees} />

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
        )}
      </div>

      <SubmitToolModal open={submitToolOpen} onOpenChange={setSubmitToolOpen} />
    </div>
  );
};

export default Upload;
