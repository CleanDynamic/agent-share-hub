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
import { WorksWithPicker } from "@/components/WorksWithPicker";
import { TopicsPicker } from "@/components/TopicsPicker";
import { ContentBlockBuilder, emptyBlock, type ContentBlock, type BlockOrGroup, type GroupBlock } from "@/components/ContentBlockBuilder";
import { WhatToExpectBuilder, emptyWteBlock, type WteBlock } from "@/components/WhatToExpectBuilder";
import { DependencyPicker, type Dependency } from "@/components/DependencyPicker";
import { DiscussionCompose } from "@/components/DiscussionCompose";
import { BLUEPRINT_CONTENT_TYPES, BOUNTY_CONTENT_TYPES, DIFFICULTIES as DIFF_LIST, displayContentType, TOPICS, getPostType, getPrimaryTypeLabel } from "@/lib/content-types";

// ─── Post type display config (mirrors ContentDetail) ─────────
const POST_TYPE_DISPLAY: Record<string, {
  label: string; emoji: string; color: string;
  bg: string; border: string;
  blueprintLabel: string;
}> = {
  build: {
    label: 'Build', emoji: '🔨', color: '#E8571A',
    bg: 'rgba(232,87,26,0.12)', border: 'rgba(232,87,26,0.25)',
    blueprintLabel: 'The Blueprint',
  },
  technique: {
    label: 'Technique', emoji: '⚡', color: '#2EC4B6',
    bg: 'rgba(46,196,182,0.12)', border: 'rgba(46,196,182,0.25)',
    blueprintLabel: 'The Technique',
  },
  discovery: {
    label: 'Discovery', emoji: '🔍', color: '#7C3AED',
    bg: 'rgba(124,58,237,0.12)', border: 'rgba(124,58,237,0.25)',
    blueprintLabel: 'Evidence',
  },
  discussion: {
    label: 'Blog', emoji: '💬', color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)',
    blueprintLabel: 'Context',
  },
};

// ─── Block icon map for TOC and chips ─────────
const BLOCK_ICON_MAP: Record<string, string> = {
  prompt: '💬', code: '{ }', result: '📊',
  image: '🖼', text: '¶', long_text: '¶',
  agent_config: '🤖', workflow: '🔄',
  model_params: '⚙️', tool_setup: '🔧',
  comparison: '↔', resource: '🔗',
  section_heading: '§',
};

