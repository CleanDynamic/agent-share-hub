import React, { useReducer, useMemo, useEffect, useState } from "react";
import {
  ArrowLeft,
  HelpCircle,
  Lock,
  Link2,
  Globe,
  Check,
  AlertTriangle,
  Loader2,
  FileText,
  LayoutGrid,
  Box,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { AutoDetectedCard } from "./AutoDetectedCard";
import { TagInput } from "./TagInput";
import { useTagSuggestions, useSlugAvailability } from "./usePublishMetaQueries";
import { supabase } from "@/integrations/supabase/client";
import {
  BountyDetailsCard,
  type BountyDetailsValue,
  type RewardType,
} from "./BountyDetailsCard";

export type PostType = "blueprint" | "blog" | "bounty";

export interface AutoDetectedMeta {
  word_count?: number | null;
  estimated_reading_minutes?: number | null;
  stage_count?: number | null;
  block_count?: number | null;
  connection_count?: number | null;
  block_types_used?: string[] | null;
  models_referenced?: string[] | null;
  tools_referenced?: string[] | null;
  /** Blog-only: parent blueprint IDs that this blog references inline. */
  blog_referenced_post_ids?: string[] | null;
}

export interface PublishFormValues {
  useCase: string;
  domain: string;
  difficulty: string;
  tags: string[];
  prerequisites: string;
  outcome: string;
  visibility: string;
  slug: string;
  /** Blog-only */
  topicCategory: string;
  /** Bounty-only */
  bountyRewardType: RewardType;
  bountyRewardAmount: number | null;
  bountyRewardCurrency: string | null;
  bountyDeadline: Date | null;
  bountyAcceptanceCriteria: string;
}

interface PublishMetadataFormProps {
  contentItemId?: string;
  postType?: PostType;
  defaultValues?: Partial<PublishFormValues>;
  autoDetected?: AutoDetectedMeta;
  /** Bounty-only: live counts derived from the document's stage_grids JSONB. */
  missingStageCount?: number;
  missingBlockCount?: number;
  authorUsername?: string;
  onPublish: (values: PublishFormValues) => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onBack: () => void;
  onChange?: (values: PublishFormValues) => void;
  isPublishing?: boolean;
  publishLabel?: string;
  /** Increment to revert local form state back to defaultValues. */
  resetSignal?: number;
}

const DOMAINS = [
  "Academic",
  "Finance",
  "Marketing",
  "Engineering",
  "Creative",
  "Productivity",
  "Research",
  "Other",
];

const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

const VISIBILITIES = [
  { value: "private", label: "Private", icon: Lock },
  { value: "unlisted", label: "Unlisted", icon: Link2 },
  { value: "public", label: "Public", icon: Globe },
];

const BLOG_TOPIC_CATEGORIES = [
  "Tutorial",
  "Opinion",
  "Case Study",
  "News",
  "Reference",
  "Other",
];

/* ── Per-post-type theming ─────────────────────── */

interface PostTypeTheme {
  label: string;
  pillBg: string;
  pillText: string;
  accent: string;
  accentSoft: string;
  publishGradient: string;
  pageTitle: string;
  publishedToast: string;
  updatedToast: string;
}

const POST_TYPE_THEMES: Record<PostType, PostTypeTheme> = {
  blueprint: {
    label: "BLUEPRINT",
    pillBg: "rgba(232,87,26,0.14)",
    pillText: "#E8571A",
    accent: "#E8571A",
    accentSoft: "rgba(232,87,26,0.10)",
    publishGradient: "linear-gradient(135deg, #E8571A 0%, #D4470F 100%)",
    pageTitle: "Publish blueprint",
    publishedToast: "Blueprint published",
    updatedToast: "Blueprint updated",
  },
  blog: {
    label: "BLOG",
    pillBg: "rgba(46,196,182,0.14)",
    pillText: "#2EC4B6",
    accent: "#2EC4B6",
    accentSoft: "rgba(46,196,182,0.10)",
    publishGradient: "linear-gradient(135deg, #2EC4B6 0%, #1F9E91 100%)",
    pageTitle: "Publish blog",
    publishedToast: "Blog published",
    updatedToast: "Blog updated",
  },
  bounty: {
    label: "BOUNTY",
    pillBg: "rgba(245,158,11,0.14)",
    pillText: "#F59E0B",
    accent: "#F59E0B",
    accentSoft: "rgba(245,158,11,0.10)",
    publishGradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    pageTitle: "Post bounty",
    publishedToast: "Bounty posted",
    updatedToast: "Bounty updated",
  },
};

export function getPostTypeTheme(postType: PostType): PostTypeTheme {
  return POST_TYPE_THEMES[postType] ?? POST_TYPE_THEMES.blueprint;
}

/* ── State ───────────────────────────────────────── */

type FormAction =
  | { type: "set"; field: keyof PublishFormValues; value: any }
  | { type: "reset"; values: PublishFormValues };

function formReducer(state: PublishFormValues, action: FormAction): PublishFormValues {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "reset":
      return action.values;
    default:
      return state;
  }
}

