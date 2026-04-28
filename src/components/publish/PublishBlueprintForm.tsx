import React, { useReducer, useMemo } from "react";
import {
  ArrowLeft,
  HelpCircle,
  Lock,
  Link2,
  Globe,
  Check,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { AutoDetectedCard } from "./AutoDetectedCard";
import { TagInput } from "./TagInput";
import { useTagSuggestions, useSlugAvailability } from "./usePublishMetaQueries";

export interface AutoDetectedMeta {
  word_count?: number | null;
  estimated_reading_minutes?: number | null;
  stage_count?: number | null;
  block_count?: number | null;
  connection_count?: number | null;
  block_types_used?: string[] | null;
  models_referenced?: string[] | null;
  tools_referenced?: string[] | null;
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
}

interface PublishBlueprintFormProps {
  contentItemId?: string;
  defaultValues?: Partial<PublishFormValues>;
  autoDetected?: AutoDetectedMeta;
  authorUsername?: string;
  onPublish: (values: PublishFormValues) => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onBack: () => void;
  onChange?: (values: PublishFormValues) => void;
  isPublishing?: boolean;
  publishLabel?: string;
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
  };
}

/* ── Validation ───────────────────────────────────── */

const SLUG_RE = /^[a-z0-9-]+$/;

function validate(v: PublishFormValues) {
  const errors: Partial<Record<keyof PublishFormValues, string>> = {};

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

  // 5 logical required fields: useCase, domain, difficulty, tags, slug+visibility
  const completed = {
    useCase: !errors.useCase,
    domain: !errors.domain,
    difficulty: !errors.difficulty,
    tags: !errors.tags,
    slugVisibility: !errors.slug && !errors.visibility,
  };
  const requiredFieldsCompleted =
    Number(completed.useCase) +
    Number(completed.domain) +
    Number(completed.difficulty) +
    Number(completed.tags) +
    Number(completed.slugVisibility);

  return { errors, completed, requiredFieldsCompleted, total: 5 };
}

/* ── Component ───────────────────────────────────── */

export function PublishBlueprintForm({
  contentItemId,
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
}: PublishBlueprintFormProps) {
  const [state, dispatch] = useReducer(formReducer, buildInitial(defaultValues));
  const set = <K extends keyof PublishFormValues>(field: K, value: PublishFormValues[K]) =>
    dispatch({ type: "set", field, value });

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="h-[60px] flex items-center justify-between px-6"
        style={{ borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
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
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: "18px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Publish blueprint
        </h1>

        <span
          className="px-3 py-1 rounded-full"
          style={{
            backgroundColor: "rgba(232,87,26,0.14)",
            color: "#E8571A",
            fontSize: "11px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            fontFamily: "Inter, sans-serif",
          }}
        >
          Blueprint
        </span>
      </header>

      {/* Progress Bar */}
      <div
        className="h-1 w-full relative group cursor-help"
        style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
      >
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progressPercent}%`, backgroundColor: "#E8571A" }}
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
        <div className="max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-8">
          {/* 1 - Basics */}
          <Section number={1} title="Basics" required>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={state.useCase}
                  onChange={(e) => set("useCase", e.target.value)}
                  placeholder="What does this blueprint help someone do? (e.g. 'Extract Foucault quotes from PDFs')"
                  maxLength={140}
                  className="w-full h-[44px] px-4 rounded-lg outline-none transition-all focus:ring-1"
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
                    />
                  ))}
                </div>
              </FieldGroup>
            </div>
          </Section>

          {/* 2 - Tags */}
          <Section number={2} title="Tags" required>
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

          {/* 3 - Context */}
          <Section
            number={3}
            title="Context"
            helpText="Optional context to help readers understand what they need and what they'll get."
          >
            <div className="flex flex-col gap-4">
              <FieldGroup label="Prerequisites">
                <textarea
                  value={state.prerequisites}
                  onChange={(e) => set("prerequisites", e.target.value)}
                  placeholder="What does the reader need before starting? (e.g. 'A Polymarket account, basic Python')"
                  className="w-full min-h-[80px] px-4 py-3 rounded-lg outline-none transition-all focus:ring-1 resize-y"
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
                  className="w-full min-h-[80px] px-4 py-3 rounded-lg outline-none transition-all focus:ring-1 resize-y"
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

          {/* 4 - Auto-detected */}
          <Section
            number={4}
            title="Auto-detected"
            helpText="Metadata automatically extracted from your blueprint content."
          >
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
          </Section>

          {/* 5 - Visibility & Slug */}
          <Section number={5} title="Visibility & slug" required>
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
                    placeholder="your-blueprint-slug"
                    className="w-full h-[44px] pl-7 pr-32 rounded-lg outline-none transition-all focus:ring-1"
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
        className="fixed bottom-0 left-0 right-0 h-[80px] flex items-center justify-between px-6 z-40"
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.06)",
          backgroundColor: "rgba(8,8,12,0.85)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onSaveDraft}
            className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
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
            className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
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
            className="h-[40px] px-6 rounded-lg flex items-center gap-2 transition-all"
            style={{
              background: "linear-gradient(135deg, #E8571A 0%, #D4470F 100%)",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "Inter, sans-serif",
              opacity: canPublish && !isPublishing ? 1 : 0.4,
              cursor: canPublish && !isPublishing ? "pointer" : "not-allowed",
            }}
          >
            {isPublishing && <Loader2 size={14} className="animate-spin" />}
            {isPublishing ? (publishLabel === "Update" ? "Updating…" : "Publishing…") : publishLabel}
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

  // available or unsupported (treat unsupported as available since column missing)
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
}: {
  number: number;
  title: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl p-5"
      style={{ backgroundColor: "rgba(22,22,30,0.40)" }}
    >
      <div className="h-6 flex items-center gap-3 mb-4">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.55)",
            fontSize: "11px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {number}
        </span>
        <span
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
        >
          {title}
        </span>
        {required && (
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(232,87,26,0.10)",
              color: "rgba(232,87,26,0.85)",
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
}) {
  return (
    <button
      onClick={onClick}
      className="h-7 px-3.5 rounded-full flex items-center gap-1.5 transition-all"
      style={{
        backgroundColor: active ? "rgba(232,87,26,0.10)" : "rgba(255,255,255,0.03)",
        border: active
          ? "0.5px solid rgba(232,87,26,0.40)"
          : "0.5px solid rgba(255,255,255,0.08)",
        color: active ? "#E8571A" : "rgba(255,255,255,0.70)",
        fontSize: "12px",
        fontWeight: 500,
        fontFamily: "Inter, sans-serif",
      }}
    >
      {Icon && (
        <Icon
          size={12}
          style={{ color: active ? "#E8571A" : "rgba(255,255,255,0.50)" }}
        />
      )}
      {label}
    </button>
  );
}

export default PublishBlueprintForm;
