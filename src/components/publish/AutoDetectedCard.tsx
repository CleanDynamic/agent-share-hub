import React from "react";
import { Brain, Wrench, FileQuestion } from "lucide-react";

interface AutoDetectedCardProps {
  wordCount: number;
  readingMinutes: number;
  stageCount: number;
  blockCount: number;
  connectionCount: number;
  blockTypes: string[];
  models: string[];
  tools: string[];
  onEditClick: () => void;
}

const BLOCK_TYPE_COLORS: Record<string, string> = {
  prompt: "var(--action)",
  code: "var(--cat-configuration)",
  result: "var(--cat-agents)",
  agent: "var(--cat-agents)",
  tool: "var(--cat-data)",
  model: "var(--cat-agents)",
  workflow: "var(--cat-data)",
  compare: "var(--cat-media)",
  tutorial: "var(--evidence)",
  resource: "var(--cat-data)",
  note: "var(--lit)",
};

function StatBlock({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--text2)" }}
      >
        {label}
      </span>
      <span
        className="text-[22px] font-bold leading-tight"
        style={{ color: "var(--text)" }}
      >
        {value}
      </span>
      {subtitle && (
        <span
          className="text-[11px] font-normal"
          style={{ color: "var(--text2)" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function BlockTypeChip({ type }: { type: string }) {
  const color = BLOCK_TYPE_COLORS[type.toLowerCase()] || "var(--text2)";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: "var(--glass-2)",
        border: "0.5px solid var(--line)",
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span
        className="text-[11px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {type}
      </span>
    </span>
  );
}

function ModelChip({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: "var(--glass-2)",
        border: "0.5px solid var(--line)",
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <Brain size={11} style={{ color: "var(--text)" }} />
      <span
        className="text-[11px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {name}
      </span>
    </span>
  );
}

function ToolChip({ name }: { name: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: "var(--glass-2)",
        border: "0.5px solid var(--line)",
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <Wrench size={11} style={{ color: "var(--text)" }} />
      <span
        className="text-[11px] font-medium"
        style={{ color: "var(--text)" }}
      >
        {name}
      </span>
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: "var(--text2)" }}
    >
      {children}
    </span>
  );
}

function EmptyPlaceholder() {
  return (
    <span
      className="text-[11px] font-medium"
      style={{ color: "var(--text2)" }}
    >
      —
    </span>
  );
}

export function AutoDetectedCard({
  wordCount,
  readingMinutes,
  stageCount,
  blockCount,
  connectionCount,
  blockTypes,
  models,
  tools,
  onEditClick,
}: AutoDetectedCardProps) {
  const isEmpty =
    wordCount === 0 &&
    stageCount === 0 &&
    blockCount === 0 &&
    connectionCount === 0 &&
    blockTypes.length === 0 &&
    models.length === 0 &&
    tools.length === 0;

  if (isEmpty) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center text-center"
        style={{
          background: "var(--recess)",
          border: "0.5px dashed var(--line)",
          borderRadius: "10px",
          padding: "32px 18px",
        }}
        role="status"
      >
        <FileQuestion
          size={32}
          style={{ color: "var(--text2)", marginBottom: 12 }}
          aria-hidden
        />
        <p
          className="text-[12px]"
          style={{ color: "var(--text2)", fontFamily: "Figtree, sans-serif" }}
        >
          Nothing detected yet — add some content in the editor first.
        </p>
        <button
          onClick={onEditClick}
          className="publish-focus mt-4 cursor-pointer text-[11px] font-medium transition-colors rounded"
          style={{ color: "color-mix(in srgb, var(--evidence) 85%, transparent)" }}
        >
          Open editor →
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full"
      style={{
        background: "var(--recess)",
        border: "0.5px solid var(--line)",
        borderRadius: "10px",
        padding: "18px",
      }}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatBlock
          label="Word Count"
          value={wordCount.toLocaleString()}
          subtitle={`${readingMinutes} min read`}
        />
        <StatBlock
          label="Stages"
          value={`${stageCount} stages`}
          subtitle={`${blockCount} blocks`}
        />
        <StatBlock
          label="Connections"
          value={`${connectionCount} connections`}
          subtitle="between blocks"
        />
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <SectionLabel>Block Types</SectionLabel>
        {blockTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {blockTypes.map((type, index) => (
              <BlockTypeChip key={`${type}-${index}`} type={type} />
            ))}
          </div>
        ) : (
          <EmptyPlaceholder />
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <SectionLabel>Models & Tools</SectionLabel>
        {models.length > 0 || tools.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {models.map((model, index) => (
              <ModelChip key={`model-${model}-${index}`} name={model} />
            ))}
            {tools.map((tool, index) => (
              <ToolChip key={`tool-${tool}-${index}`} name={tool} />
            ))}
          </div>
        ) : (
          <EmptyPlaceholder />
        )}
      </div>

      <button
        onClick={onEditClick}
        className="publish-focus mt-5 cursor-pointer text-[11px] font-medium transition-colors rounded"
        style={{ color: "color-mix(in srgb, var(--evidence) 85%, transparent)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--evidence)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "color-mix(in srgb, var(--evidence) 85%, transparent)";
        }}
      >
        These look wrong? Update in editor →
      </button>
    </div>
  );
}

export default AutoDetectedCard;