function buildInitial(d: Partial<PublishFormValues> = {}): PublishFormValues {
  return {
    useCase: d.useCase || "",
    domain: d.domain || "",
    difficulty: d.difficulty || "",
    tags: d.tags || [],
    prerequisites: d.prerequisites || "",
    outcome: d.outcome || "",
    visibility: d.visibility || "public",
    slug: d.slug || "",
    topicCategory: d.topicCategory || "",
    bountyRewardType: d.bountyRewardType ?? "none",
    bountyRewardAmount: d.bountyRewardAmount ?? null,
    bountyRewardCurrency: d.bountyRewardCurrency ?? null,
    bountyDeadline: d.bountyDeadline ?? null,
    bountyAcceptanceCriteria: d.bountyAcceptanceCriteria || "",
  };
}

/* ── Validation ───────────────────────────────────── */

const SLUG_RE = /^[a-z0-9-]+$/;

export interface BountyValidationContext {
  postType: PostType;
  missingItemCount: number;
}

function validate(
  v: PublishFormValues,
  ctx: BountyValidationContext = { postType: "blueprint", missingItemCount: 0 },
) {
  const errors: Partial<Record<keyof PublishFormValues, string>> = {};
  const bountyErrors: Partial<
    Record<
      "rewardType" | "rewardAmount" | "rewardCurrency" | "acceptanceCriteria" | "missingItems",
      string
    >
  > = {};

  const useCase = v.useCase.trim();
  if (!useCase) errors.useCase = "Required";
  else if (useCase.length < 8) errors.useCase = "At least 8 characters";
  else if (useCase.length > 140) errors.useCase = "Max 140 characters";

  if (!v.domain) errors.domain = "Required";
  if (!v.difficulty) errors.difficulty = "Required";

  if (!v.tags.length) errors.tags = "Add at least 1 tag";
  else if (v.tags.length > 8) errors.tags = "Max 8 tags";

  if (!v.visibility) errors.visibility = "Required";

  const slug = v.slug.trim().toLowerCase();
  if (!slug) errors.slug = "Required";
  else if (slug.length < 3) errors.slug = "At least 3 characters";
  else if (!SLUG_RE.test(slug)) errors.slug = "Lowercase letters, numbers, hyphens only";

  const isBounty = ctx.postType === "bounty";
  let bountyComplete = true;

  if (isBounty) {
    if (v.bountyRewardType === "cash" || v.bountyRewardType === "token") {
      if (v.bountyRewardAmount === null || v.bountyRewardAmount <= 0) {
        bountyErrors.rewardAmount = "Enter an amount greater than 0";
      }
      if (
        !v.bountyRewardCurrency ||
        v.bountyRewardCurrency.trim().length === 0
      ) {
        bountyErrors.rewardCurrency = "Pick a currency";
      }
    }
    const criteria = v.bountyAcceptanceCriteria.trim();
    if (criteria.length < 50) {
      bountyErrors.acceptanceCriteria =
        "At least 50 characters — describe what 'done' looks like";
    }
    if (ctx.missingItemCount === 0) {
      bountyErrors.missingItems =
        "Mark at least one stage or block as missing in the editor";
    }

    bountyComplete =
      !bountyErrors.rewardAmount &&
      !bountyErrors.rewardCurrency &&
      !bountyErrors.acceptanceCriteria &&
      !bountyErrors.missingItems;
  }

  // 5 logical required fields: useCase, domain, difficulty, tags, slug+visibility.
  // Bounties add a 6th logical field (bounty section) so the progress bar reflects it.
  const completed = {
    useCase: !errors.useCase,
    domain: !errors.domain,
    difficulty: !errors.difficulty,
    tags: !errors.tags,
    slugVisibility: !errors.slug && !errors.visibility,
    bounty: isBounty ? bountyComplete : true,
  };
  const total = isBounty ? 6 : 5;
  const requiredFieldsCompleted =
    Number(completed.useCase) +
    Number(completed.domain) +
    Number(completed.difficulty) +
    Number(completed.tags) +
    Number(completed.slugVisibility) +
    (isBounty ? Number(completed.bounty) : 0);

  return { errors, bountyErrors, completed, requiredFieldsCompleted, total };
}

