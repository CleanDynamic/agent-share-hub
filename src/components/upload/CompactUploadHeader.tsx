import React, { useRef, useState, useEffect, useCallback } from "react";
import { UploadSectionToggle } from "./UploadSectionToggle";
import { CoverImageField } from "./CoverImageField";
import type { CoverImage } from "@/types/blueprintMedia";

interface CompactUploadHeaderProps {
  postType: "blueprint" | "blog" | "bounty";
  mode?: string;
  title: string;
  description: string;
  coverImage: CoverImage;
  onCoverImageChange: (next: CoverImage) => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  maxDescriptionLength?: number;
  resultsSlot?: React.ReactNode;
  hasResults?: boolean;
}

const POST_TYPE_STYLES: Record<
  "blueprint" | "blog" | "bounty",
  { label: string; color: string; bg: string }
> = {
  blueprint: { label: "BLUEPRINT", color: "#E8571A", bg: "rgba(232,87,26,0.14)" },
  blog:      { label: "BLOG",      color: "#3B82F6", bg: "rgba(59,130,246,0.14)" },
  bounty:    { label: "BOUNTY",    color: "#22C55E", bg: "rgba(34,197,94,0.14)" },
};

export function CompactUploadHeader({
  postType, mode, title, description, coverImage,
  onCoverImageChange,
  onTitleChange, onDescriptionChange,
  maxDescriptionLength = 500,
  resultsSlot,
  hasResults = false,
}: CompactUploadHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [isSticky, setIsSticky] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px" }
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const textarea = descriptionRef.current;
    if (!textarea) return;
    textarea.style.height = "40px";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(Math.max(scrollHeight, 40), 80)}px`;
  }, [description]);

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const typeStyle = POST_TYPE_STYLES[postType];
  const titleFilled = title.trim().length > 0;

  return (
    <>
      <div ref={containerRef} className="w-full max-w-[720px] flex flex-col gap-2">

        {/* Type chip row */}
        <div className="flex items-center gap-2" style={{ height: "24px" }}>
          <span style={{
            fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 600,
            letterSpacing: "0.06em", color: typeStyle.color, background: typeStyle.bg,
            padding: "3px 10px", borderRadius: "100px",
          }}>
            {typeStyle.label}
          </span>
          {mode && (
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: "11px",
              fontWeight: 500, color: "rgba(255,255,255,0.40)",
            }}>{mode}</span>
          )}
        </div>

        {/* Cover image toggle */}
        <UploadSectionToggle
          label="Cover image"
          summary={coverUrl ? "1 image" : "Optional"}
          defaultOpen={!!coverUrl}
          filled={!!coverUrl}
        >
          <div
            className="flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden"
            style={{
              height: "120px", width: "100%",
              border: isHoveringCover
                ? "0.5px solid rgba(255,255,255,0.18)"
                : "0.5px dashed rgba(255,255,255,0.14)",
              background: isHoveringCover ? "rgba(255, 255, 255, 0.06)" : "rgba(255,255,255,0.02)",
              borderRadius: "8px",
            }}
            onMouseEnter={() => setIsHoveringCover(true)}
            onMouseLeave={() => setIsHoveringCover(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            {coverUrl ? (
              <>
                <img src={coverUrl} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
                {isHoveringCover && (
                  <div className="absolute inset-0 flex items-center justify-center"
                    style={{ background: "rgba(0,0,0,0.50)" }}>
                    <span style={{
                      fontFamily: "Inter, sans-serif", fontSize: "12px",
                      fontWeight: 500, color: "rgba(255,255,255,0.85)",
                    }}>Replace cover</span>
                  </div>
                )}
                <button
                  className="absolute top-2 right-2 flex items-center justify-center z-10"
                  style={{ width: "22px", height: "22px", background: "rgba(0,0,0,0.60)", borderRadius: "6px" }}
                  onClick={(e) => { e.stopPropagation(); onCoverRemove(); }}
                >
                  <X size={12} color="rgba(255,255,255,0.80)" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <ImagePlus size={16} color="rgba(255,255,255,0.55)" />
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: "13px",
                  fontWeight: 500, color: "rgba(255,255,255,0.55)",
                }}>Add cover image</span>
              </div>
            )}
          </div>
        </UploadSectionToggle>

        {/* Title + description toggle */}
        <UploadSectionToggle
          label="Title & description"
          summary={titleFilled ? title : "Untitled"}
          defaultOpen={!titleFilled}
          filled={titleFilled}
        >
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={`Title your ${postType}…`}
            className="w-full outline-none compact-upload-title"
            style={{
              height: "44px", padding: "8px 12px",
              background: "transparent", border: "none",
              borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
              fontFamily: "Inter, sans-serif", fontSize: "22px",
              fontWeight: 700, color: "rgba(255,255,255,0.95)",
            }}
          />
          <style>{`
            .compact-upload-title::placeholder {
              font-family: Inter, sans-serif; font-size: 22px;
              font-weight: 500; color: rgba(255,255,255,0.20);
            }
          `}</style>

          <div className="relative" style={{ marginTop: "8px" }}>
            <textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => {
                if (e.target.value.length <= maxDescriptionLength) {
                  onDescriptionChange(e.target.value);
                }
              }}
              placeholder="Describe what this is and why it matters…"
              className="w-full outline-none resize-none compact-upload-desc"
              style={{
                minHeight: "40px", maxHeight: "80px",
                padding: "8px 12px", paddingBottom: "20px",
                background: "transparent", border: "none",
                fontFamily: "Inter, sans-serif", fontSize: "13px",
                fontWeight: 400, color: "rgba(255,255,255,0.85)",
              }}
            />
            <style>{`
              .compact-upload-desc::placeholder {
                font-family: Inter, sans-serif; font-size: 13px;
                font-weight: 400; color: rgba(255,255,255,0.30);
              }
            `}</style>
            <span className="absolute bottom-1 right-3" style={{
              fontFamily: "Inter, sans-serif", fontSize: "10px",
              fontWeight: 400, color: "rgba(255,255,255,0.30)",
            }}>
              {description.length} / {maxDescriptionLength}
            </span>
          </div>
        </UploadSectionToggle>

        {/* Your results toggle */}
        {resultsSlot && (
          <UploadSectionToggle
            label="Your results"
            summary={hasResults ? "Added" : "Optional"}
            defaultOpen={hasResults}
            filled={hasResults}
          >
            {resultsSlot}
          </UploadSectionToggle>
        )}
      </div>

      {/* Sticky mini-bar when scrolled past header */}
      <div
        className="fixed left-0 right-0 flex items-center justify-center z-50"
        style={{
          top: 0,
          opacity: isSticky ? 1 : 0,
          pointerEvents: isSticky ? "auto" : "none",
          transition: "opacity 160ms ease-out",
        }}
      >
        <div
          className="w-full max-w-[720px] flex items-center justify-between"
          style={{
            height: "36px", padding: "8px 24px",
            background: "rgba(8,8,12,0.92)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderBottom: "0.5px solid rgba(255, 255, 255, 0.14)",
          }}
        >
          <div className="flex items-center gap-2 cursor-pointer" onClick={scrollToTop}>
            <span style={{
              fontFamily: "Inter, sans-serif", fontSize: "9px", fontWeight: 600,
              letterSpacing: "0.06em", color: typeStyle.color, background: typeStyle.bg,
              padding: "2px 8px", borderRadius: "100px",
            }}>
              {typeStyle.label}
            </span>
            <span className="truncate max-w-[400px]" style={{
              fontFamily: "Inter, sans-serif", fontSize: "12px",
              fontWeight: 500, color: "rgba(255,255,255,0.85)",
            }}>
              {title || "Untitled"}
            </span>
          </div>
          <button onClick={scrollToTop} className="outline-none" style={{
            fontFamily: "Inter, sans-serif", fontSize: "11px", fontWeight: 500,
            color: "rgba(46,196,182,0.85)", background: "transparent",
            border: "none", cursor: "pointer",
          }}>
            Edit
          </button>
        </div>
      </div>
    </>
  );
}
