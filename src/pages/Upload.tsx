import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, FileText, FolderOpen, ImagePlus, X, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProjectUploadForm } from "@/components/ProjectUploadForm";
import { CollabInvitePicker, type CollabInvitee } from "@/components/CollabInvitePicker";
import { useToast } from "@/hooks/use-toast";
import { useApprovedToolNames, useGroupedApprovedTools } from "@/hooks/useApprovedTools";
import { SeoHead } from "@/components/SeoHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MentionInput } from "@/components/MentionInput";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { SubmitToolModal } from "@/components/SubmitToolModal";
import { ContentBlockBuilder, emptyBlock, type ContentBlock } from "@/components/ContentBlockBuilder";
import { WhatToExpectBuilder, emptyWteBlock, type WteBlock } from "@/components/WhatToExpectBuilder";
import { DependencyPicker, type Dependency } from "@/components/DependencyPicker";
import { ORDERED_CONTENT_TYPES, DIFFICULTIES as DIFF_LIST, ANY_DIFFICULTY_TYPES, displayContentType } from "@/lib/content-types";

const CONTENT_TYPES = ORDERED_CONTENT_TYPES.filter(t => t !== "Blog");
const DIFFICULTIES = [...DIFF_LIST, "Any"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];
const ACCEPTED_TYPES = [".txt", ".md", ".json", ".pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  content_type: z.string().min(1, "Select a content type"),
  description: z.string().trim().max(500, "Max 500 characters").optional().or(z.literal("")),
  difficulty: z.string().min(1, "Select a difficulty level"),
  ai_tools: z.array(z.string()),
  use_cases: z.array(z.string()),
  use_instructions: z.string().trim().max(5000).optional().or(z.literal("")),
  what_to_expect: z.string().trim().max(2000).optional().or(z.literal("")),
  monetisation_type: z.enum(["free", "paid", "donation"]),
  price_gbp: z.coerce.number().min(1, "Minimum price is £1").optional(),
  donation_enabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ─── Revenue Split Row (inline) ─────────────────────────────

interface InlineSplit {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  percentage: number;
}

const Upload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const { toast } = useToast();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const { groups: toolGroups } = useGroupedApprovedTools();
  const [uploadType, setUploadType] = useState<"blog" | "single" | "project">("single");
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([emptyBlock("text")]);
  const [wteBlocks, setWteBlocks] = useState<WteBlock[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [insertedContentId, setInsertedContentId] = useState<string | null>(null);
  const [submitToolOpen, setSubmitToolOpen] = useState(false);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [collabInvitees, setCollabInvitees] = useState<CollabInvitee[]>([]);
  const [inlineSplits, setInlineSplits] = useState<InlineSplit[]>([]);
  const [pwywFloor, setPwywFloor] = useState<number>(0);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [expandedToolGroups, setExpandedToolGroups] = useState<Set<string>>(new Set(["api"]));
  const [tagInput, setTagInput] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [toolUrl, setToolUrl] = useState("");
  const [toolSubtype, setToolSubtype] = useState<"api" | "local" | "">("");
  const [modelParameters, setModelParameters] = useState("");
  const [modelBaseArchitecture, setModelBaseArchitecture] = useState("");
  const [modelFormat, setModelFormat] = useState("");
  const [modelLicense, setModelLicense] = useState("");
  const [modelRunWith, setModelRunWith] = useState<string[]>([]);
  const [customUseCaseDesc, setCustomUseCaseDesc] = useState("");
  const [otherToolName, setOtherToolName] = useState("");
  const [draftMeta, setDraftMeta] = useState<{ name: string; savedAt: string } | null>(null);
  const [draftLoading, setDraftLoading] = useState(!!draftId);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId || null);
  const [savingDraft, setSavingDraft] = useState(false);
  // Bounty state
  const [bountyEnabled, setBountyEnabled] = useState(false);
  const [bountyTipGbp, setBountyTipGbp] = useState<number | null>(null);
  const [bountyDeadlineDays, setBountyDeadlineDays] = useState<number | null>(null);
  const [bountyGap, setBountyGap] = useState("");
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutosaveRef = useRef<Date | null>(null);
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
  const isBlogType = watchedContentType === "Blog";
  const watchedAiTools = form.watch("ai_tools");
  const isOtherSelected = watchedAiTools?.includes("Other");

  useEffect(() => {
    if (isAIToolsType || isBlogType) form.setValue("difficulty", "Any");
  }, [isAIToolsType, isBlogType, form]);

  // For Blog: auto-set ai_tools to avoid validation error
  useEffect(() => {
    if (isBlogType) {
      form.setValue("ai_tools", ["Any Tool"]);
      form.setValue("monetisation_type", "free");
      form.setValue("description", "");
    }
  }, [isBlogType, form]);

  // Clear otherToolName when Other is deselected
  useEffect(() => {
    if (!isOtherSelected) setOtherToolName("");
  }, [isOtherSelected]);

  // ── Load draft when ?draft= is present ──
  useEffect(() => {
    if (!draftId) return;
    setDraftLoading(true);
    (async () => {
      try {
        const { data: item } = await supabase
          .from("content_items")
          .select("*")
          .eq("id", draftId)
          .eq("status", "draft")
          .single();
        if (!item) { setDraftLoading(false); return; }

        // Set form fields
        form.setValue("title", item.title || "");
        form.setValue("content_type", item.content_type || "");
        form.setValue("description", (item as any).description || "");
        form.setValue("difficulty", item.difficulty || "");
        form.setValue("ai_tools", (item as any).ai_tools || []);
        form.setValue("use_cases", (item as any).use_cases || []);
        form.setValue("use_instructions", (item as any).use_instructions || "");
        form.setValue("what_to_expect", (item as any).what_to_expect || "");
        form.setValue("monetisation_type", (item as any).monetisation_type || "free");
        form.setValue("donation_enabled", (item as any).donation_enabled || false);
        if ((item as any).price_gbp) form.setValue("price_gbp", Number((item as any).price_gbp));
        if ((item as any).other_tool_name) setOtherToolName((item as any).other_tool_name);
        if ((item as any).custom_use_case_description) setCustomUseCaseDesc((item as any).custom_use_case_description);
        if ((item as any).tool_url) setToolUrl((item as any).tool_url);
        if ((item as any).tags?.length > 0) setCustomTags((item as any).tags);
        if ((item as any).cover_image_url) setCoverImagePreview((item as any).cover_image_url);
        if ((item as any).pwyw_floor_gbp) setPwywFloor(Number((item as any).pwyw_floor_gbp));

        // WTE blocks
        if ((item as any).what_to_expect_blocks) {
          const wteData = (item as any).what_to_expect_blocks as any[];
          setWteBlocks(wteData.map((b: any) => ({
            id: b.id || crypto.randomUUID(),
            type: b.block_type || "text",
            textContent: b.text_content || "",
            formatting: b.formatting_type || "paragraph",
            subBlocks: b.sub_blocks || [],
            useInstructions: b.use_instructions || "",
            imageFile: null,
            imageDescription: b.image_description || "",
          })));
        }

        // Set draft meta for banner
        setDraftMeta({
          name: (item as any).draft_name || item.title || "Untitled draft",
          savedAt: (item as any).draft_saved_at || item.created_at,
        });

        // Load content blocks
        const { data: blocks } = await supabase
          .from("content_blocks")
          .select("*")
          .eq("content_id", draftId)
          .order("position", { ascending: true });

        if (blocks && blocks.length > 0) {
          setContentBlocks(blocks.map((b: any) => ({
            id: b.id,
            type: b.block_type === "long_text" ? "long_text" : b.block_type,
            textContent: b.text_content || "",
            formatting: b.formatting?.type || b.formatting_type || "paragraph",
            subBlocks: b.sub_blocks || [],
            useInstructions: b.use_instructions || "",
            file: null,
            fileName: b.file_name || "",
            fileUrl: b.file_url || "",
            imageFile: null,
            imageUrl: b.image_url || "",
            imageDescription: b.image_description || "",
            isPreview: b.is_preview || false,
            variations: [],
          })));
        }

        // Load dependencies
        const { data: deps } = await supabase
          .from("content_dependencies")
          .select("requires_content_id, dependency_note, content_items!content_dependencies_requires_content_id_fkey(title, content_type)")
          .eq("content_id", draftId);
        if (deps && deps.length > 0) {
          setDependencies(deps.map((d: any) => ({
            content_id: d.requires_content_id,
            title: d.content_items?.title || "",
            content_type: d.content_items?.content_type || "",
            note: d.dependency_note || "",
          })));
        }
      } catch (err) {
        console.error("Failed to load draft:", err);
      } finally {
        setDraftLoading(false);
      }
    })();
  }, [draftId]);

  const monetisationType = form.watch("monetisation_type");
  const showRevenueSplit = (monetisationType === "paid" || pwywFloor > 0) && collabInvitees.length > 0;

  // Sync inline splits when co-authors change
  useEffect(() => {
    setInlineSplits((prev) => {
      const existing = new Map(prev.map((s) => [s.userId, s]));
      return collabInvitees.map((inv) => existing.get(inv.id) ?? {
        userId: inv.id,
        username: inv.username,
        displayName: inv.displayName,
        avatarUrl: inv.avatarUrl,
        percentage: 10,
      });
    });
  }, [collabInvitees]);

  const totalSplitPct = inlineSplits.reduce((s, x) => s + (x.percentage || 0), 0);
  const keepPct = 100 - totalSplitPct;
  const splitError = totalSplitPct > 90;

  const toggleToolGroup = (category: string) => {
    setExpandedToolGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  // Sort AI_TOOLS: "Other" always last, "Any Tool" always first
  const sortedTools = [...(AI_TOOLS ?? [])].sort((a, b) => {
    if (a === "Any Tool") return -1;
    if (b === "Any Tool") return 1;
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });

  // ── Save Draft Logic ──
  const saveDraft = useCallback(async (silent = false): Promise<string | null> => {
    const values = form.getValues();
    // Don't create empty drafts
    const hasContent = values.title || values.content_type || values.description || contentBlocks.some(b => b.textContent || b.file || b.imageFile);
    if (!hasContent) return currentDraftId;

    if (!silent) setSavingDraft(true);
    try {
      await supabase.auth.refreshSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const isPwyw = values.monetisation_type === "paid" && pwywFloor >= 0 && values.price_gbp === undefined;
      const wteBlocksJsonb = wteBlocks.length > 0
        ? wteBlocks.map((b, i) => ({
            id: b.id, position: i + 1, block_type: b.type,
            text_content: b.textContent || null, formatting_type: b.formatting,
            sub_blocks: b.formatting === "sub_list" && b.subBlocks?.length > 0 ? b.subBlocks : null,
            use_instructions: b.useInstructions?.trim() || null,
            image_description: b.type === "image" ? b.imageDescription : null,
          }))
        : null;

      const itemData: any = {
        creator_id: user.id,
        title: values.title || "Untitled draft",
        content_type: values.content_type || "Prompt(s)",
        description: values.description || null,
        difficulty: values.difficulty || "Beginner",
        ai_tools: values.ai_tools || [],
        use_cases: values.use_cases || [],
        use_instructions: values.use_instructions || null,
        what_to_expect: values.what_to_expect || null,
        what_to_expect_blocks: wteBlocksJsonb,
        other_tool_name: isOtherSelected && otherToolName.trim() ? otherToolName.trim() : null,
        custom_use_case_description: customUseCaseDesc.trim() || null,
        tool_url: toolUrl.trim() || null,
        tags: customTags,
        custom_tags: customTags,
        monetisation_type: values.monetisation_type,
        price_gbp: values.monetisation_type === "paid" && !isPwyw ? values.price_gbp ?? null : null,
        donation_enabled: values.donation_enabled,
        pwyw_enabled: isPwyw,
        pwyw_floor_gbp: isPwyw ? pwywFloor : null,
        is_pwyw: isPwyw,
        status: "draft",
        draft_saved_at: new Date().toISOString(),
        draft_name: values.title || null,
      };

      let draftIdToUse = currentDraftId;

      if (!draftIdToUse) {
        const { data: inserted, error } = await supabase.from("content_items").insert(itemData).select("id").single();
        if (error || !inserted) { console.error("Draft save failed:", error); return null; }
        draftIdToUse = inserted.id;
        setCurrentDraftId(draftIdToUse);
      } else {
        const { creator_id, ...updateData } = itemData;
        await supabase.from("content_items").update(updateData).eq("id", draftIdToUse);
      }

      // Re-insert blocks: delete existing then re-insert
      await supabase.from("content_blocks").delete().eq("content_id", draftIdToUse!);
      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        await supabase.from("content_blocks").insert({
          content_id: draftIdToUse,
          position: i + 1,
          block_type: block.type === "long_text" ? "long_text" : block.type,
          text_content: (block.type === "text" || block.type === "long_text") ? block.textContent : null,
          formatting: (block.type === "text" || block.type === "long_text") ? { type: block.formatting } : null,
          formatting_type: block.formatting || "paragraph",
          file_url: (block as any).fileUrl || null,
          file_name: block.fileName || null,
          image_url: (block as any).imageUrl || null,
          image_description: block.type === "image" ? block.imageDescription : null,
          is_preview: block.isPreview ?? false,
          use_instructions: block.useInstructions?.trim() || null,
          sub_blocks: block.formatting === "sub_list" && block.subBlocks?.length > 0 ? block.subBlocks : null,
        } as any);
      }

      const now = new Date().toISOString();
      setDraftMeta({ name: values.title || "Untitled draft", savedAt: now });
      lastAutosaveRef.current = new Date();

      if (!silent) toast({ title: "Draft saved ✓" });
      return draftIdToUse;
    } catch (err: any) {
      if (!silent) toast({ title: "Failed to save draft", description: err?.message, variant: "destructive" });
      return currentDraftId;
    } finally {
      if (!silent) setSavingDraft(false);
    }
  }, [form, contentBlocks, wteBlocks, currentDraftId, customTags, customUseCaseDesc, toolUrl, otherToolName, isOtherSelected, pwywFloor, toast]);

  // ── Autosave every 60 seconds ──
  useEffect(() => {
    autosaveTimer.current = setInterval(() => {
      saveDraft(true);
    }, 60000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [saveDraft]);

  async function onSubmit(values: FormValues) {
    if (contentBlocks.length === 0) {
      toast({ title: "Add content", description: "Please add at least one content block.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      await supabase.auth.refreshSession();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Sign in required", description: "Please sign in before uploading.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      const isPwyw = monetisationType === "paid" && pwywFloor >= 0 && form.getValues("price_gbp") === undefined;
      const actualMonetisationType = monetisationType;
      const actualPriceGbp = monetisationType === "paid" && !isPwyw ? values.price_gbp ?? null : null;
      const actualPwywEnabled = isPwyw;
      const actualPwywFloor = isPwyw ? pwywFloor : null;

      // Serialize WTE blocks to jsonb
      const wteBlocksJsonb = wteBlocks.length > 0
        ? wteBlocks.map((b, i) => ({
            id: b.id,
            position: i + 1,
            block_type: b.type,
            text_content: b.textContent || null,
            formatting_type: b.formatting,
            sub_blocks: b.formatting === "sub_list" && b.subBlocks?.length > 0 ? b.subBlocks : null,
            use_instructions: b.useInstructions?.trim() || null,
            image_description: b.type === "image" ? b.imageDescription : null,
            // image_url will be set after upload
          }))
        : null;

      // Auto-generate description for blogs from first text block
      let finalDescription = values.description;
      if (isBlogType) {
        const firstTextBlock = contentBlocks.find(b => (b.type === "text" || b.type === "long_text") && b.textContent?.trim());
        finalDescription = firstTextBlock ? firstTextBlock.textContent!.trim().slice(0, 160) : "";
      }

      const { data: insertedItem, error: insertError } = await supabase.from("content_items").insert({
        creator_id: user.id,
        title: values.title,
        content_type: values.content_type,
        description: finalDescription,
        difficulty: values.difficulty,
        ai_tools: values.ai_tools,
        use_cases: values.use_cases,
        file_url: null,
        use_instructions: values.use_instructions,
        what_to_expect: values.what_to_expect,
        what_to_expect_blocks: wteBlocksJsonb,
        other_tool_name: isOtherSelected && otherToolName.trim() ? otherToolName.trim() : null,
        status: "approved",
        approved_at: new Date().toISOString(),
        monetisation_type: actualMonetisationType,
        price_gbp: actualPriceGbp,
        donation_enabled: values.donation_enabled,
        pwyw_enabled: actualPwywEnabled,
        pwyw_floor_gbp: actualPwywFloor,
        is_pwyw: actualPwywEnabled,
        custom_tags: customTags,
        bounty_enabled: values.content_type === "Failure Library" && bountyEnabled,
        bounty_status: values.content_type === "Failure Library" && bountyEnabled ? "open" : "open",
        bounty_tip_gbp: values.content_type === "Failure Library" && bountyEnabled && bountyTipGbp !== null ? bountyTipGbp : null,
        bounty_closes_at: values.content_type === "Failure Library" && bountyEnabled && bountyDeadlineDays !== null
          ? new Date(Date.now() + bountyDeadlineDays * 86400000).toISOString()
          : null,
        bounty_gap: values.content_type === "Failure Library" && bountyEnabled && bountyGap.trim() ? bountyGap.trim() : null,
      } as any).select("id").single();

      if (insertError || !insertedItem) {
        toast({ title: "Submission failed", description: insertError?.message ?? "Unknown error", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      setInsertedContentId(insertedItem.id);

      const contentId = insertedItem.id;

      // ── Insert content_blocks + variations IMMEDIATELY after content_items ──
      // Prevents RLS failures from stale auth tokens during later async work.
      for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        const position = i + 1;

        let fileUrl: string | null = null;
        let fileName: string | null = null;
        let fileSizeBytes: number | null = null;
        let imageUrl: string | null = null;

        if (block.type === "file" && block.file) {
          const path = `${contentId}/${position}/${block.file.name}`;
          const { error } = await supabase.storage.from("content-files").upload(path, block.file);
          if (error) throw new Error(`File upload failed: ${error.message}`);
          fileUrl = path;
          fileName = block.file.name;
          fileSizeBytes = block.file.size;
        }

        if (block.type === "image" && block.imageFile) {
          const path = `${contentId}/${position}/${block.imageFile.name}`;
          const { error } = await supabase.storage.from("content-files").upload(path, block.imageFile);
          if (error) throw new Error(`Image upload failed: ${error.message}`);
          imageUrl = path;
        }

        // Build sub_blocks based on block type
        let subBlocksData: any = null;
        if (block.formatting === "sub_list" && block.subBlocks?.length > 0) {
          subBlocksData = block.subBlocks;
        } else if (block.type === "github") {
          subBlocksData = [{ description: block.githubDescription?.trim() || "" }];
        } else if (block.type === "large_file") {
          subBlocksData = [{
            platform: block.largeFilePlatform || "",
            custom_platform: block.largeFileCustomPlatform?.trim() || null,
            description: block.largeFileDescription?.trim() || "",
            file_size_hint: block.largeFileSizeHint?.trim() || "",
          }];
        }

        const { data: insertedBlock, error: blockError } = await supabase.from("content_blocks").insert({
          content_id: contentId,
          position,
          block_type: block.type,
          text_content: (block.type === "text" || block.type === "long_text") ? block.textContent
            : (block.type === "github" || block.type === "large_file") ? block.textContent
            : null,
          formatting: (block.type === "text" || block.type === "long_text") ? { type: block.formatting } : null,
          formatting_type: block.formatting || "paragraph",
          file_url: fileUrl,
          file_name: fileName,
          file_size_bytes: fileSizeBytes,
          image_url: imageUrl,
          image_description: block.type === "image" ? block.imageDescription : null,
          is_preview: block.type === "github" ? false : (block.isPreview ?? false),
          use_instructions: block.useInstructions?.trim() || null,
          sub_blocks: subBlocksData,
          external_file_url: block.externalFileUrl?.trim() || null,
          github_url: null,
        } as any).select("id").single();

        if (blockError || !insertedBlock) throw new Error(blockError?.message ?? "Block insert failed");

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

      // ── Remaining metadata updates (safe to run after blocks are saved) ──
      const metaUpdates: any = {};
      // Blog: compute estimated read time
      if (isBlogType) {
        const wordCount = contentBlocks.reduce((sum, b) => {
          if (b.type === "text" || b.type === "long_text") return sum + (b.textContent?.split(/\s+/).filter(Boolean).length ?? 0);
          return sum;
        }, 0);
        metaUpdates.estimated_read_minutes = Math.max(1, Math.round(wordCount / 200));
      }
      if (isAIToolsType && toolUrl.trim()) metaUpdates.tool_url = toolUrl.trim();
      if (isAIToolsType && toolSubtype) metaUpdates.tool_subtype = toolSubtype;
      if (isAIToolsType && toolSubtype === "local") {
        if (modelParameters) metaUpdates.model_parameters = modelParameters;
        if (modelBaseArchitecture.trim()) metaUpdates.model_base_architecture = modelBaseArchitecture.trim();
        if (modelFormat) metaUpdates.model_format = modelFormat;
        if (modelLicense.trim()) metaUpdates.model_license = modelLicense.trim();
        if (modelRunWith.length > 0) metaUpdates.model_run_with = modelRunWith;
      }
      if (Object.keys(metaUpdates).length > 0) {
        await supabase.from("content_items").update(metaUpdates).eq("id", contentId);
      }

      if (customUseCaseDesc.trim() && values.use_cases.includes("Other")) {
        await supabase.from("content_items").update({ custom_use_case_description: customUseCaseDesc.trim() } as any).eq("id", contentId);
      }

      if (wteBlocks.length > 0) {
        const updatedWte = [...(wteBlocksJsonb ?? [])];
        for (let i = 0; i < wteBlocks.length; i++) {
          const wb = wteBlocks[i];
          if (wb.type === "image" && wb.imageFile) {
            const path = `${contentId}/wte/${i + 1}/${wb.imageFile.name}`;
            const { error } = await supabase.storage.from("content-files").upload(path, wb.imageFile);
            if (!error && updatedWte[i]) {
              (updatedWte[i] as any).image_url = path;
            }
          }
        }
        await supabase.from("content_items").update({ what_to_expect_blocks: updatedWte } as any).eq("id", contentId);
      }

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

      for (const dep of dependencies) {
        await supabase.from("content_dependencies").insert({
          content_id: contentId,
          requires_content_id: dep.content_id,
          dependency_note: dep.note || null,
        });
      }

      for (const split of inlineSplits) {
        if (showRevenueSplit && split.percentage > 0) {
          await supabase.from("revenue_splits").insert({
            content_id: contentId,
            recipient_id: split.userId,
            percentage: split.percentage,
            set_by: user.id,
          } as any);
        }
      }

      for (const inv of collabInvitees) {
        const splitForInv = inlineSplits.find((s) => s.userId === inv.id);
        const { data: inviteData } = await supabase.from("collab_invites").insert({
          content_id: contentId,
          inviter_id: user.id,
          invitee_id: inv.id,
          status: "pending",
        } as any).select("id").single();

        await supabase.from("notifications").insert({
          recipient_id: inv.id,
          notification_type: "collab_invite",
          content_id: contentId,
          actor_id: user.id,
          metadata: {
            inviter_username: user.email?.split("@")[0] || "",
            content_title: values.title,
            invite_id: inviteData?.id,
            split_percentage: splitForInv?.percentage ?? null,
          },
        } as any);
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
        <h2 className="text-xl font-bold text-foreground">Your post is live!</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Your blueprint has been published and is now visible in the feed.
        </p>
        <div className="flex gap-3 mt-4">
          {insertedContentId && (
            <Button onClick={() => navigate(`/content/${insertedContentId}`)}>View Post</Button>
          )}
          <Button variant="outline" onClick={() => { setSuccess(false); setInsertedContentId(null); form.reset(); setContentBlocks([emptyBlock("text")]); setWteBlocks([]); setDependencies([]); setCoverImageFile(null); setCoverImagePreview(null); }}>Upload Another</Button>
        </div>
      </div>
    );
  }

  if (draftLoading) {
    return (
      <div className="py-20 px-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  async function discardDraft() {
    if (!draftId) return;
    await supabase.from("content_blocks").delete().eq("content_id", draftId);
    await supabase.from("content_items").delete().eq("id", draftId);
    navigate("/upload", { replace: true });
    window.location.reload();
  }

  return (
    <div className="py-10 px-6">
      <SeoHead title="Upload — NeoScale AI" description="Share your AI assistants, blueprints and workflows with the community." path="/upload" />
      <div className="mx-auto max-w-2xl">
        {/* Draft banner */}
        {draftMeta && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: "#1A1500", borderColor: "#BA7517" }}>
            <p className="text-sm" style={{ color: "#EF9F27" }}>
              Editing draft — <span className="font-semibold">{draftMeta.name}</span>
              <span className="ml-2 opacity-70">· {lastAutosaveRef.current
                ? `Autosaved ${formatDistanceToNow(lastAutosaveRef.current, { addSuffix: true })}`
                : `Last saved ${formatDistanceToNow(new Date(draftMeta.savedAt), { addSuffix: true })}`}</span>
            </p>
            <button onClick={discardDraft} className="text-xs hover:underline shrink-0" style={{ color: "#EF9F27" }}>
              Discard draft
            </button>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Share Your Work</h1>
          <p className="text-sm text-muted-foreground mt-1">
            All submissions are reviewed and tested before going live. We aim to respond within 48 hours.
          </p>
        </div>

        {/* 1. Upload type selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <button type="button" onClick={() => { setUploadType("blog"); form.setValue("content_type", "Blog"); }}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${uploadType === "blog" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"}`}>
            <span className={`text-xl mt-0.5 shrink-0`}>📝</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Blog</p>
              <p className="text-xs text-muted-foreground mt-0.5">A post, opinion, or tutorial in your own words</p>
            </div>
          </button>
          <button type="button" onClick={() => { setUploadType("single"); if (form.getValues("content_type") === "Blog") form.setValue("content_type", ""); }}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${uploadType === "single" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"}`}>
            <span className={`text-xl mt-0.5 shrink-0`}>🔷</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Blueprint</p>
              <p className="text-xs text-muted-foreground mt-0.5">A prompt, workflow, or guide people can use</p>
            </div>
          </button>
          <button type="button" onClick={() => setUploadType("project")}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 transition-colors text-left ${uploadType === "project" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/40"}`}>
            <span className={`text-xl mt-0.5 shrink-0`}>📁</span>
            <div>
              <p className="text-sm font-semibold text-foreground">Project</p>
              <p className="text-xs text-muted-foreground mt-0.5">A collection of related blueprints</p>
            </div>
          </button>
        </div>

        {uploadType === "project" ? (
          <ProjectUploadForm />
        ) : uploadType === "blog" ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Blog: Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="E.g. Why AI agents changed my workflow" className="bg-card border-border rounded-xl" {...field} maxLength={100} />
                </FormControl>
                <FormDescription>{field.value.length}/100</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* Blog: Cover Image */}
            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <p className="text-xs text-muted-foreground">Appears in the feed. 1200×630px recommended.</p>
              {coverImagePreview ? (
                <div className="relative">
                  <img src={coverImagePreview} alt="Cover preview" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  <button type="button" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload (.jpg, .png, .webp — max 3MB)</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 3 * 1024 * 1024) { toast({ title: "File too large", description: "Cover image must be under 3MB.", variant: "destructive" }); return; }
                    setCoverImageFile(file);
                    setCoverImagePreview(URL.createObjectURL(file));
                  }} />
                </label>
              )}
            </div>


            {/* Blog: Content blocks — only Text and Long Text */}
            <ContentBlockBuilder blocks={contentBlocks} onChange={setContentBlocks} contentType="Blog" />

            {/* Blog: estimated read time */}
            {(() => {
              const wordCount = contentBlocks.reduce((sum, b) => {
                if (b.type === "text" || b.type === "long_text") return sum + (b.textContent?.split(/\s+/).filter(Boolean).length ?? 0);
                return sum;
              }, 0);
              const mins = Math.max(1, Math.round(wordCount / 200));
              return <p className="text-xs text-muted-foreground">Estimated read time: ~{mins} min</p>;
            })()}

            {/* Blog: Topics */}
            <FormField control={form.control} name="use_cases" render={({ field }) => (
              <FormItem>
                <FormLabel>Topics</FormLabel>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {USE_CASES.map((uc) => {
                    const selected = field.value.includes(uc);
                    return (
                      <button key={uc} type="button" onClick={() => field.onChange(selected ? field.value.filter((v) => v !== uc) : [...field.value, uc])}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selected ? "bg-primary/15 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"}`}>
                        {uc}
                      </button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )} />

            {/* Blog: Monetisation — donation only */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monetisation</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Blogs are always free. You can add a donation button.</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Donation button</p>
                  <p className="text-xs text-muted-foreground">Add a tip button so readers can support your work</p>
                </div>
                <FormField control={form.control} name="donation_enabled" render={({ field }) => (
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                )} />
              </div>
            </div>

            {/* Blog: Co-authors */}
            <CollabInvitePicker invitees={collabInvitees} onChange={setCollabInvitees} />

            {/* Blog: Save Draft + Preview */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="ns-btn-silver flex-1 h-10 rounded-full"
                disabled={savingDraft || submitting}
                onClick={() => saveDraft(false)}
              >
                {savingDraft ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Draft"}
              </Button>
              <Button
                type="button"
                size="lg"
                className="ns-btn-primary flex-1 h-10 rounded-full"
                disabled={savingDraft || submitting}
                onClick={async () => {
                  const id = await saveDraft(false);
                  if (id) navigate(`/upload/preview/${id}`);
                }}
              >
                Preview Post →
              </Button>
            </div>
          </form>
        </Form>
        ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* 2. Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="E.g. Email Summariser" className="bg-card border-border rounded-xl" {...field} />
                </FormControl>
                <FormDescription>Keep it short and specific.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* 3. Cover Image */}
            <div className="space-y-1.5">
              <Label>Cover image</Label>
              <p className="text-xs text-muted-foreground">Appears in the feed. 1200×630px recommended.</p>
              {coverImagePreview ? (
                <div className="relative">
                  <img src={coverImagePreview} alt="Cover preview" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  <button type="button" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 py-6 px-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Click to upload (.jpg, .png, .webp — max 3MB)</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 3 * 1024 * 1024) { toast({ title: "File too large", description: "Cover image must be under 3MB.", variant: "destructive" }); return; }
                    setCoverImageFile(file);
                    setCoverImagePreview(URL.createObjectURL(file));
                  }} />
                </label>
              )}
            </div>

            {/* 4. Content Type */}
            <FormField control={form.control} name="content_type" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-card border-border rounded-xl"><SelectValue placeholder="Select a type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border">
                    {CONTENT_TYPES.map((t) => <SelectItem key={t} value={t}>{displayContentType(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormDescription>Not sure? Start with Prompt(s).</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* 4b. AI Tools Subtype selector */}
            {isAIToolsType && (
              <div className="space-y-2">
                <Label>What kind of tool is this?</Label>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: "api" as const, emoji: "🌐", label: "API / Web Tool", desc: "ChatGPT, Claude, Gemini, Grok etc." },
                    { value: "local" as const, emoji: "🖥️", label: "Local / Open Source Model", desc: "Hugging Face, Ollama, LM Studio, GGUF files etc." },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setToolSubtype(opt.value)}
                      className={`flex flex-col items-start p-4 rounded-xl border-2 transition-colors text-left ${
                        toolSubtype === opt.value
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-muted-foreground/40"
                      }`}
                    >
                      <span className="text-lg mb-1">{opt.emoji}</span>
                      <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4c. Tool URL / Model page URL */}
            {isAIToolsType && (
              <div className="space-y-2">
                <Label>{toolSubtype === "local" ? "Model page URL" : "Tool URL"}</Label>
                <Input
                  value={toolUrl}
                  onChange={(e) => setToolUrl(e.target.value)}
                  placeholder={toolSubtype === "local" ? "e.g. https://huggingface.co/Qwen/Qwen3.5-27B" : "e.g. https://chat.openai.com"}
                  className="bg-card border-border rounded-xl"
                />
              </div>
            )}

            {/* 4d. Local model fields */}
            {isAIToolsType && toolSubtype === "local" && (
              <div className="space-y-4 border border-border rounded-xl p-4 bg-card">
                <h3 className="text-sm font-semibold text-foreground">Model Details</h3>

                {/* Model size */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Model size (optional)</Label>
                  <Select value={modelParameters} onValueChange={setModelParameters}>
                    <SelectTrigger className="bg-background border-border rounded-xl">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {["1B", "3B", "7B", "8B", "13B", "14B", "27B", "30B", "70B", "72B", "Other"].map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Base architecture */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Base architecture (optional)</Label>
                  <Input
                    value={modelBaseArchitecture}
                    onChange={(e) => setModelBaseArchitecture(e.target.value.slice(0, 40))}
                    placeholder="e.g. Qwen3.5, Llama 3.1, Mistral..."
                    className="bg-background border-border rounded-xl"
                    maxLength={40}
                  />
                </div>

                {/* File format */}
                <div className="space-y-1.5">
                  <Label className="text-xs">File format (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Safetensors", "GGUF", "GGML", "Other"].map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setModelFormat(modelFormat === fmt ? "" : fmt)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          modelFormat === fmt
                            ? "bg-primary/15 text-primary border-primary/30"
                            : "bg-background text-muted-foreground border-border hover:border-muted-foreground/40"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* License */}
                <div className="space-y-1.5">
                  <Label className="text-xs">License (optional)</Label>
                  <Input
                    value={modelLicense}
                    onChange={(e) => setModelLicense(e.target.value.slice(0, 60))}
                    placeholder="e.g. MIT, Apache 2.0, LGPL-3.0..."
                    className="bg-background border-border rounded-xl"
                    maxLength={60}
                  />
                </div>

                {/* Runs on */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Runs on (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Ollama", "LM Studio", "Jan.ai", "llama.cpp", "Transformers", "vLLM", "Other"].map((platform) => {
                      const selected = modelRunWith.includes(platform);
                      return (
                        <button
                          key={platform}
                          type="button"
                          onClick={() => setModelRunWith(selected ? modelRunWith.filter((p) => p !== platform) : [...modelRunWith, platform])}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                            selected
                              ? "bg-primary/15 text-primary border-primary/30"
                              : "bg-background text-muted-foreground border-border hover:border-muted-foreground/40"
                          }`}
                        >
                          {platform}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>{bountyEnabled ? "The Failure" : "Description"}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={bountyEnabled
                      ? "Describe exactly what went wrong. Be specific — what did you expect vs what happened? What have you already tried?"
                      : "Turns your AI into a specialist that…"}
                    className="bg-card border-border rounded-xl"
                    maxLength={500}
                  />
                </FormControl>
                <FormDescription>
                  <span className="text-muted-foreground">{(field.value ?? "").length}/500</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* BOUNTY SECTION — only when Failure Library selected */}
            {watchedContentType === "Failure Library" && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Turn this into a Bounty?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Bounties invite the community to solve your failure with a Blueprint. The best solution gets marked as the answer.</p>
                  </div>
                  <Switch checked={bountyEnabled} onCheckedChange={setBountyEnabled} />
                </div>

                {bountyEnabled && (
                  <div className="space-y-4 pt-2 border-t border-border">
                    {/* Tip */}
                    <div className="space-y-2">
                      <Label className="text-sm">Attach a tip for the solver (optional)</Label>
                      <div className="flex flex-wrap gap-2">
                        {([null, 0.5, 1, 2, 5] as const).map((amt) => (
                          <button
                            key={String(amt)}
                            type="button"
                            onClick={() => setBountyTipGbp(amt)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              bountyTipGbp === amt
                                ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
                            }`}
                          >
                            {amt === null ? "No tip" : `£${amt}`}
                          </button>
                        ))}
                      </div>
                      {bountyTipGbp !== null && (
                        <p className="text-xs text-muted-foreground">Paid via Stripe to whoever you mark as the solution.</p>
                      )}
                    </div>

                    {/* Deadline */}
                    <div className="space-y-2">
                      <Label className="text-sm">Close bounty after</Label>
                      <div className="flex flex-wrap gap-2">
                        {([null, 3, 7, 14, 30] as const).map((days) => (
                          <button
                            key={String(days)}
                            type="button"
                            onClick={() => setBountyDeadlineDays(days)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                              bountyDeadlineDays === days
                                ? "bg-primary/15 text-primary border-primary/30"
                                : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"
                            }`}
                          >
                            {days === null ? "No deadline" : `${days} days`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Gap */}
                    <div className="space-y-1.5">
                      <Label className="text-sm">What does a good solution need to do? <span className="text-muted-foreground font-normal">(required)</span></Label>
                      <div className="relative">
                        <Input
                          value={bountyGap}
                          onChange={(e) => setBountyGap(e.target.value.slice(0, 300))}
                          placeholder="e.g. The fix must work in ChatGPT 3.5 free tier, requires no plugins, and can be set up in under 10 minutes."
                          className="bg-background border-border rounded-xl pr-16"
                          maxLength={300}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{bountyGap.length}/300</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 6. What to Expect (block builder) — hidden for Blog */}
            {!isBlogType && <WhatToExpectBuilder blocks={wteBlocks} onChange={setWteBlocks} helper="What will users get? Keep it concrete." />}

            {/* 7. Your Blueprint (content block builder) */}
            <ContentBlockBuilder blocks={contentBlocks} onChange={setContentBlocks} contentType={watchedContentType} />

            {/* Blog: estimated read time */}
            {isBlogType && (() => {
              const wordCount = contentBlocks.reduce((sum, b) => {
                if (b.type === "text" || b.type === "long_text") return sum + (b.textContent?.split(/\s+/).filter(Boolean).length ?? 0);
                return sum;
              }, 0);
              const mins = Math.max(1, Math.round(wordCount / 200));
              return <p className="text-xs text-muted-foreground">Estimated read time: ~{mins} min</p>;
            })()}

            {/* 8. Difficulty — hidden for Blog */}
            {!isBlogType && (
            <FormField control={form.control} name="difficulty" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>Difficulty</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-card border-border rounded-xl"><SelectValue placeholder="Select difficulty" /></SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border">
                    {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormDescription>Beginner = anyone. Advanced = technical setup needed.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            )}

            {/* 9. Works with — hidden for Blog */}
            {!isBlogType && (
            <FormField control={form.control} name="ai_tools" render={() => (
              <FormItem className="space-y-1.5">
                <FormLabel>Works with<span style={{ fontSize: '12px', color: '#9999AA', fontWeight: 400, marginLeft: '6px' }}>(optional)</span></FormLabel>
                {toolGroups.length > 0 ? (
                  <div className="space-y-1 mt-1">
                    {toolGroups.map((group) => {
                      const isExpanded = expandedToolGroups.has(group.category);
                      const selectedCount = (form.watch("ai_tools") ?? []).filter((t) =>
                        group.tools.some((gt) => gt.name === t)
                      ).length;
                      return (
                        <div key={group.category} className="border border-border rounded-xl overflow-hidden">
                          <button
                            type="button"
                            onClick={() => toggleToolGroup(group.category)}
                            className="flex items-center justify-between w-full px-3 h-10 text-left hover:bg-muted/30 transition-colors"
                          >
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</span>
                            <div className="flex items-center gap-2">
                              {!isExpanded && selectedCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">({selectedCount})</span>
                              )}
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </div>
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 pt-1 border-t border-border">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {group.tools.map((tool) => (
                                  <FormField key={tool.name} control={form.control} name="ai_tools" render={({ field }) => (
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(tool.name)}
                                          onCheckedChange={(checked) => {
                                            field.onChange(checked ? [...(field.value ?? []), tool.name] : (field.value ?? []).filter((v) => v !== tool.name));
                                          }}
                                        />
                                      </FormControl>
                                      <Label className="text-xs text-foreground font-normal cursor-pointer">{tool.name}</Label>
                                    </FormItem>
                                  )} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                    {sortedTools.map((tool) => (
                      <FormField key={tool} control={form.control} name="ai_tools" render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(tool)}
                              onCheckedChange={(checked) => {
                                field.onChange(checked ? [...(field.value ?? []), tool] : (field.value ?? []).filter((v) => v !== tool));
                              }}
                            />
                          </FormControl>
                          <Label className="text-xs text-foreground font-normal cursor-pointer">{tool}</Label>
                        </FormItem>
                      )} />
                    ))}
                  </div>
                )}
                {/* Other tool name input */}
                {isOtherSelected && (
                  <div className="mt-2">
                    <div className="relative">
                      <Input
                        value={otherToolName}
                        onChange={(e) => setOtherToolName(e.target.value.slice(0, 60))}
                        placeholder="What tool? e.g. 'Notion AI', 'Perplexity', 'Mistral'..."
                        className="h-9 text-sm bg-card border-border pr-14"
                        maxLength={60}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{otherToolName.length} / 60</span>
                    </div>
                  </div>
                )}
                <button type="button" onClick={() => setSubmitToolOpen(true)} className="text-xs text-primary hover:underline mt-2">
                  Don't see your AI tool? Submit it →
                </button>
                <FormDescription>Select every tool you've tested this with.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            )}

            {/* 10. Topics */}
            <FormField control={form.control} name="use_cases" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>Topics</FormLabel>
                <div className="flex flex-wrap gap-2 mt-1">
                  {USE_CASES.map((uc) => {
                    const selected = field.value.includes(uc);
                    return (
                      <button key={uc} type="button" onClick={() => field.onChange(selected ? field.value.filter((v) => v !== uc) : [...field.value, uc])}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${selected ? "bg-primary/15 text-primary border-primary/30" : "bg-card text-muted-foreground border-border hover:border-muted-foreground/40"}`}>
                        {uc}
                      </button>
                    );
                  })}
                </div>
                {field.value.includes("Other") && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Describe your use case (optional)</Label>
                    <div className="relative mt-1">
                      <Input value={customUseCaseDesc} onChange={(e) => setCustomUseCaseDesc(e.target.value.slice(0, 50))} placeholder="e.g. Legal research, Recipe planning..." className="h-9 text-sm bg-card border-border pr-14" maxLength={50} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{customUseCaseDesc.length} / 50</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">This appears on your post in the feed.</p>
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )} />

            {/* 11. Tags — free-text input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tags (optional)</label>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value.slice(0, 30))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const raw = tagInput.replace(/,/g, "").replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-");
                    if (raw && raw.length <= 30 && customTags.length < 10 && !customTags.includes(raw)) {
                      setCustomTags([...customTags, raw]);
                    }
                    setTagInput("");
                  }
                }}
                placeholder={customTags.length >= 10 ? "" : "Add a tag and press Enter..."}
                disabled={customTags.length >= 10}
                className="bg-card border-border rounded-full"
                maxLength={30}
              />
              {customTags.length >= 10 && (
                <p className="text-xs text-muted-foreground">Maximum 10 tags</p>
              )}
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-2xl"
                      style={{ backgroundColor: "#1E1E2A", color: "#9999AA" }}
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => setCustomTags(customTags.filter((t) => t !== tag))}
                        className="ml-0.5 hover:text-foreground transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 12. Monetisation */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monetisation</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Optional — free by default</p>
              </div>
              <div className="space-y-4">
                {!isBlogType && (["free", "paid"] as const).map((type) => (
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
                  <FormField control={form.control} name="price_gbp" render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-medium">£</span>
                        <FormControl>
                          <Input type="number" step="0.01" min="1" placeholder="4.99" className="bg-background border-border rounded-xl w-32" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div>
                    <p className="text-sm text-foreground">Donation button</p>
                    <p className="text-xs text-muted-foreground">Add a tip button so readers can support your work</p>
                  </div>
                  <FormField control={form.control} name="donation_enabled" render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )} />
                </div>
              </div>
            </div>

            {/* 13. Co-authors */}
            <CollabInvitePicker invitees={collabInvitees} onChange={setCollabInvitees} />

            {/* Revenue Split — inline after co-authors when paid + co-authors */}
            {showRevenueSplit && (
              <div className="border border-border rounded-xl p-5 bg-card space-y-4">
                <div className="border-b border-border pb-3">
                  <h3 className="text-sm font-semibold text-foreground">Split your earnings</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Set how your earnings are split. Co-authors can propose a change after accepting.</p>
                </div>

                {inlineSplits.map((split) => (
                  <div key={split.userId} className="flex items-center gap-3">
                    <Avatar className="h-7 w-7 shrink-0">
                      {split.avatarUrl && <AvatarImage src={split.avatarUrl} />}
                      <AvatarFallback className="text-[10px] bg-accent text-muted-foreground">
                        {(split.displayName || split.username).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground min-w-0 truncate">@{split.username}</span>
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                      <Input
                        type="number" min={1} max={89}
                        value={split.percentage}
                        onChange={(e) => setInlineSplits((prev) => prev.map((s) => s.userId === split.userId ? { ...s, percentage: Number(e.target.value) || 0 } : s))}
                        className="w-20 h-8 text-sm bg-background border-border"
                      />
                      <span className="text-xs text-muted-foreground">% of your creator share</span>
                    </div>
                  </div>
                ))}

                {/* Live summary */}
                <div className={`text-xs ${splitError ? "text-destructive" : "text-muted-foreground"} pt-2 border-t border-border`}>
                  You keep {keepPct}%
                  {inlineSplits.map((s) => <span key={s.userId}> · {s.displayName} gets {s.percentage}%</span>)}
                </div>
                {splitError && <p className="text-xs text-destructive">You must keep at least 10% of your share.</p>}
              </div>
            )}

            {/* 14. Dependencies */}
            <DependencyPicker dependencies={dependencies} onChange={setDependencies} />

            {/* 15. Save Draft + Preview */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="ns-btn-silver flex-1 h-10 rounded-full"
                disabled={savingDraft || submitting}
                onClick={() => saveDraft(false)}
              >
                {savingDraft ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : "Save Draft"}
              </Button>
              <Button
                type="button"
                size="lg"
                className="ns-btn-primary flex-1 h-10 rounded-full"
                disabled={savingDraft || submitting}
                onClick={async () => {
                  const id = await saveDraft(false);
                  if (id) navigate(`/upload/preview/${id}`);
                }}
              >
                Preview Post →
              </Button>
            </div>
          </form>
        </Form>
        )}
      </div>

      <SubmitToolModal open={submitToolOpen} onOpenChange={setSubmitToolOpen} />
    </div>
  );
};

export default Upload;