/* ── Component ───────────────────────────────────── */

export function PublishMetadataForm({
  contentItemId,
  postType = "blueprint",
  defaultValues = {},
  autoDetected,
  authorUsername = "you",
  onPublish,
  onSaveDraft,
  onDiscard,
  onBack,
  onChange,
  isPublishing = false,
  publishLabel = "Publish",
  resetSignal = 0,
}: PublishMetadataFormProps) {
  const [state, dispatch] = useReducer(formReducer, buildInitial(defaultValues));
  const set = <K extends keyof PublishFormValues>(field: K, value: PublishFormValues[K]) =>
    dispatch({ type: "set", field, value });

  const theme = getPostTypeTheme(postType);
  const isBlog = postType === "blog";
  const isBounty = postType === "bounty";

  // External reset (Discard changes).
  const lastResetRef = React.useRef(resetSignal);
  React.useEffect(() => {
    if (resetSignal !== lastResetRef.current) {
      lastResetRef.current = resetSignal;
      dispatch({ type: "reset", values: buildInitial(defaultValues) });
    }
  }, [resetSignal, defaultValues]);

  // Notify parent of every change (for debounced autosave).
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    onChangeRef.current?.(state);
  }, [state]);

  const validation = useMemo(() => validate(state), [state]);
  const progressPercent = (validation.requiredFieldsCompleted / validation.total) * 100;

  const slugAvailability = useSlugAvailability(state.slug, contentItemId);
  const slugBlockingPublish = slugAvailability === "taken";

  const canPublish =
    validation.requiredFieldsCompleted === validation.total && !slugBlockingPublish;

  const { data: tagSuggestions } = useTagSuggestions();

  const handlePublish = () => {
    if (!canPublish) return;
    onPublish({ ...state, slug: state.slug.trim().toLowerCase() });
  };

  const slugPreview = state.slug.trim()
    ? `neoscale.ai/${authorUsername}/${state.slug.trim().toLowerCase()}`
    : `neoscale.ai/${authorUsername}/your-slug-here`;

  const isUpdate = publishLabel === "Update";

  const scrollToSection = (n: number) => {
    const el = document.getElementById(`publish-section-${n}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // For the page title, "Editing live" still trumps the post type label
  // because it tells the user state, not type. We keep the type pill always.
  const headerTitle = isUpdate ? `Update ${postType}` : theme.pageTitle;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="h-[60px] flex items-center justify-between px-4 sm:px-6"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={onBack}
          className="publish-focus rounded flex items-center gap-2 hover:opacity-80 transition-opacity"
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: "13px",
            fontWeight: 500,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <ArrowLeft size={14} />
          Back to editor
        </button>

        <h1
          className="hidden sm:block"
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {headerTitle}
        </h1>

        <span
          className="px-3 py-1 rounded-full"
          style={{
            backgroundColor: theme.pillBg,
            color: theme.pillText,
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {theme.label}
        </span>
      </header>

      {/* Progress Bar */}
      <div
        className="h-1 w-full relative group cursor-help"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={validation.total}
        aria-valuenow={validation.requiredFieldsCompleted}
        aria-label={`${validation.requiredFieldsCompleted} of ${validation.total} required fields complete`}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progressPercent}%`, backgroundColor: theme.accent }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
          style={{
            backgroundColor: "rgba(22,22,30,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.8)",
            fontSize: "12px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Fill required fields to publish ({validation.requiredFieldsCompleted} of{" "}
          {validation.total})
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 overflow-y-auto pb-[100px]">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
          {/* 1 - Basics */}
          <Section number={1} title="Basics" required onBadgeClick={scrollToSection} accent={theme.accent}>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={state.useCase}
                  onChange={(e) => set("useCase", e.target.value)}
                  placeholder={
                    isBlog
                      ? "What is this blog about? (e.g. 'Why long-context models change RAG')"
                      : "What does this blueprint help someone do? (e.g. 'Extract Foucault quotes from PDFs')"
                  }
                  maxLength={140}
                  className="publish-focus w-full h-[44px] px-4 rounded-lg outline-none transition-all"
                  style={{
                    backgroundColor: "rgba(30,30,40,0.50)",
                    border: validation.errors.useCase
                      ? "0.5px solid rgba(239,68,68,0.40)"
                      : "0.5px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.92)",
                    fontSize: "14px",
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <div className="flex justify-between">
                  <span
                    style={{
                      color: validation.errors.useCase
                        ? "rgba(239,68,68,0.85)"
                        : "rgba(255,255,255,0.40)",
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {validation.errors.useCase
                      ? validation.errors.useCase
                      : "One sentence. This is what shows up first when someone searches Discover."}
                  </span>
                  <span
                    style={{
                      color: "rgba(255,255,255,0.30)",
                      fontSize: "11px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    {state.useCase.length}/140
                  </span>
                </div>
              </div>

              <FieldGroup label="Domain" error={validation.errors.domain}>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((d) => (
                    <ChipButton
                      key={d}
                      label={d}
                      active={state.domain === d}
                      onClick={() => set("domain", d)}
                      accent={theme.accent}
                      accentSoft={theme.accentSoft}
                    />
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label="Difficulty" error={validation.errors.difficulty}>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <ChipButton
                      key={d}
                      label={d}
                      active={state.difficulty === d}
                      onClick={() => set("difficulty", d)}
                      accent={theme.accent}
                      accentSoft={theme.accentSoft}
                    />
                  ))}
                </div>
              </FieldGroup>

              {isBlog && (
                <FieldGroup label="Topic category">
                  <div className="flex flex-wrap gap-2">
                    {BLOG_TOPIC_CATEGORIES.map((t) => (
                      <ChipButton
                        key={t}
                        label={t}
                        active={state.topicCategory === t}
                        onClick={() =>
                          set(
                            "topicCategory",
                            state.topicCategory === t ? "" : t,
                          )
                        }
                        accent={theme.accent}
                        accentSoft={theme.accentSoft}
                      />
                    ))}
                  </div>
                </FieldGroup>
              )}
            </div>
          </Section>

          {/* 2 - Tags */}
          <Section number={2} title="Tags" required onBadgeClick={scrollToSection} accent={theme.accent}>
            <TagInput
              value={state.tags}
              onChange={(t) => set("tags", t)}
              suggestions={tagSuggestions || []}
              maxTags={8}
              placeholder="Add tags (e.g. RAG, fine-tuning, agents)"
            />
            {validation.errors.tags && (
              <span
                style={{
                  color: "rgba(239,68,68,0.85)",
                  fontSize: "11px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {validation.errors.tags}
              </span>
            )}
          </Section>

          {/* 3 - Context (Blueprint + Bounty only) */}
          {!isBlog && (
            <Section
              number={3}
              title="Context"
              helpText="Optional context to help readers understand what they need and what they'll get."
              onBadgeClick={scrollToSection}
              accent={theme.accent}
            >
              <div className="flex flex-col gap-4">
                <FieldGroup label="Prerequisites">
                  <textarea
                    value={state.prerequisites}
                    onChange={(e) => set("prerequisites", e.target.value)}
                    placeholder="What does the reader need before starting? (e.g. 'A Polymarket account, basic Python')"
                    className="publish-focus w-full min-h-[80px] px-4 py-3 rounded-lg outline-none transition-all resize-y"
                    style={{
                      backgroundColor: "rgba(30,30,40,0.50)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </FieldGroup>

                <FieldGroup label="Outcome">
                  <textarea
                    value={state.outcome}
                    onChange={(e) => set("outcome", e.target.value)}
                    placeholder="What will the reader have after working through this? (e.g. 'A working arbitrage bot polling weather markets every 30s')"
                    className="publish-focus w-full min-h-[80px] px-4 py-3 rounded-lg outline-none transition-all resize-y"
                    style={{
                      backgroundColor: "rgba(30,30,40,0.50)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                </FieldGroup>
              </div>
            </Section>
          )}

          {/* 4 - Auto-detected */}
          <Section
            number={isBlog ? 3 : 4}
            title="Auto-detected"
            helpText="Metadata automatically extracted from your content."
            onBadgeClick={scrollToSection}
            accent={theme.accent}
          >
            {isBlog ? (
              <BlogAutoDetectedCard
                wordCount={autoDetected?.word_count ?? 0}
                readingMinutes={autoDetected?.estimated_reading_minutes ?? 0}
                referencedPostIds={autoDetected?.blog_referenced_post_ids ?? []}
                onEditClick={onBack}
              />
            ) : (
              <AutoDetectedCard
                wordCount={autoDetected?.word_count ?? 0}
                readingMinutes={autoDetected?.estimated_reading_minutes ?? 0}
                stageCount={autoDetected?.stage_count ?? 0}
                blockCount={autoDetected?.block_count ?? 0}
                connectionCount={autoDetected?.connection_count ?? 0}
                blockTypes={autoDetected?.block_types_used ?? []}
                models={autoDetected?.models_referenced ?? []}
                tools={autoDetected?.tools_referenced ?? []}
                onEditClick={onBack}
              />
            )}
          </Section>

          {/* 5 - Visibility & Slug */}
          <Section number={isBlog ? 4 : 5} title="Visibility & slug" required onBadgeClick={scrollToSection} accent={theme.accent}>
            <div className="flex flex-col gap-5">
              <FieldGroup label="Visibility" error={validation.errors.visibility}>
                <div className="flex flex-wrap gap-2">
                  {VISIBILITIES.map((v) => (
                    <ChipButton
                      key={v.value}
                      label={v.label}
                      icon={v.icon}
                      active={state.visibility === v.value}
                      onClick={() => set("visibility", v.value)}
                      accent={theme.accent}
                      accentSoft={theme.accentSoft}
                    />
                  ))}
                </div>
              </FieldGroup>

              <FieldGroup label="Slug" error={validation.errors.slug}>
                <div className="relative">
                  <span
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    style={{
                      color: "rgba(255,255,255,0.40)",
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    /
                  </span>
                  <input
                    type="text"
                    value={state.slug}
                    onChange={(e) =>
                      set(
                        "slug",
                        e.target.value.toLowerCase().split(" ").join("-").slice(0, 80),
                      )
                    }
                    placeholder={isBlog ? "your-blog-slug" : "your-blueprint-slug"}
                    className="publish-focus w-full h-[44px] pl-7 pr-32 rounded-lg outline-none transition-all"
                    style={{
                      backgroundColor: "rgba(30,30,40,0.50)",
                      border: validation.errors.slug
                        ? "0.5px solid rgba(239,68,68,0.40)"
                        : "0.5px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />

                  <SlugBadge
                    state={
                      validation.errors.slug
                        ? "idle"
                        : state.slug
                        ? slugAvailability
                        : "idle"
                    }
                  />
                </div>
                <span
                  style={{
                    color: "rgba(255,255,255,0.40)",
                    fontSize: "11px",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {slugPreview}
                </span>
              </FieldGroup>
            </div>
          </Section>
        </div>
      </main>

      {/* Sticky footer */}
      <footer
        className="fixed bottom-0 left-0 right-0 h-[80px] flex items-center justify-between px-4 sm:px-6 z-40 gap-3"
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(8,8,12,0.85)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onSaveDraft}
            className="publish-focus px-3 sm:px-4 py-2 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap"
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            Save as draft
          </button>
          <button
            onClick={onDiscard}
            className="publish-focus px-3 sm:px-4 py-2 rounded-lg hover:bg-white/5 transition-colors whitespace-nowrap hidden sm:inline-flex"
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
              border: "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            Discard changes
          </button>
        </div>

        <div className="relative group">
          <button
            onClick={handlePublish}
            disabled={!canPublish || isPublishing}
            className="publish-focus h-[40px] px-6 rounded-lg flex items-center gap-2 transition-all"
            style={{
              background: theme.publishGradient,
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              opacity: canPublish && !isPublishing ? 1 : 0.4,
              cursor: canPublish && !isPublishing ? "pointer" : "not-allowed",
            }}
          >
            {isPublishing && <Loader2 size={14} className="animate-spin" />}
            {isPublishing ? (isUpdate ? "Updating…" : "Publishing…") : publishLabel}
          </button>
          {!canPublish && (
            <div
              className="absolute right-0 bottom-full mb-2 px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
              style={{
                backgroundColor: "rgba(22,22,30,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)",
                fontSize: "12px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {slugBlockingPublish
                ? "That slug is taken — pick another"
                : "Fill all required fields to publish"}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ── Blog auto-detected card ─────────────────────── */

interface ReferencedItem {
  id: string;
  title: string;
  type: "blueprint" | "stage" | "block";
}

function BlogAutoDetectedCard({
  wordCount,
  readingMinutes,
  referencedPostIds,
  onEditClick,
}: {
  wordCount: number;
  readingMinutes: number;
  referencedPostIds: string[];
  onEditClick: () => void;
}) {
  const [refs, setRefs] = useState<ReferencedItem[] | null>(null);
  const [loadingRefs, setLoadingRefs] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!referencedPostIds || referencedPostIds.length === 0) {
      setRefs([]);
      return;
    }
    setLoadingRefs(true);
    (async () => {
      const { data, error } = await supabase
        .from("content_items")
        .select("id, title, post_type")
        .in("id", referencedPostIds);
      if (cancelled) return;
      if (error) {
        console.warn("[BlogAutoDetectedCard] failed to load refs", error);
        setRefs([]);
      } else {
        setRefs(
          (data || []).map((d: any) => ({
            id: d.id,
            title: d.title || "Untitled",
            type: "blueprint" as const,
          })),
        );
      }
      setLoadingRefs(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(referencedPostIds)]);

  const isEmpty = wordCount === 0 && (refs?.length ?? 0) === 0;

  return (
    <div
      className="w-full"
      style={{
        background: "rgba(22,22,30,0.40)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "10px",
        padding: "18px",
      }}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            Word Count
          </span>
          <span
            className="text-[22px] font-bold leading-tight"
            style={{ color: "rgba(255,255,255,0.95)" }}
          >
            {wordCount.toLocaleString()}
          </span>
          <span
            className="text-[11px] font-normal"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            {readingMinutes} min read
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span
            className="text-[10px] font-semibold uppercase tracking-[0.08em]"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            References
          </span>
          <span
            className="text-[22px] font-bold leading-tight"
            style={{ color: "rgba(255,255,255,0.95)" }}
          >
            {refs?.length ?? 0}
          </span>
          <span
            className="text-[11px] font-normal"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            inline link{(refs?.length ?? 0) === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: "rgba(255,255,255,0.40)" }}
        >
          Referenced Items
        </span>
        {loadingRefs ? (
          <span
            className="text-[11px]"
            style={{ color: "rgba(255,255,255,0.40)" }}
          >
            Loading…
          </span>
        ) : refs && refs.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {refs.map((r) => (
              <ReferenceChip key={r.id} item={r} />
            ))}
          </div>
        ) : (
          <span
            className="text-[11px] font-medium"
            style={{ color: "rgba(255,255,255,0.30)" }}
          >
            No inline references yet — use @ in the editor to link blueprints, stages, or blocks.
          </span>
        )}
      </div>

      {isEmpty ? null : (
        <button
          onClick={onEditClick}
          className="publish-focus mt-5 cursor-pointer text-[11px] font-medium transition-colors rounded"
          style={{ color: "rgba(46,196,182,0.85)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(46,196,182,1.0)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(46,196,182,0.85)";
          }}
        >
          These look wrong? Update in editor →
        </button>
      )}
    </div>
  );
}

function ReferenceChip({ item }: { item: ReferencedItem }) {
  const Icon = item.type === "stage" ? LayoutGrid : item.type === "block" ? Box : FileText;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "4px",
        padding: "3px 8px",
        maxWidth: "260px",
      }}
    >
      <Icon size={11} style={{ color: "rgba(46,196,182,0.85)" }} />
      <span
        className="text-[11px] font-medium truncate"
        style={{ color: "rgba(255,255,255,0.85)" }}
      >
        {item.title}
      </span>
    </span>
  );
}

/* ── Helpers ─────────────────────────────────────── */

function FieldGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        style={{
          color: "rgba(255,255,255,0.65)",
          fontSize: "12px",
          fontWeight: 500,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {label}
      </label>
      {children}
      {error && (
        <span
          style={{
            color: "rgba(239,68,68,0.85)",
            fontSize: "11px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

function SlugBadge({
  state,
}: {
  state: "idle" | "checking" | "available" | "taken" | "unsupported";
}) {
  if (state === "idle") return null;

  if (state === "checking") {
    return (
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded"
        style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      >
        <Loader2 size={12} className="animate-spin" style={{ color: "rgba(255,255,255,0.55)" }} />
        <span
          style={{
            color: "rgba(255,255,255,0.55)",
            fontSize: "11px",
            fontWeight: 500,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Checking…
        </span>
      </div>
    );
  }

  if (state === "taken") {
    return (
      <div
        className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded"
        style={{ backgroundColor: "rgba(245,158,11,0.10)" }}
      >
        <AlertTriangle size={12} style={{ color: "#F59E0B" }} />
        <span
          style={{
            color: "#F59E0B",
            fontSize: "11px",
            fontWeight: 500,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Taken
        </span>
      </div>
    );
  }

  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 rounded"
      style={{ backgroundColor: "rgba(46,196,182,0.10)" }}
    >
      <Check size={12} style={{ color: "#2EC4B6" }} />
      <span
        style={{
          color: "#2EC4B6",
          fontSize: "11px",
          fontWeight: 500,
          fontFamily: "Inter, sans-serif",
        }}
      >
        Available
      </span>
    </div>
  );
}

function Section({
  number,
  title,
  required,
  helpText,
  children,
  onBadgeClick,
  accent,
}: {
  number: number;
  title: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
  onBadgeClick?: (n: number) => void;
  accent: string;
}) {
  return (
    <section
      id={`publish-section-${number}`}
      className="rounded-xl p-5 scroll-mt-20"
      style={{ backgroundColor: "rgba(22,22,30,0.40)" }}
      aria-labelledby={`publish-section-${number}-title`}
    >
      <div className="h-6 flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => onBadgeClick?.(number)}
          className="publish-focus w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.55)",
            fontSize: "11px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
          aria-label={`Section ${number}: ${title}`}
        >
          {number}
        </button>
        <h2
          id={`publish-section-${number}-title`}
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
            margin: 0,
          }}
        >
          {title}
        </h2>
        {required && (
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: `${accent}1A`,
              color: accent,
              fontSize: "9px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Required
          </span>
        )}
        {helpText && (
          <div className="relative ml-auto group">
            <HelpCircle
              size={14}
              style={{ color: "rgba(255,255,255,0.30)" }}
              className="cursor-help"
              aria-label={helpText}
            />
            <div
              className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
              style={{
                backgroundColor: "rgba(22,22,30,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.8)",
                fontSize: "12px",
                fontFamily: "Inter, sans-serif",
                maxWidth: "280px",
                whiteSpace: "normal",
              }}
            >
              {helpText}
            </div>
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function ChipButton({
  label,
  active,
  onClick,
  icon: Icon,
  accent,
  accentSoft,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  accent: string;
  accentSoft: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      aria-pressed={active}
      className="publish-focus h-7 px-3.5 rounded-full flex items-center gap-1.5 transition-all"
      style={{
        backgroundColor: active ? accentSoft : "rgba(255,255,255,0.03)",
        border: active
          ? `0.5px solid ${accent}66`
          : "0.5px solid rgba(255,255,255,0.08)",
        color: active ? accent : "rgba(255,255,255,0.70)",
        fontSize: "12px",
        fontWeight: 500,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {Icon && (
        <Icon
          size={12}
          style={{ color: active ? accent : "rgba(255,255,255,0.50)" }}
        />
      )}
      {label}
    </button>
  );
}

export default PublishMetadataForm;