const CONTENT_TYPES = BLUEPRINT_CONTENT_TYPES;
const DIFFICULTIES = [...DIFF_LIST, "Any"];
const USE_CASES = ["Social Media", "Research", "Business", "Productivity", "Content", "Learning", "Email", "Finance", "Hobby", "Other"];
const ACCEPTED_TYPES = [".txt", ".md", ".json", ".pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const schema = z.object({
  post_type: z.enum(['build','technique','discovery','discussion']).default('build'),
  title: z.string().trim().min(1, "Title is required").max(200),
  content_type: z.string().optional().default(''),
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

// Flatten groups into a linear list of ContentBlocks for DB storage.
// Each group produces: a section_heading (for the group title) + its child
// blocks, all tagged with groupId and groupTitle.
type FlatBlock = ContentBlock & { groupId?: string; groupTitle?: string; position: number };
const flattenBlocks = (items: BlockOrGroup[]): FlatBlock[] => {
  const result: FlatBlock[] = [];
  items.forEach((item, i) => {
    if ((item as any).type === 'group') {
      const group = item as GroupBlock;
      // Insert the group heading as a section_heading
      result.push({
        id: group.id,
        subheading: group.title,
        type: 'section_heading',
        textContent: group.title,
        formatting: 'paragraph',
        subBlocks: [],
        useInstructions: '',
        file: null,
        imageFile: null,
        imageDescription: '',
        variations: [],
        isPreview: false,
        externalFileUrl: '',
        githubDescription: '',
        largeFilePlatform: '',
        largeFileCustomPlatform: '',
        largeFileDescription: '',
        largeFileSizeHint: '',
        promptRole: 'user',
        promptModel: '',
        promptVariables: [],
        promptExampleOutput: '',
        agentModel: '',
        agentTemperature: 0.7,
        agentMaxTokens: 4000,
        agentTools: [],
        agentMemoryType: '',
        agentCapabilities: [],
        workflowTrigger: '',
        workflowOutput: '',
        workflowSteps: [],
        modelName: '',
        modelTemperature: 0.7,
        modelTopP: 1.0,
        modelMaxTokens: 4000,
        modelSystemPrompt: '',
        modelStopSequences: [],
        modelReasoning: '',
        toolName: '',
        toolUrl: '',
        toolPrerequisites: [],
        toolSteps: [],
        toolErrors: [],
        toolTimeEstimate: '',
        codeLanguage: 'python',
        codeDependencies: [],
        codeEnvVars: [],
        codeRunInstructions: '',
        codeExampleOutput: '',
        resultBefore: '',
        resultAfter: '',
        resultMetrics: [],
        resultVerdict: '',
        resultRating: 0,
        comparisonLabelA: 'Option A',
        comparisonLabelB: 'Option B',
        comparisonTypeA: 'text',
        comparisonTypeB: 'text',
        comparisonContentA: {},
        comparisonContentB: {},
        comparisonAxis: '',
        comparisonVerdict: '',
        resourceTitle: '',
        resourceType: 'article',
        resourceAnnotation: '',
        resourceIsPaywalled: false,
        resourceDescription: '',
        groupId: group.id,
        groupTitle: group.title,
        position: i * 100 - 1,
      });
      group.blocks.forEach((b, bi) => {
        result.push({
          ...b,
          groupId: group.id,
          groupTitle: group.title,
          position: i * 100 + bi,
        });
      });
    } else {
      result.push({ ...(item as ContentBlock), position: i * 100 } as FlatBlock);
    }
  });
  return result.sort((a, b) => a.position - b.position);
};

const Upload = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const { toast } = useToast();
  const { data: AI_TOOLS } = useApprovedToolNames();
  const { groups: toolGroups } = useGroupedApprovedTools();
  const [showTypeChooser, setShowTypeChooser] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uploadType, setUploadType] = useState<"blog" | "single" | "bounty">("single");
  const [isProjectMode, setIsProjectMode] = useState(false);
  const [contentBlocks, setContentBlocks] = useState<BlockOrGroup[]>([]);
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
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [githubUrl, setGithubUrl] = useState("");
  const [githubImporting, setGithubImporting] = useState(false);
  const [showGithubImport, setShowGithubImport] = useState(false);
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
  const [bountyTipGbp, setBountyTipGbp] = useState<number | null>(null);
  const [bountyDeadlineDays, setBountyDeadlineDays] = useState<number | null>(null);
  const [bountyGap, setBountyGap] = useState("");
  const [bountyBlueprintRequired, setBountyBlueprintRequired] = useState(true);
  const [blueprintExpanded, setBlueprintExpanded] = useState(false);
  const [discussionThreads, setDiscussionThreads] = useState<string[]>(['']);
  const autosaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutosaveRef = useRef<Date | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      post_type: 'build',
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
  const isBlogType = uploadType === "blog";
  const isBountyType = uploadType === "bounty";
  const watchedAiTools = form.watch("ai_tools");
  const isOtherSelected = watchedAiTools?.includes("Other");
  const watchedPostType = form.watch('post_type');
  const isDiscussion = watchedPostType === 'discussion';

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

  useEffect(() => {
    const pt = searchParams.get('post_type');
    if (pt && ['build','technique','discovery','discussion'].includes(pt)) {
      form.setValue('post_type', pt as any);
      setShowTypeChooser(false);
    }
  }, []);

  // When a draft is loaded, skip the type chooser
  useEffect(() => {
    if (draftId) setShowTypeChooser(false);
  }, [draftId]);

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
        if ((item as any).topics?.length > 0) setSelectedTopics((item as any).topics);
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
          } as any)));
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
    const hasContent = values.title || values.content_type || values.description || contentBlocks.some(b => {
      if ((b as any).type === 'group') return (b as GroupBlock).blocks.length > 0 || (b as GroupBlock).title;
      const cb = b as ContentBlock;
      return cb.textContent || cb.file || cb.imageFile;
    });
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
        topics: selectedTopics,
        monetisation_type: values.monetisation_type,
        price_gbp: values.monetisation_type === "paid" && !isPwyw ? values.price_gbp ?? null : null,
        donation_enabled: values.donation_enabled,
        pwyw_enabled: isPwyw,
        pwyw_floor_gbp: isPwyw ? pwywFloor : null,
        is_pwyw: isPwyw,
        post_category: isBountyType ? "bounty" : isBlogType ? "blog" : "blueprint",
        bounty_enabled: isBountyType ? bountyBlueprintRequired : false,
        bounty_gap: isBountyType && bountyGap.trim() ? bountyGap.trim() : null,
        bounty_tip_gbp: isBountyType && bountyTipGbp !== null ? bountyTipGbp : null,
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
      const draftFlatBlocks = flattenBlocks(contentBlocks);
      for (let i = 0; i < draftFlatBlocks.length; i++) {
        const block = draftFlatBlocks[i];
        await supabase.from("content_blocks").insert({
          content_id: draftIdToUse,
          position: i + 1,
          group_id: block.groupId || null,
          group_title: block.groupTitle || null,
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

          subheading: block.subheading?.trim() || null,

          // Prompt
          prompt_role: block.promptRole || null,
          prompt_model: block.promptModel || null,
          prompt_variables: block.promptVariables?.length
            ? block.promptVariables : null,
          prompt_example_output: block.promptExampleOutput || null,

          // Agent
          agent_model: block.agentModel || null,
          agent_temperature: block.agentTemperature ?? null,
          agent_max_tokens: block.agentMaxTokens || null,
          agent_tools: block.agentTools?.length ? block.agentTools : null,
          agent_memory_type: block.agentMemoryType || null,
          agent_capabilities: block.agentCapabilities?.length
            ? block.agentCapabilities : null,

          // Workflow
          workflow_trigger: block.workflowTrigger || null,
          workflow_output: block.workflowOutput || null,
          workflow_steps: block.workflowSteps?.length
            ? block.workflowSteps : null,

          // Model params
          model_name: block.modelName || null,
          model_temperature: block.modelTemperature ?? null,
          model_top_p: block.modelTopP ?? null,
          model_max_tokens: block.modelMaxTokens || null,
          model_system_prompt: block.modelSystemPrompt || null,
          model_stop_sequences: block.modelStopSequences?.length
            ? block.modelStopSequences : null,
          model_reasoning: block.modelReasoning || null,

          // Tool setup
          tool_name: block.toolName || null,
          tool_url: block.toolUrl || null,
          tool_prerequisites: block.toolPrerequisites?.length
            ? block.toolPrerequisites : null,
          tool_steps: block.toolSteps?.length ? block.toolSteps : null,
          tool_errors: block.toolErrors?.length ? block.toolErrors : null,
          tool_time_estimate: block.toolTimeEstimate || null,

          // Code
          code_language: block.codeLanguage || null,
          code_dependencies: block.codeDependencies?.length
            ? block.codeDependencies : null,
          code_env_vars: block.codeEnvVars?.length
            ? block.codeEnvVars : null,
          code_run_instructions: block.codeRunInstructions || null,
          code_example_output: block.codeExampleOutput || null,

          // Result
          result_before: block.resultBefore || null,
          result_after: block.resultAfter || null,
          result_metrics: block.resultMetrics?.length
            ? block.resultMetrics : null,
          result_verdict: block.resultVerdict || null,
          result_rating: block.resultRating || null,

          // Comparison
          comparison_label_a: block.comparisonLabelA || null,
          comparison_label_b: block.comparisonLabelB || null,
          comparison_type_a: block.comparisonTypeA || null,
          comparison_type_b: block.comparisonTypeB || null,
          comparison_content_a: Object.keys(block.comparisonContentA ?? {}).length
            ? block.comparisonContentA : null,
          comparison_content_b: Object.keys(block.comparisonContentB ?? {}).length
            ? block.comparisonContentB : null,
          comparison_axis: block.comparisonAxis || null,
          comparison_verdict: block.comparisonVerdict || null,

          // Resource
          resource_title: block.resourceTitle || null,
          resource_type: block.resourceType || null,
          resource_annotation: block.resourceAnnotation || null,
          resource_is_paywalled: block.resourceIsPaywalled ?? false,
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
  }, [form, contentBlocks, wteBlocks, currentDraftId, customTags, customUseCaseDesc, toolUrl, otherToolName, isOtherSelected, pwywFloor, toast, isBountyType, isBlogType, bountyBlueprintRequired, bountyGap, bountyTipGbp]);

  // ── Autosave every 60 seconds (fallback) ──
  useEffect(() => {
    autosaveTimer.current = setInterval(() => {
      saveDraft(true);
    }, 60000);
    return () => {
      if (autosaveTimer.current) clearInterval(autosaveTimer.current);
    };
  }, [saveDraft]);

  // ── Debounced autosave: save 2.5s after any canvas change ──
  const watchedTitle = form.watch('title');
  const watchedDescription = form.watch('description');
  const watchedWte = form.watch('what_to_expect');
  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchedTitle?.trim()) {
        saveDraft(true);
      }
    }, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedTitle, watchedDescription, watchedWte, contentBlocks]);

  // ── Scroll to a block by id inside the canvas ──
  const scrollToBlock = useCallback((blockId: string) => {
    const el = document.getElementById(`canvas-block-${blockId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  async function onSubmit(values: FormValues) {
    const isDiscussionSubmit = values.post_type === 'discussion';
    if (isDiscussionSubmit) {
      // Discussion posts collect only the description; derive title and
      // satisfy other required fields so the DB insert succeeds.
      if (!values.description?.trim()) {
        toast({ title: "Write something", description: "Share a thought to start a discussion.", variant: "destructive" });
        return;
      }
      const derivedTitle = values.description.trim().split(/\r?\n/)[0].slice(0, 200);
      values = {
        ...values,
        title: derivedTitle,
        difficulty: 'Any',
        ai_tools: values.ai_tools?.length ? values.ai_tools : ['Any Tool'],
        content_type: values.content_type || 'Open Question',
      };
    }
    const submitFlatBlocks = flattenBlocks(contentBlocks);
    if (!isBountyType && !isDiscussionSubmit && submitFlatBlocks.length === 0) {
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
        const firstTextBlock = submitFlatBlocks.find(b => (b.type === "text" || b.type === "long_text") && b.textContent?.trim());
        finalDescription = firstTextBlock ? firstTextBlock.textContent!.trim().slice(0, 160) : "";
      }

      const { data: insertedItem, error: insertError } = await supabase.from("content_items").insert({
        creator_id: user.id,
        title: values.title,
        post_type: values.post_type,
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
        topics: selectedTopics,
        post_category: isBountyType ? "bounty" : isBlogType ? "blog" : "blueprint",
        bounty_enabled: isBountyType ? bountyBlueprintRequired : false,
        bounty_status: isBountyType ? "open" : null,
        bounty_tip_gbp: isBountyType && bountyTipGbp !== null ? bountyTipGbp : null,
        bounty_deadline: isBountyType && bountyDeadlineDays !== null
          ? new Date(Date.now() + bountyDeadlineDays * 86400000).toISOString()
          : null,
        bounty_gap: isBountyType && bountyGap.trim() ? bountyGap.trim() : null,
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
      for (let i = 0; i < submitFlatBlocks.length; i++) {
        const block = submitFlatBlocks[i];
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
          group_id: block.groupId || null,
          group_title: block.groupTitle || null,
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

          subheading: block.subheading?.trim() || null,

          // Prompt
          prompt_role: block.promptRole || null,
          prompt_model: block.promptModel || null,
          prompt_variables: block.promptVariables?.length
            ? block.promptVariables : null,
          prompt_example_output: block.promptExampleOutput || null,

          // Agent
          agent_model: block.agentModel || null,
          agent_temperature: block.agentTemperature ?? null,
          agent_max_tokens: block.agentMaxTokens || null,
          agent_tools: block.agentTools?.length ? block.agentTools : null,
          agent_memory_type: block.agentMemoryType || null,
          agent_capabilities: block.agentCapabilities?.length
            ? block.agentCapabilities : null,

          // Workflow
          workflow_trigger: block.workflowTrigger || null,
          workflow_output: block.workflowOutput || null,
          workflow_steps: block.workflowSteps?.length
            ? block.workflowSteps : null,

          // Model params
          model_name: block.modelName || null,
          model_temperature: block.modelTemperature ?? null,
          model_top_p: block.modelTopP ?? null,
          model_max_tokens: block.modelMaxTokens || null,
          model_system_prompt: block.modelSystemPrompt || null,
          model_stop_sequences: block.modelStopSequences?.length
            ? block.modelStopSequences : null,
          model_reasoning: block.modelReasoning || null,

          // Tool setup
          tool_name: block.toolName || null,
          tool_url: block.toolUrl || null,
          tool_prerequisites: block.toolPrerequisites?.length
            ? block.toolPrerequisites : null,
          tool_steps: block.toolSteps?.length ? block.toolSteps : null,
          tool_errors: block.toolErrors?.length ? block.toolErrors : null,
          tool_time_estimate: block.toolTimeEstimate || null,

          // Code
          code_language: block.codeLanguage || null,
          code_dependencies: block.codeDependencies?.length
            ? block.codeDependencies : null,
          code_env_vars: block.codeEnvVars?.length
            ? block.codeEnvVars : null,
          code_run_instructions: block.codeRunInstructions || null,
          code_example_output: block.codeExampleOutput || null,

          // Result
          result_before: block.resultBefore || null,
          result_after: block.resultAfter || null,
          result_metrics: block.resultMetrics?.length
            ? block.resultMetrics : null,
          result_verdict: block.resultVerdict || null,
          result_rating: block.resultRating || null,

          // Comparison
          comparison_label_a: block.comparisonLabelA || null,
          comparison_label_b: block.comparisonLabelB || null,
          comparison_type_a: block.comparisonTypeA || null,
          comparison_type_b: block.comparisonTypeB || null,
          comparison_content_a: Object.keys(block.comparisonContentA ?? {}).length
            ? block.comparisonContentA : null,
          comparison_content_b: Object.keys(block.comparisonContentB ?? {}).length
            ? block.comparisonContentB : null,
          comparison_axis: block.comparisonAxis || null,
          comparison_verdict: block.comparisonVerdict || null,

          // Resource
          resource_title: block.resourceTitle || null,
          resource_type: block.resourceType || null,
          resource_annotation: block.resourceAnnotation || null,
          resource_is_paywalled: block.resourceIsPaywalled ?? false,
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

      // Save discussion threads as what_to_expect_blocks
      if (isDiscussionSubmit) {
        const threadBlocks = discussionThreads
          .filter(t => t.trim())
          .map((t, i) => ({
            type: 'text',
            content: t,
            position: i + 1,
          }));

        if (threadBlocks.length > 0) {
          await supabase.from('content_items')
            .update({
              what_to_expect_blocks: threadBlocks as any,
            } as any)
            .eq('id', contentId);
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
    <div style={{ display: 'flex', flexDirection: 'column' as const, height: '100%', overflowY: 'auto' as const, paddingTop: 0, paddingBottom: 80, paddingLeft: 0, paddingRight: 0 }}>
      <SeoHead title="Upload — NeoScale AI" description="Share your AI assistants, blueprints and workflows with the community." path="/upload" />
      <div>
        {/* Draft banner */}
        {draftMeta && (
          <div
            className="mb-5 flex items-center justify-between gap-3"
            style={{ background: 'rgba(186,117,23,0.08)', border: '1px solid rgba(186,117,23,0.30)', borderRadius: 10, padding: '10px 16px' }}
          >
            <p style={{ fontSize: 13, fontWeight: 300, color: '#EF9F27' }}>
              Editing draft — <span style={{ fontWeight: 600 }}>{draftMeta.name}</span>
              <span className="opacity-70 ml-2">· {lastAutosaveRef.current
                ? `Autosaved ${formatDistanceToNow(lastAutosaveRef.current, { addSuffix: true })}`
                : `Last saved ${formatDistanceToNow(new Date(draftMeta.savedAt), { addSuffix: true })}`}</span>
            </p>
            <button onClick={discardDraft} className="hover:underline shrink-0" style={{ fontSize: 12, color: '#EF9F27', background: 'none', border: 'none', cursor: 'pointer' }}>
              Discard draft
            </button>
          </div>
        )}

        {/* ─── Type chooser — shown initially, replaces step 1 ─── */}
        {/* Three primary tiles: Blueprint / Blog / Bounty.
            Blueprint expands to a sub-type picker
            (build / technique / discovery). */}
        {showTypeChooser && (() => {
          const goNext = () => {
            // Default to 'build' if blueprint was chosen but no sub-type explicitly set
            if (blueprintExpanded && !['build','technique','discovery'].includes(form.getValues('post_type'))) {
              form.setValue('post_type', 'build');
            }
            setTimeout(() => setShowTypeChooser(false), 220);
          };

          const UPLOAD_TYPES = [
            {
              value: 'blueprint',
              label: 'Blueprint',
              description: 'A build, technique, or discovery',
              color: '#E8571A',
            },
            {
              value: 'blog',
              label: 'Blog',
              description: 'A thought, question, or open discussion',
              color: '#3B82F6',
            },
            {
              value: 'bounty',
              label: 'Bounty',
              description: 'A challenge with a reward attached',
              color: '#F59E0B',
            },
          ];

          const BLUEPRINT_SUBTYPES = [
            { value: 'build',     label: 'Build',     description: 'Something you made' },
            { value: 'technique', label: 'Technique', description: 'A proven method' },
            { value: 'discovery', label: 'Discovery', description: 'Something you found' },
          ];

          return (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              padding: '24px 20px',
              boxSizing: 'border-box',
              justifyContent: 'center',
            }}>

              {/* Heading */}
              <div style={{
                marginBottom: 32,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'rgba(255,255,255,0.28)',
                  marginBottom: 8,
                }}>
                  What are you sharing?
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 700,
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: 'rgba(255,255,255,0.88)',
                  lineHeight: 1.2,
                }}>
                  Start a post
                </div>
              </div>

              {/* Tiles — vertical stack with Blueprint sub-type expansion */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}>
                {UPLOAD_TYPES.map(type => {
                  const isBlueprintTile = type.value === 'blueprint';
                  const isSelected = isBlueprintTile
                    ? blueprintExpanded
                    : uploadType === type.value;
                  return (
                    <div key={type.value}>
                      <button
                        type="button"
                        onClick={() => {
                          if (isBlueprintTile) {
                            setUploadType('single');
                            setBlueprintExpanded(true);
                          } else {
                            setBlueprintExpanded(false);
                            setUploadType(type.value as any);
                            goNext();
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 16,
                          padding: '18px 20px',
                          borderRadius: 12,
                          width: '100%',
                          background: isSelected
                            ? `${type.color}12`
                            : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isSelected
                            ? type.color + '35'
                            : 'rgba(255,255,255,0.07)'}`,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                          textAlign: 'left',
                        }}
                        onMouseEnter={e => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLElement)
                              .style.background =
                              'rgba(255,255,255,0.05)';
                            (e.currentTarget as HTMLElement)
                              .style.borderColor =
                              'rgba(255,255,255,0.12)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isSelected) {
                            (e.currentTarget as HTMLElement)
                              .style.background =
                              'rgba(255,255,255,0.03)';
                            (e.currentTarget as HTMLElement)
                              .style.borderColor =
                              'rgba(255,255,255,0.07)';
                          }
                        }}
                      >
                        {/* Left: text */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 15, fontWeight: 700,
                            color: isSelected
                              ? type.color
                              : 'rgba(255,255,255,0.80)',
                            marginBottom: 3,
                            fontFamily:
                              "'Playfair Display', Georgia, serif",
                          }}>
                            {type.label}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: 'rgba(255,255,255,0.35)',
                            lineHeight: 1.5,
                          }}>
                            {type.description}
                          </div>
                        </div>

                        {/* Right: arrow */}
                        <span style={{
                          fontSize: 16,
                          color: isSelected
                            ? type.color
                            : 'rgba(255,255,255,0.20)',
                          flexShrink: 0,
                        }}>
                          →
                        </span>
                      </button>

                      {/* Blueprint sub-type picker — expands directly below Blueprint tile */}
                      {isBlueprintTile && blueprintExpanded && (
                        <div style={{
                          marginLeft: 12,
                          borderLeft: '2px solid rgba(232,87,26,0.25)',
                          paddingLeft: 12,
                          marginTop: 8,
                          marginBottom: 2,
                        }}>
                          {BLUEPRINT_SUBTYPES.map(sub => {
                            const subSelected = watchedPostType === sub.value;
                            return (
                              <button
                                key={sub.value}
                                type="button"
                                onClick={() => {
                                  form.setValue('post_type', sub.value as any);
                                  goNext();
                                }}
                                style={{
                                  display: 'block',
                                  width: '100%',
                                  textAlign: 'left',
                                  padding: '8px 12px',
                                  borderRadius: 8,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  marginBottom: 4,
                                  background: subSelected
                                    ? 'rgba(232,87,26,0.10)' : 'transparent',
                                  border: subSelected
                                    ? '1px solid rgba(232,87,26,0.25)'
                                    : '1px solid transparent',
                                  color: subSelected
                                    ? '#E8571A' : 'rgba(255,255,255,0.55)',
                                  transition: 'all 0.12s',
                                }}
                              >
                                <div style={{ fontWeight: 600, marginBottom: 1 }}>
                                  {sub.label}
                                </div>
                                <div style={{ fontSize: 11, opacity: 0.7 }}>
                                  {sub.description}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ─── Canvas body — shown after type is chosen ─── */}
        {!showTypeChooser && (<div style={{ flex: 1, overflowY: 'auto' as const, padding: '20px 24px 0 24px', minHeight: 0 }}>


        {uploadType === "blog" ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Blog: Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Post title..."
                    {...field}
                    maxLength={100}
                    className="text-foreground"
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 0,
                      padding: '12px 0',
                      color: 'rgba(255,255,255,0.90)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(255,255,255,0.16)'}
                    onBlur={e => (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(255,255,255,0.06)'}
                  />
                </FormControl>
                <FormDescription style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)', textAlign: 'right' }}>{field.value.length}/100</FormDescription>
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
                <label
                  className="flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{
                    border: '1.5px dashed rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    height: 140,
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.20)'; (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.01)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLLabelElement).style.background = 'transparent'; }}
                >
                  <ImagePlus style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.28)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Click to upload cover image (.jpg, .png, .webp — max 3MB)</span>
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
            <TopicsPicker
              value={[...(form.watch("use_cases") ?? []), ...selectedTopics]}
              onChange={(topics) => {
                form.setValue("use_cases", topics);
                setSelectedTopics(topics);
              }}
            />

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

            {/* Navigation handled by sticky bar */}
          </form>
        </Form>
        ) : uploadType === "bounty" ? (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* Bounty: Content Type */}
            <FormField control={form.control} name="content_type" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>Bounty type</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="bg-card border-border rounded-xl"><SelectValue placeholder="Select a type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Failure Library">Failure Library — Something that went wrong and why</SelectItem>
                    <SelectItem value="Open Question">Open Question — A problem you haven't solved yet</SelectItem>
                    <SelectItem value="Challenge">Challenge — A task you want the community to attempt</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {/* Bounty: Title */}
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem className="space-y-0">
                <FormControl>
                  <Input
                    placeholder="Describe your failure or challenge..."
                    {...field}
                    className="text-foreground"
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 0,
                      padding: '12px 0',
                      color: 'rgba(255,255,255,0.90)',
                      outline: 'none',
                    }}
                    onFocus={e => (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(255,255,255,0.16)'}
                    onBlur={e => (e.target as HTMLInputElement).style.borderBottomColor = 'rgba(255,255,255,0.06)'}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Bounty: Cover Image */}
            <div className="space-y-1.5">
              <Label>Cover image <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <p className="text-xs text-muted-foreground">Appears in the feed. 1200×630px recommended.</p>
              {coverImagePreview ? (
                <div className="relative">
                  <img src={coverImagePreview} alt="Cover preview" className="w-full rounded-xl object-cover" style={{ maxHeight: 200 }} />
                  <button type="button" onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }} className="absolute top-2 right-2 p-1 rounded-full bg-background/80 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{
                    border: '1.5px dashed rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    height: 140,
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.20)'; (e.currentTarget as HTMLLabelElement).style.background = 'rgba(255,255,255,0.01)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(255,255,255,0.10)'; (e.currentTarget as HTMLLabelElement).style.background = 'transparent'; }}
                >
                  <ImagePlus style={{ width: 22, height: 22, color: 'rgba(255,255,255,0.28)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Click to upload cover image (.jpg, .png, .webp — max 3MB)</span>
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

            {/* Bounty: Description (relabeled) */}
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel>What happened / What's the problem?</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Be specific. What did you try? What went wrong? What have you already ruled out?"
                    className="bg-card border-border rounded-xl"
                    maxLength={500}
                  />
                </FormControl>
                <FormDescription><span className="text-muted-foreground">{(field.value ?? "").length}/500</span></FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            {/* Bounty: The Gap */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">What does a good solution need to do? <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <Input
                  value={bountyGap}
                  onChange={(e) => setBountyGap(e.target.value.slice(0, 300))}
                  placeholder="e.g. The fix must work in ChatGPT 3.5 free tier, requires no plugins, and can be set up in under 10 minutes."
                  className="bg-card border-border rounded-xl pr-16"
                  maxLength={300}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{bountyGap.length}/300</span>
              </div>
            </div>

            {/* Bounty: Works with */}
            <WorksWithPicker
              value={form.watch("ai_tools") ?? []}
              onChange={(tools) => form.setValue("ai_tools", tools)}
              onSubmitToolClick={() => setSubmitToolOpen(true)}
            />

            {/* Bounty: Difficulty */}
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
                <FormMessage />
              </FormItem>
            )} />

            {/* Bounty: Topics */}
            <TopicsPicker
              value={[...(form.watch("use_cases") ?? []), ...selectedTopics]}
              onChange={(topics) => {
                form.setValue("use_cases", topics);
                setSelectedTopics(topics);
              }}
            />

            {/* Bounty: Tags */}
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
              {customTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {customTags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-2xl" style={{ backgroundColor: "#1E1E2A", color: "#9999AA" }}>
                      #{tag}
                      <button type="button" onClick={() => setCustomTags(customTags.filter((t) => t !== tag))} className="ml-0.5 hover:text-foreground transition-colors">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bounty Settings */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Bounty Settings</h3>

              {/* Tip */}
              <div className="space-y-2">
                <Label className="text-sm">Tip for solver (optional)</Label>
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
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label className="text-sm">Close after</Label>
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

              {/* Blueprint response required */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div>
                  <p className="text-sm text-foreground">I need a Blueprint response</p>
                  <p className="text-xs text-muted-foreground">When on, responses must be Blueprints. When off, free-text comments only.</p>
                </div>
                <Switch checked={bountyBlueprintRequired} onCheckedChange={setBountyBlueprintRequired} />
              </div>
            </div>

            {/* Bounty: Monetisation */}
            <div className="border border-border rounded-xl p-5 bg-card space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Monetisation</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Optional — free by default</p>
              </div>
              <div className="space-y-4">
                {(["free", "paid"] as const).map((type) => (
                  <div key={type} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{type === "free" ? "Free" : "Paid (fixed price)"}</p>
                      <p className="text-xs text-muted-foreground">{type === "free" ? "Anyone can view for free" : "Set a price in GBP"}</p>
                    </div>
                    <Switch
                      checked={form.watch("monetisation_type") === type}
                      onCheckedChange={(checked) => { if (checked) form.setValue("monetisation_type", type); }}
                    />
                  </div>
                ))}
                {form.watch("monetisation_type") === "paid" && (
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
              </div>
            </div>

            {/* Bounty: Co-authors */}
            <CollabInvitePicker invitees={collabInvitees} onChange={setCollabInvitees} />

            {/* Bounty: Dependencies */}
            <DependencyPicker dependencies={dependencies} onChange={setDependencies} />

            {/* Navigation handled by sticky bar */}
          </form>
        </Form>
        ) : (
        <>
          {/* Project toggle — compact chip */}
          {!isBountyType && !isBlogType && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12,
            }}>
              <button
                type="button"
                onClick={() => setIsProjectMode(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 9999, fontSize: 11,
                  fontWeight: 600, cursor: 'pointer',
                  background: isProjectMode
                    ? 'rgba(232,87,26,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isProjectMode
                    ? 'rgba(232,87,26,0.35)' : 'rgba(255,255,255,0.09)'}`,
                  color: isProjectMode
                    ? '#E8571A' : 'rgba(255,255,255,0.35)',
                  transition: 'all 0.15s',
                }}
              >
                {isProjectMode ? 'Project mode ON' : 'Make this a Project'}
              </button>
              {isProjectMode && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                  Groups multiple posts together
                </span>
              )}
            </div>
          )}

          {isProjectMode ? (
            <ProjectUploadForm />
          ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

            {/* ─── Discussion tweet-compose ─── */}
            {isDiscussion && (
              <DiscussionCompose
                form={form}
                threads={discussionThreads}
                setThreads={setDiscussionThreads}
                onPost={() => onSubmit(form.getValues() as any)}
                submitting={submitting}
              />
            )}

            {/* ─── Canvas header: badges, title, description (mirrors ContentDetail) ─── */}
            {!isDiscussion && (() => {
              const postType = form.watch('post_type');
              const ptConfig = POST_TYPE_DISPLAY[postType] ?? POST_TYPE_DISPLAY.build;
              const typeInfo = getPrimaryTypeLabel(postType);
              const diff = form.watch('difficulty');
              const diffColors: Record<string,string> = {
                Beginner: '#22C55E',
                Intermediate: '#F59E0B',
                Advanced: '#EF4444',
                Any: '#9CA3AF',
              };
              const cycleDiff = () => {
                const order = ['Beginner','Intermediate','Advanced','Any'];
                const i = order.indexOf(diff);
                const next = order[(i + 1) % order.length];
                form.setValue('difficulty', next);
              };
              return (
                <div>
                  {/* ── SECTION 1: Badges row ── */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: 8, flexWrap: 'wrap', marginBottom: 14,
                  }}>
                    {/* Post type badge — click to change type */}
                    <button
                      type="button"
                      onClick={() => setShowTypeChooser(true)}
                      title="Click to change post type"
                      style={{
                        display: 'inline-flex', alignItems: 'center',
                        gap: 6, padding: '3px 12px', borderRadius: 9999,
                        background: ptConfig.bg,
                        border: `1px solid ${ptConfig.border}`,
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: ptConfig.color,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}>
                        {typeInfo.label}
                      </span>
                      {typeInfo.sub && (
                        <span style={{
                          fontSize: 9,
                          color: 'rgba(255,255,255,0.35)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          borderLeft: '1px solid rgba(255,255,255,0.15)',
                          paddingLeft: 6, marginLeft: 2,
                        }}>
                          {typeInfo.sub}
                        </span>
                      )}
                      <span style={{
                        fontSize: 9, color: 'rgba(255,255,255,0.30)',
                        marginLeft: 2,
                      }}>↕</span>
                    </button>

                    {/* Difficulty badge — click to cycle */}
                    {['build','technique'].includes(postType) && (
                      <button
                        type="button"
                        onClick={cycleDiff}
                        title="Click to cycle difficulty"
                        style={{
                          padding: '3px 12px', borderRadius: 9999,
                          fontSize: 10, fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          cursor: 'pointer',
                          background: diff ? `${diffColors[diff] ?? '#9CA3AF'}22` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${diff ? (diffColors[diff] ?? '#9CA3AF') : 'rgba(255,255,255,0.10)'}40`,
                          color: diff ? (diffColors[diff] ?? '#9CA3AF') : 'rgba(255,255,255,0.45)',
                        }}
                      >
                        {diff || 'Set difficulty'}
                      </button>
                    )}

                    {/* Cover image chip */}
                    {!coverImagePreview ? (
                      <label style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '3px 12px', borderRadius: 9999, fontSize: 10,
                        fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.40)', cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
                          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.40)';
                        }}
                      >
                        Add cover
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 3 * 1024 * 1024) {
                              toast({ title: 'Image too large', description: 'Max 3MB', variant: 'destructive' });
                              return;
                            }
                            setCoverImageFile(file);
                            const reader = new FileReader();
                            reader.onload = ev => setCoverImagePreview(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    ) : (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '2px 4px 2px 8px', borderRadius: 9999,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                      }}>
                        <img
                          src={coverImagePreview}
                          alt="cover"
                          style={{
                            width: 20, height: 20, objectFit: 'cover',
                            borderRadius: '50%',
                          }}
                        />
                        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)' }}>
                          Cover
                        </span>
                        <button
                          type="button"
                          onClick={() => { setCoverImageFile(null); setCoverImagePreview(null); }}
                          style={{
                            fontSize: 12, color: 'rgba(255,255,255,0.35)',
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '0 6px',
                          }}
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  {/* ── SECTION 2: Title (inline H1) ── */}
                  <input
                    {...form.register('title')}
                    placeholder={
                      postType === 'build'      ? 'Title your Blueprint...' :
                      postType === 'technique'  ? 'Name this technique...' :
                      postType === 'discovery'  ? 'What did you discover?' :
                      'Title your post...'
                    }
                    maxLength={200}
                    style={{
                      width: '100%',
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: 22, fontWeight: 700,
                      color: 'rgba(255,255,255,0.95)',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      outline: 'none',
                      padding: '4px 0 10px 0',
                      marginBottom: 16, lineHeight: 1.25,
                      letterSpacing: '-0.3px',
                      boxSizing: 'border-box' as const,
                    }}
                    onFocus={e => (e.target.style.borderBottomColor = 'rgba(255,255,255,0.15)')}
                    onBlur={e => (e.target.style.borderBottomColor = 'rgba(255,255,255,0.06)')}
                  />
                  {form.formState.errors.title && (
                    <div style={{ fontSize: 12, color: '#EF4444', marginTop: -12, marginBottom: 12 }}>
                      {form.formState.errors.title.message}
                    </div>
                  )}

                  {/* ── SECTION 3: Description (inline paragraph) ── */}
                  <textarea
                    {...form.register('description')}
                    placeholder="Describe what this is and why it matters..."
                    rows={3}
                    maxLength={500}
                    style={{
                      width: '100%',
                      fontSize: 15, fontWeight: 400,
                      color: 'rgba(255,255,255,0.65)',
                      lineHeight: 1.75,
                      background: 'transparent',
                      border: 'none', outline: 'none',
                      resize: 'none' as const, padding: 0,
                      marginBottom: 6,
                      fontFamily: 'Inter, sans-serif',
                      boxSizing: 'border-box' as const,
                    }}
                  />
                  <div style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.20)',
                    textAlign: 'right' as const, marginBottom: 18,
                  }}>
                    {(form.watch('description') ?? '').length} / 500
                  </div>

                  {/* ── SECTION 4: Blueprint divider (hairlines with centered label) ── */}
                  {contentBlocks.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      gap: 8, margin: '24px 0 20px 0',
                    }}>
                      <div style={{
                        height: 1, flex: 1,
                        background: 'rgba(255,255,255,0.06)',
                      }} />
                      <div style={{
                        fontSize: 10, fontWeight: 700,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.12em',
                        color: 'rgba(255,255,255,0.25)',
                        padding: '0 8px', flexShrink: 0,
                      }}>
                        {ptConfig.blueprintLabel}
                      </div>
                      <div style={{
                        height: 1, flex: 1,
                        background: 'rgba(255,255,255,0.06)',
                      }} />
                    </div>
                  )}
                </div>
              );
            })()}

            {!isDiscussion && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Block canvas — live document-style block editor */}
              <ContentBlockBuilder
                blocks={contentBlocks}
                onChange={setContentBlocks}
              />
            </div>
            )}

            {/* ─── What to Expect — inline document section ─── */}
            {!isDiscussion && (() => {
              const postType = form.watch('post_type');
              const WTE_CONFIG: Record<string, {
                label: string;
                placeholder: string;
                emoji: string;
                color: string;
              }> = {
                build: {
                  label: 'Outcome',
                  placeholder: 'Outcome: What will readers be able to do after following this?',
                  emoji: '🎯',
                  color: '#E8571A',
                },
                technique: {
                  label: 'The Claim',
                  placeholder: 'The Claim: What does this technique actually achieve?',
                  emoji: '⚡',
                  color: '#2EC4B6',
                },
                discovery: {
                  label: 'The Finding',
                  placeholder: 'The Finding: State what you discovered as clearly as you can.',
                  emoji: '🔍',
                  color: '#7C3AED',
                },
                discussion: {
                  label: "What you're looking for",
                  placeholder: "What you're looking for: What kind of responses do you want?",
                  emoji: '💬',
                  color: '#3B82F6',
                },
              };
              const cfg = WTE_CONFIG[postType] ?? WTE_CONFIG.build;
              return (
                <div style={{ margin: '32px 0 8px 0' }}>
                  {/* Section divider */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    gap: 8, marginBottom: 14,
                  }}>
                    <div style={{
                      height: 1, flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                    }} />
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.12em',
                      color: cfg.color,
                      padding: '0 8px',
                      opacity: 0.70,
                    }}>
                      {cfg.label}
                    </div>
                    <div style={{
                      height: 1, flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                    }} />
                  </div>

                  <textarea
                    {...form.register('what_to_expect')}
                    placeholder={cfg.placeholder}
                    rows={3}
                    maxLength={2000}
                    style={{
                      width: '100%',
                      background: `${cfg.color}08`,
                      border: `1px solid ${cfg.color}20`,
                      borderLeft: `3px solid ${cfg.color}50`,
                      borderRadius: 8, padding: '12px 14px',
                      fontSize: 14, color: 'rgba(255,255,255,0.72)',
                      outline: 'none', resize: 'vertical' as const,
                      fontFamily: 'Inter, sans-serif',
                      lineHeight: 1.65, boxSizing: 'border-box' as const,
                    }}
                  />
                  <div style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.20)',
                    textAlign: 'right' as const, marginTop: 4,
                  }}>
                    {(form.watch('what_to_expect') ?? '').length} / 2000
                  </div>
                </div>
              );
            })()}

            {/* ─── Details accordion — collapsed by default ─── */}
            {!isDiscussion && (<>
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setDetailsOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 8, width: '100%',
                  background: 'none', border: 'none',
                  cursor: 'pointer',
                  padding: '10px 0',
                  borderTop: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.12em',
                  color: 'rgba(255,255,255,0.25)',
                }}>
                  Details
                </span>
                <div style={{
                  flex: 1, height: 1,
                  background: 'rgba(255,255,255,0.05)',
                }} />
                <span style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.25)',
                }}>
                  {detailsOpen ? '▴' : '▾'}
                </span>
              </button>
            </div>
            {detailsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 16 }}>

              {/* Works With */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Works with
                </div>
                <div style={{
                  fontSize: 12, color: 'rgba(255,255,255,0.35)',
                  marginBottom: 12,
                }}>
                  Which tools have you tested this with?
                </div>
                <WorksWithPicker
                  value={form.watch("ai_tools") ?? []}
                  onChange={(tools) => form.setValue("ai_tools", tools)}
                  onSubmitToolClick={() => setSubmitToolOpen(true)}
                />
              </div>

              {/* Topics */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Topics
                </div>
                <TopicsPicker
                  value={[...(form.watch("use_cases") ?? []), ...selectedTopics]}
                  onChange={(topics) => {
                    form.setValue("use_cases", topics);
                    setSelectedTopics(topics);
                  }}
                />
              </div>

              {/* Tags */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Tags — optional
                </div>
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
                  <p className="text-xs text-muted-foreground mt-1">Maximum 10 tags</p>
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

              {/* Pricing */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Pricing
                </div>
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
              </div>

              {/* Co-authors */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Co-authors — optional
                </div>
                <CollabInvitePicker invitees={collabInvitees} onChange={setCollabInvitees} />
              </div>

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

              {/* Dependencies */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Dependencies — optional
                </div>
                <DependencyPicker dependencies={dependencies} onChange={setDependencies} />
              </div>

              {/* Import from GitHub */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.30)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  marginBottom: 12,
                }}>
                  Import from GitHub — optional
                </div>
                {!showGithubImport ? (
                  <button type="button" onClick={() => setShowGithubImport(true)}
                    className="text-xs hover:underline flex items-center gap-1"
                    style={{ color: 'rgba(255,255,255,0.45)' }}>
                    📥 Import from GitHub README
                  </button>
                ) : (
                  <div style={{
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12,
                    padding: 16,
                    background: 'rgba(255,255,255,0.02)',
                  }} className="space-y-3">
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Paste a GitHub repo URL. We'll fetch the README and pre-fill your blocks.</p>
                    <div className="flex gap-2">
                      <Input
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        className="bg-background border-border text-sm flex-1"
                      />
                      <Button type="button" size="sm" disabled={githubImporting || !githubUrl.includes("github.com")}
                        onClick={async () => {
                          setGithubImporting(true);
                          try {
                            const { data, error } = await supabase.functions.invoke("import-github-readme", { body: { url: githubUrl } });
                            if (error || data?.error) throw new Error(data?.error || "Import failed");
                            if (data.title) form.setValue("title", data.title);
                            if (data.description) form.setValue("description", data.description);
                            if (data.markdown) {
                              setContentBlocks([{ id: crypto.randomUUID(), type: "long_text", textContent: data.markdown, formatting: "paragraph", subBlocks: [], useInstructions: "", file: null, imageFile: null, imageDescription: "", externalFileUrl: "", variations: [], isPreview: false } as any]);
                            }
                            setShowGithubImport(false);
                            setGithubUrl("");
                            toast({ title: "Imported!", description: `Pre-filled from ${data.source}` });
                          } catch (err: any) {
                            toast({ title: "Import failed", description: err.message, variant: "destructive" });
                          } finally {
                            setGithubImporting(false);
                          }
                        }}>
                        {githubImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Fetch"}
                      </Button>
                    </div>
                    <button type="button" onClick={() => { setShowGithubImport(false); setGithubUrl(""); }}
                      className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Cancel</button>
                  </div>
                )}
              </div>

            </div>
            )}
            </>)}

            {/* ─── Upload Action Bar — sticky bottom ─── */}
            {!isDiscussion && (
            <div style={{
              position: 'sticky',
              bottom: 0,
              background: 'rgba(8,8,12,0.95)',
              backdropFilter: 'blur(20px)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '12px 0 16px 0',
              marginTop: 24,
              zIndex: 10,
            }}>
              {/* Action bar: autosave indicator + save/publish */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '0 8px',
              }}>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.30)',
                }}>
                  {savingDraft ? (
                    <span>Saving…</span>
                  ) : draftMeta ? (
                    <span>Draft saved</span>
                  ) : (
                    <span>Changes unsaved</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => saveDraft(false)}
                    disabled={savingDraft}
                    style={{
                      padding: '8px 16px', borderRadius: 8,
                      fontSize: 12, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      color: 'rgba(255,255,255,0.55)',
                      fontFamily: 'Inter',
                    }}
                  >
                    Save draft
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      padding: '8px 20px', borderRadius: 8,
                      fontSize: 12, fontWeight: 700,
                      cursor: submitting ? 'default' : 'pointer',
                      background: submitting
                        ? 'rgba(232,87,26,0.40)' : '#E8571A',
                      border: 'none', color: '#fff',
                      fontFamily: 'Inter',
                    }}
                  >
                    {submitting ? 'Publishing…' : 'Publish'}
                  </button>
                </div>
              </div>
            </div>
            )}

          </form>
        </Form>
          )}
        </>
        )}

        </div>)}
      </div>

      <SubmitToolModal open={submitToolOpen} onOpenChange={setSubmitToolOpen} />
    </div>
  );
};

export default Upload;
