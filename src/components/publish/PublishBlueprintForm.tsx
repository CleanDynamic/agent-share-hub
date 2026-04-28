import React, { useState, useMemo } from "react";
import {
  ArrowLeft,
  HelpCircle,
  Lock,
  Link2,
  Globe,
  Check,
  Loader2,
} from "lucide-react";

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
  defaultValues?: Partial<{
    useCase: string;
    domain: string;
    difficulty: string;
    tags: string[];
    prerequisites: string;
    outcome: string;
    visibility: string;
    slug: string;
  }>;
  autoDetected?: AutoDetectedMeta;
  authorUsername?: string;
  onPublish: (values: PublishFormValues) => void;
  onSaveDraft: () => void;
  onDiscard: () => void;
  onBack: () => void;
  isPublishing?: boolean;
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

export function PublishBlueprintForm({
  defaultValues = {},
  autoDetected,
  authorUsername = "you",
  onPublish,
  onSaveDraft,
  onDiscard,
  onBack,
  isPublishing = false,
}: PublishBlueprintFormProps) {
  const [useCase, setUseCase] = useState(defaultValues.useCase || "");
  const [domain, setDomain] = useState(defaultValues.domain || "");
  const [difficulty, setDifficulty] = useState(defaultValues.difficulty || "");
  const [tags, setTags] = useState(defaultValues.tags?.join(", ") || "");
  const [prerequisites, setPrerequisites] = useState(defaultValues.prerequisites || "");
  const [outcome, setOutcome] = useState(defaultValues.outcome || "");
  const [visibility, setVisibility] = useState(defaultValues.visibility || "public");
  const [slug, setSlug] = useState(defaultValues.slug || "");

  const requiredFieldsFilled = useMemo(() => {
    let filled = 0;
    const total = 5;
    if (useCase.trim()) filled++;
    if (domain) filled++;
    if (difficulty) filled++;
    if (tags.trim()) filled++;
    if (visibility && slug.trim()) filled++;
    return { filled, total };
  }, [useCase, domain, difficulty, tags, visibility, slug]);

  const progressPercent =
    (requiredFieldsFilled.filled / requiredFieldsFilled.total) * 100;
  const canPublish = requiredFieldsFilled.filled === requiredFieldsFilled.total;

  const handlePublish = () => {
    if (!canPublish) return;
    onPublish({
      useCase,
      domain,
      difficulty,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      prerequisites,
      outcome,
      visibility,
      slug,
    });
  };

  const slugPreview = slug
    ? `neoscale.ai/${authorUsername}/${slug.toLowerCase().split(/\s+/).join("-")}`
    : `neoscale.ai/${authorUsername}/your-slug-here`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header Strip */}
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
          Fill required fields to publish ({requiredFieldsFilled.filled} of{" "}
          {requiredFieldsFilled.total})
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-[100px]">
        <div className="max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-8">
          {/* Section 1 - Basics */}
          <Section number={1} title="Basics" required>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="What does this blueprint help someone do? (e.g. 'Extract Foucault quotes from PDFs')"
                  className="w-full h-[44px] px-4 rounded-lg outline-none transition-all focus:ring-1"
                  style={{
                    backgroundColor: "rgba(30,30,40,0.50)",
                    border: "0.5px solid rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.92)",
                    fontSize: "14px",
                    fontFamily: "Inter, sans-serif",
                  }}
                />
                <span
                  style={{
                    color: "rgba(255,255,255,0.40)",
                    fontSize: "11px",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  One sentence. This is what shows up first when someone searches Discover.
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Domain
                </label>
                <div className="flex flex-wrap gap-2">
                  {DOMAINS.map((d) => (
                    <ChipButton
                      key={d}
                      label={d}
                      active={domain === d}
                      onClick={() => setDomain(d)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Difficulty
                </label>
                <div className="flex flex-wrap gap-2">
                  {DIFFICULTIES.map((d) => (
                    <ChipButton
                      key={d}
                      label={d}
                      active={difficulty === d}
                      onClick={() => setDifficulty(d)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section 2 - Tags */}
          <Section number={2} title="Tags" required>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Add tags (e.g. RAG, fine-tuning, agents)"
                className="w-full h-[44px] px-4 rounded-lg outline-none transition-all focus:ring-1"
                style={{
                  backgroundColor: "rgba(30,30,40,0.50)",
                  border: "0.5px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.92)",
                  fontSize: "14px",
                  fontFamily: "Inter, sans-serif",
                }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.40)",
                  fontSize: "11px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Press Enter to add. Add 3-8 tags to help people find your work.
              </span>
            </div>
          </Section>

          {/* Section 3 - Context */}
          <Section
            number={3}
            title="Context"
            helpText="Optional context to help readers understand what they need and what they'll get."
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Prerequisites
                </label>
                <textarea
                  value={prerequisites}
                  onChange={(e) => setPrerequisites(e.target.value)}
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
              </div>

              <div className="flex flex-col gap-2">
                <label
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Outcome
                </label>
                <textarea
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
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
              </div>
            </div>
          </Section>

          {/* Section 4 - Auto-detected */}
          <Section
            number={4}
            title="Auto-detected"
            helpText="Metadata automatically extracted from your blueprint content."
          >
            <div
              className="rounded-lg p-4 flex items-center justify-center"
              style={{
                backgroundColor: "rgba(30,30,40,0.50)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                minHeight: "80px",
              }}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.40)",
                  fontSize: "13px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Auto-detected card slot — wired in 2.3
              </span>
            </div>
          </Section>

          {/* Section 5 - Visibility & Slug */}
          <Section number={5} title="Visibility & slug" required>
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Visibility
                </label>
                <div className="flex flex-wrap gap-2">
                  {VISIBILITIES.map((v) => (
                    <ChipButton
                      key={v.value}
                      label={v.label}
                      icon={v.icon}
                      active={visibility === v.value}
                      onClick={() => setVisibility(v.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  style={{
                    color: "rgba(255,255,255,0.65)",
                    fontSize: "12px",
                    fontWeight: 500,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Slug
                </label>
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
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="your-blueprint-slug"
                    className="w-full h-[44px] pl-7 pr-28 rounded-lg outline-none transition-all focus:ring-1"
                    style={{
                      backgroundColor: "rgba(30,30,40,0.50)",
                      border: "0.5px solid rgba(255,255,255,0.08)",
                      color: "rgba(255,255,255,0.92)",
                      fontSize: "14px",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                  {slug && (
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
                  )}
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
              </div>
            </div>
          </Section>
        </div>
      </main>

      {/* Sticky Footer */}
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
            Publish
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
              Fill all required fields to publish
            </div>
          )}
        </div>
      </footer>
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
              className="absolute right-0 top-full mt-2 px-3 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10"
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
