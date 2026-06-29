import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface UploadSectionToggleProps {
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  filled?: boolean;
  children: React.ReactNode;
}

/**
 * Disclosure row used by the upload header to keep cover / title+desc /
 * results visually collapsed until the user opens them. Animates height
 * via measured content size so nested layouts (cover dropzone, textarea,
 * carousel) render correctly.
 */
export function UploadSectionToggle({
  label,
  summary,
  defaultOpen = false,
  filled = false,
  children,
}: UploadSectionToggleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hover, setHover] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContentHeight(el.scrollHeight));
    ro.observe(el);
    setContentHeight(el.scrollHeight);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div
      className="w-full"
      style={{
        background: "rgba(22,22,30,0.40)",
        border: `0.5px solid rgba(255,255,255,${hover || open ? 0.18 : 0.10})`,
        borderRadius: "10px",
        overflow: "hidden",
        transition: "border-color 160ms ease-out",
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between outline-none"
        style={{
          height: "48px",
          padding: "0 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "13px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {label}
          </span>
          {filled && (
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: "#2EC4B6",
                display: "inline-block",
              }}
            />
          )}
          {summary && !open && (
            <span
              className="truncate"
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.40)",
                marginLeft: 4,
                maxWidth: 360,
              }}
            >
              · {summary}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          color="rgba(255,255,255,0.55)"
          style={{
            transition: "transform 160ms ease-out",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      <div
        style={{
          height: open ? contentHeight : 0,
          transition: "height 200ms ease-out",
          overflow: "hidden",
        }}
      >
        <div ref={contentRef} style={{ padding: "0 16px 16px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
