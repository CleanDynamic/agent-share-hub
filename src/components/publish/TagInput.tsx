import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TagSuggestion {
  tag: string;
  usageCount: number;
}

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions: TagSuggestion[];
  maxTags?: number;
  placeholder?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions,
  maxTags = 8,
  placeholder = "Add tags...",
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [flashingTag, setFlashingTag] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const isMaxReached = value.length >= maxTags;

  const filteredSuggestions = React.useMemo(() => {
    if (!inputValue.trim()) return [];
    const query = inputValue.toLowerCase().trim();
    return suggestions
      .filter(
        (s) =>
          s.tag.toLowerCase().includes(query) &&
          !value.map((v) => v.toLowerCase()).includes(s.tag.toLowerCase()),
      )
      .slice(0, 8);
  }, [inputValue, suggestions, value]);

  const showDropdown = isFocused && inputValue.trim().length > 0 && !isMaxReached;

  const exactMatch = filteredSuggestions.find(
    (s) => s.tag.toLowerCase() === inputValue.toLowerCase().trim(),
  );
  const canCreateNew =
    inputValue.trim().length > 0 &&
    !exactMatch &&
    !value.map((v) => v.toLowerCase()).includes(inputValue.trim().toLowerCase());

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredSuggestions.length, inputValue]);

  const addTag = React.useCallback(
    (tag: string) => {
      const normalizedTag = tag.trim();
      if (!normalizedTag || isMaxReached) return;

      if (value.map((v) => v.toLowerCase()).includes(normalizedTag.toLowerCase())) {
        setFlashingTag(normalizedTag.toLowerCase());
        setTimeout(() => setFlashingTag(null), 200);
        setInputValue("");
        return;
      }

      onChange([...value, normalizedTag]);
      setInputValue("");
      setHighlightedIndex(0);
    },
    [value, onChange, isMaxReached],
  );

  const removeTag = React.useCallback(
    (tagToRemove: string) => {
      onChange(value.filter((tag) => tag !== tagToRemove));
    },
    [value, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (showDropdown && filteredSuggestions.length > 0) {
        addTag(filteredSuggestions[highlightedIndex]?.tag ?? inputValue);
      } else if (canCreateNew) {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && inputValue === "" && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "ArrowDown" && showDropdown) {
      e.preventDefault();
      const maxIndex = Math.max(0, filteredSuggestions.length - 1);
      setHighlightedIndex((prev) => Math.min(prev + 1, maxIndex));
    } else if (e.key === "ArrowUp" && showDropdown) {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  const handleContainerClick = () => {
    if (!isMaxReached) inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      {/* Container */}
      <div
        onClick={handleContainerClick}
        className={cn(
          "w-full min-h-[44px] px-2.5 py-1.5 rounded-lg flex flex-wrap items-center gap-1.5 transition-all cursor-text",
        )}
        style={{
          backgroundColor: "rgba(30,30,40,0.50)",
          border: isFocused
            ? "0.5px solid rgba(232,87,26,0.40)"
            : "0.5px solid rgba(255,255,255,0.08)",
        }}
      >
        {value.map((tag) => {
          const isFlashing = flashingTag === tag.toLowerCase();
          return (
            <span
              key={tag}
              className={cn("inline-flex items-center gap-1 h-7 px-2.5 rounded-full transition-all")}
              style={{
                backgroundColor: isFlashing
                  ? "rgba(239,68,68,0.18)"
                  : "rgba(232,87,26,0.10)",
                border: isFlashing
                  ? "0.5px solid rgba(239,68,68,0.50)"
                  : "0.5px solid rgba(232,87,26,0.30)",
                color: isFlashing ? "rgb(248,113,113)" : "#E8571A",
                fontSize: "12px",
                fontWeight: 500,
                fontFamily: "Figtree, sans-serif",
              }}
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="text-[rgba(255,255,255,0.40)] hover:text-[rgba(239,68,68,0.85)] transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X size={11} />
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value.split(",").join(""))}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFocused(false), 150);
          }}
          disabled={isMaxReached}
          placeholder={isMaxReached ? `Maximum ${maxTags} tags reached` : placeholder}
          maxLength={32}
          className={cn(
            "flex-1 min-w-[120px] h-7 bg-transparent border-none outline-none",
            "text-[13px] font-normal text-[rgba(255,255,255,0.92)]",
            "placeholder:text-[rgba(255,255,255,0.30)]",
            "disabled:cursor-not-allowed",
          )}
          style={{ fontFamily: "Figtree, sans-serif" }}
        />
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg overflow-hidden z-20"
          style={{
            backgroundColor: "rgba(22,22,30,0.95)",
            border: "0.5px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
          }}
        >
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((suggestion, index) => (
              <button
                key={suggestion.tag}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(suggestion.tag);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors",
                  highlightedIndex === index
                    ? "bg-[rgba(232,87,26,0.06)] border-l-2 border-l-[#E8571A]"
                    : "hover:bg-[rgba(255, 255, 255, 0.14)] border-l-2 border-l-transparent",
                )}
                style={{ fontFamily: "Figtree, sans-serif" }}
              >
                <span className="flex items-center gap-1.5">
                  <span style={{ color: "rgba(255,255,255,0.30)", fontSize: "12px" }}>#</span>
                  <span style={{ color: "rgba(255,255,255,0.85)", fontSize: "12px", fontWeight: 500 }}>
                    {suggestion.tag}
                  </span>
                </span>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>
                  Used {suggestion.usageCount}×
                </span>
              </button>
            ))
          ) : canCreateNew ? (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(inputValue);
              }}
              className={cn(
                "w-full px-2.5 py-1.5 text-left transition-colors",
                "bg-[rgba(232,87,26,0.06)] border-l-2 border-l-[#E8571A]",
                "hover:bg-[rgba(255, 255, 255, 0.14)]",
              )}
              style={{ fontFamily: "Figtree, sans-serif" }}
            >
              <span style={{ color: "rgba(255,255,255,0.65)", fontSize: "12px" }}>
                Press Enter to add{" "}
                <span style={{ color: "#E8571A", fontWeight: 600 }}>
                  '#{inputValue.trim()}'
                </span>
              </span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default TagInput;
