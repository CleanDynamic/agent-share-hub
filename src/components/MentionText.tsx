import { useMemo } from "react";
import { Link } from "react-router-dom";

/**
 * Renders text with @username patterns as clickable links.
 * Links to /creator/:username with orange styling.
 */
export function MentionText({ text, className = "" }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const regex = /@([a-zA-Z0-9_]+)/g;
    const result: { type: "text" | "mention"; value: string }[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push({ type: "text", value: text.slice(lastIndex, match.index) });
      }
      result.push({ type: "mention", value: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      result.push({ type: "text", value: text.slice(lastIndex) });
    }
    return result;
  }, [text]);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <Link
            key={i}
            to={`/creator/${part.value}`}
            className="mention-link"
            onClick={(e) => e.stopPropagation()}
          >
            @{part.value}
          </Link>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </span>
  );
}
