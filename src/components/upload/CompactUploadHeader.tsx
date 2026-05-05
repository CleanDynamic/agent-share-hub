import React, { useRef, useState, useEffect, useCallback } from "react";
import { ImagePlus, X } from "lucide-react";

interface CompactUploadHeaderProps {
  postType: "blueprint" | "blog" | "bounty";
  mode?: string;
  title: string;
  description: string;
  coverUrl: string | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCoverUpload: (file: File) => void;
  onCoverRemove: () => void;
  maxDescriptionLength?: number;
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
  postType, mode, title, description, coverUrl,
  onTitleChange, onDescriptionChange, onCoverUpload, onCoverRemove,
  maxDescriptionLength = 500,
}: CompactUploadHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [isSticky, setIsSticky] = useState(false);
  const [isHoveringCover, setIsHoveringCover] = useState(false);

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

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onCoverUpload(file);
      e.target.value = "";
    },
    [onCoverUpload]
  );

  const scrollToTop = useCallback(() => {
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const typeStyle = POST_TYPE_STYLES[postType];

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*"
        className="hidden" onChange={handleFileSelect} />

      <div
        ref={containerRef}
        className="w-full max-w-[880px]"
        style={{
          background: "rgba(22,22,30,0.40)",
          border: "0.5px solid rgba(255, 255, 255, 0.14)",
          borderRadius: "12px",
          padding: "16px 24px",
        }}
      >
        <div className="flex items-center gap-2" style={{ height: "24px", paddingBottom: "8px" }}>
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

        <div
          className="flex items-center justify-center cursor-pointer transition-colors relative overflow-hidden"
          style={{
            height: "24px", width: "100%",
            border: isHoveringCover
              ? "0.5px solid rgba(255,255,255,0.10)"
              : "0.5px dashed rgba(255,255,255,0.10)",
            background: isHoveringCover ? "rgba(255, 255, 255, 0.12)" : "rgba(255,255,255,0.02)",
            borderRadius: "6px", marginTop: "8px",
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
                    fontFamily: "Inter, sans-serif", fontSize: "11px",
                    fontWeight: 500, color: "rgba(255,255,255,0.85)",
                  }}>Replace cover</span>
                </div>
              )}
              <button
                className="absolute right-1 flex items-center justify-center z-10"
                style={{ width: "16px", height: "16px", background: "rgba(0,0,0,0.60)", borderRadius: "4px" }}
                onClick={(e) => { e.stopPropagation(); onCoverRemove(); }}
              >
                <X size={10} color="rgba(255,255,255,0.80)" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <ImagePlus size={12} color="rgba(255,255,255,0.45)" />
              <span style={{
                fontFamily: "Inter, sans-serif", fontSize: "11px",
                fontWeight: 500, color: "rgba(255,255,255,0.45)",
              }}>Add cover image</span>
            </div>
          )}
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title your blueprint…"
          className="w-full outline-none compact-upload-title"
          style={{
            height: "40px", padding: "8px 12px", marginTop: "8px",
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

        <div className="relative" style={{ marginTop: "0px" }}>
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
      </div>

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
          className="w-full max-w-[880px] flex items-center justify-between"
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
