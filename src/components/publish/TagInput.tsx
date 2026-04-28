import React, { useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  maxTags?: number;
  placeholder?: string;
}

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .join("-")
    .split("")
    .filter((c) => /[a-z0-9\-_]/.test(c))
    .join("");
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  maxTags = 8,
  placeholder = "Add a tag and press Enter",
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lowerValue = useMemo(() => new Set(value.map((t) => t.toLowerCase())), [value]);

  const filteredSuggestions = useMemo(() => {
    if (!draft.trim()) return [];
    const q = draft.trim().toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !lowerValue.has(s.toLowerCase()))
      .slice(0, 8);
  }, [draft, suggestions, lowerValue]);

  function addTag(raw: string) {
    const normalized = normalizeTag(raw);
    if (!normalized) return;
    if (lowerValue.has(normalized)) {
      setDraft("");
      return;
    }
    if (value.length >= maxTags) return;
    onChange([...value, normalized]);
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Tab" && filteredSuggestions.length > 0 && draft.trim()) {
      e.preventDefault();
      addTag(filteredSuggestions[0]);
    }
  }

  const atMax = value.length >= maxTags;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="w-full min-h-[44px] px-2.5 py-1.5 rounded-lg flex flex-wrap items-center gap-1.5 transition-all"
        style={{
          backgroundColor: "rgba(30,30,40,0.50)",
          border: focused
            ? "0.5px solid rgba(232,87,26,0.40)"
            : "0.5px solid rgba(255,255,255,0.08)",
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full"
            style={{
              backgroundColor: "rgba(232,87,26,0.10)",
              border: "0.5px solid rgba(232,87,26,0.30)",
              color: "#E8571A",
              fontSize: "12px",
              fontWeight: 500,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:opacity-80"
              style={{ color: "#E8571A" }}
              aria-label={`Remove ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
            if (draft.trim()) addTag(draft);
          }}
          placeholder={value.length === 0 ? placeholder : atMax ? "Tag limit reached" : ""}
          disabled={atMax}
          className="flex-1 min-w-[120px] h-7 bg-transparent outline-none"
          style={{
            color: "rgba(255,255,255,0.92)",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
          }}
          maxLength={32}
        />
      </div>

      {focused && filteredSuggestions.length > 0 && (
        <div
          className="rounded-lg p-1.5 flex flex-wrap gap-1.5"
          style={{
            backgroundColor: "rgba(22,22,30,0.85)",
            border: "0.5px solid rgba(255,255,255,0.08)",
          }}
        >
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(s);
              }}
              className="h-6 px-2.5 rounded-full hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.75)",
                fontSize: "11px",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <span
        style={{
          color: "rgba(255,255,255,0.40)",
          fontSize: "11px",
          fontFamily: "Inter, sans-serif",
        }}
      >
        Press Enter or comma to add. {value.length}/{maxTags} tags. Tab to accept top
        suggestion.
      </span>
    </div>
  );
}

export default TagInput;
