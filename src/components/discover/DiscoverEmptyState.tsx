import { Compass } from "lucide-react";

interface DiscoverEmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

const suggestions = [
  "Show me prompts using Claude Sonnet",
  "Find RAG pipelines",
  "Browse evaluation suites",
];

export function DiscoverEmptyState({ onSuggestionClick }: DiscoverEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Compass
        className="h-16 w-16"
        style={{ color: "var(--text2)" }}
        strokeWidth={1.5}
      />
      <h2
        className="mt-4 text-center text-lg font-semibold"
        style={{ color: "var(--text)" }}
      >
        Discover the AI knowledge web
      </h2>
      <p
        className="mt-2 max-w-[360px] text-center text-[13px] font-normal"
        style={{ color: "var(--text2)" }}
      >
        Search for blueprints, stages, or individual blocks. Try filtering by domain or block type.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className="rounded-full px-3.5 py-2 text-xs font-medium transition-colors"
            style={{
              border: "0.5px solid var(--line)",
              color: "var(--text2)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--recess)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
