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
  prompt: "#E8571A",
  code: "#22C55E",
  result: "#7C3AED",
  agent: "#7C3AED",
  tool: "#3B82F6",
  model: "#A78BFA",
  workflow: "#3B82F6",
  compare: "#EC4899",
  tutorial: "#2EC4B6",
  resource: "#06B6D4",
  note: "#F59E0B",
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
        style={{ color: "rgba(255,255,255,0.40)" }}
      >
        {label}
      </span>
      <span
        className="text-[22px] font-bold leading-tight"
        style={{ color: "rgba(255,255,255,0.95)" }}
      >
        {value}
      </span>
      {subtitle && (
        <span
          className="text-[11px] font-normal"
          style={{ color: "rgba(255,255,255,0.40)" }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

function BlockTypeChip({ type }: { type: string }) {
  const color = BLOCK_TYPE_COLORS[type.toLowerCase()] || "rgba(255,255,255,0.40)";
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span
        className="text-[11px] font-medium"
        style={{ color: "rgba(255,255,255,0.85)" }}
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
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <Brain size={11} style={{ color: "rgba(255,255,255,0.85)" }} />
      <span
        className="text-[11px] font-medium"
        style={{ color: "rgba(255,255,255,0.85)" }}
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
        background: "rgba(255,255,255,0.03)",
        border: "0.5px solid rgba(255,255,255,0.06)",
        borderRadius: "4px",
        padding: "3px 8px",
      }}
    >
      <Wrench size={11} style={{ color: "rgba(255,255,255,0.85)" }} />
      <span
        className="text-[11px] font-medium"
        style={{ color: "rgba(255,255,255,0.85)" }}
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
      style={{ color: "rgba(255,255,255,0.40)" }}
    >
      {children}
    </span>
  );
}

function EmptyPlaceholder() {
  return (
    <span
      className="text-[11px] font-medium"
      style={{ color: "rgba(255,255,255,0.30)" }}
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
          background: "rgba(22,22,30,0.40)",
          border: "0.5px dashed rgba(255,255,255,0.10)",
          borderRadius: "10px",
          padding: "32px 18px",
        }}
        role="status"
      >
        <FileQuestion
          size={32}
          style={{ color: "rgba(255,255,255,0.30)", marginBottom: 12 }}
          aria-hidden
        />
        <p
          className="text-[12px]"
          style={{ color: "rgba(255,255,255,0.55)", fontFamily: "Inter, sans-serif" }}
        >
          Nothing detected yet — add some content in the editor first.
        </p>
        <button
          onClick={onEditClick}
          className="publish-focus mt-4 cursor-pointer text-[11px] font-medium transition-colors rounded"
          style={{ color: "rgba(46,196,182,0.85)" }}
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
        background: "rgba(22,22,30,0.40)",
        border: "0.5px solid rgba(255,255,255,0.06)",
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
    </div>
  );
}

export default AutoDetectedCard;
