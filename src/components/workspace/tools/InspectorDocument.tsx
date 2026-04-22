import * as React from "react";
import { ImagePlus, X, ChevronDown } from "lucide-react";

import {
  PANEL_CARD_BACKGROUND,
  PANEL_DIVIDER,
  PANEL_INPUT_BACKGROUND,
  PANEL_INPUT_BORDER,
  PANEL_INPUT_RADIUS,
  SECTION_LABEL_STYLE,
} from './toolPanelStyles';

interface InspectorDocumentProps {
  // Document section
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  coverUrl?: string;
  onCoverAdd: () => void;
  onCoverRemove: () => void;

  // Stats section
  words: number;
  minToRead: number;
  stages: number;
  blocks: number;

  // Publishing section
  slug: string;
  onSlugChange: (value: string) => void;
  visibility: "public" | "private" | "unlisted";
  onVisibilityChange: (value: "public" | "private" | "unlisted") => void;
  status: "draft" | "published";
  onPublish: () => void;
  publishDisabled?: boolean;
}

export function InspectorDocument({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  coverUrl,
  onCoverAdd,
  onCoverRemove,
  words,
  minToRead,
  stages,
  blocks,
  slug,
  onSlugChange,
  visibility,
  onVisibilityChange,
  status,
  onPublish,
  publishDisabled = false,
}: InspectorDocumentProps) {
  const [isSelectOpen, setIsSelectOpen] = React.useState(false);
  const [isHoveringCover, setIsHoveringCover] = React.useState(false);
  const [isHoveringPublish, setIsHoveringPublish] = React.useState(false);
  const selectRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node)
      ) {
        setIsSelectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className="flex flex-col"
      style={{
        width: "100%",
        backgroundColor: "transparent",
        padding: "0 12px",
      }}
    >
      {/* Document Section */}
      <div className="flex flex-col" style={{ gap: 8, marginBottom: 12 }}>
        <span
          style={SECTION_LABEL_STYLE}
        >
          Document
        </span>

        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled"
          style={{
            width: "100%",
            height: 38,
            backgroundColor: PANEL_INPUT_BACKGROUND,
            border: PANEL_INPUT_BORDER,
            borderRadius: PANEL_INPUT_RADIUS,
            padding: "0 12px",
            fontSize: 13,
            fontWeight: 500,
            color: title ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.30)",
            fontStyle: title ? "normal" : "italic",
            outline: "none",
          }}
        />

        {/* Description Textarea */}
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Add description..."
          style={{
            width: "100%",
            minHeight: 52,
            maxHeight: 80,
            backgroundColor: PANEL_INPUT_BACKGROUND,
            border: PANEL_INPUT_BORDER,
            borderRadius: PANEL_INPUT_RADIUS,
            padding: "10px 12px",
            fontSize: 13,
            color: "rgba(255, 255, 255, 0.72)",
            outline: "none",
            resize: "none",
            lineHeight: 1.4,
          }}
        />

        {/* Cover Zone */}
        {coverUrl ? (
          <div
            className="flex items-center justify-between"
            style={{
              height: 48,
              backgroundColor: PANEL_INPUT_BACKGROUND,
              border: PANEL_INPUT_BORDER,
              borderRadius: PANEL_INPUT_RADIUS,
              padding: "0 12px",
            }}
          >
            <div className="flex items-center" style={{ gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <img
                  src={coverUrl}
                  alt="Cover"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 400,
                  color: "rgba(255, 255, 255, 0.55)",
                }}
              >
                Cover image
              </span>
            </div>
            <button
              onClick={onCoverRemove}
              style={{
                width: 24,
                height: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.45)",
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={onCoverAdd}
            onMouseEnter={() => setIsHoveringCover(true)}
            onMouseLeave={() => setIsHoveringCover(false)}
            className="flex items-center"
            style={{
              height: 48,
              backgroundColor: "transparent",
              border: `1px dashed ${isHoveringCover ? "rgba(255, 255, 255, 0.20)" : "rgba(255, 255, 255, 0.12)"}`,
              borderRadius: 8,
              padding: "0 12px",
              gap: 8,
              cursor: "pointer",
              width: "100%",
            }}
          >
            <ImagePlus
              size={16}
              style={{ color: "rgba(255, 255, 255, 0.45)" }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: isHoveringCover ? "rgba(255, 255, 255, 0.75)" : "rgba(255, 255, 255, 0.55)",
              }}
            >
              Add cover image
            </span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          backgroundColor: 'transparent',
          borderTop: PANEL_DIVIDER,
          margin: "10px 0",
        }}
      />

      {/* Stats Section */}
      <div className="flex flex-col" style={{ gap: 8, marginBottom: 12 }}>
        <span
          style={SECTION_LABEL_STYLE}
        >
          Stats
        </span>

        <div
          className="grid"
          style={{
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <StatCard label="Words" value={words.toLocaleString()} />
          <StatCard label="Min to read" value={minToRead.toString()} />
          <StatCard label="Stages" value={stages.toString()} />
          <StatCard label="Blocks" value={blocks.toString()} />
        </div>
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          backgroundColor: 'transparent',
          borderTop: PANEL_DIVIDER,
          margin: "10px 0",
        }}
      />

      {/* Publishing Section */}
      <div className="flex flex-col" style={{ gap: 8 }}>
        <span
          style={SECTION_LABEL_STYLE}
        >
          Publishing
        </span>

        {/* Slug Input */}
        <div
          className="flex items-center"
          style={{
            height: 38,
            backgroundColor: PANEL_INPUT_BACKGROUND,
            border: PANEL_INPUT_BORDER,
            borderRadius: PANEL_INPUT_RADIUS,
            padding: "0 12px",
          }}
        >
          <span
            style={{
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.30)",
              marginRight: 4,
            }}
          >
            /
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="slug"
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.92)",
              outline: "none",
            }}
          />
        </div>

        {/* Visibility Select */}
        <div ref={selectRef} style={{ position: "relative" }}>
          <button
            onClick={() => setIsSelectOpen(!isSelectOpen)}
            className="flex items-center justify-between"
            style={{
              width: "100%",
              height: 38,
              backgroundColor: PANEL_INPUT_BACKGROUND,
              border: PANEL_INPUT_BORDER,
              borderRadius: PANEL_INPUT_RADIUS,
              padding: "0 12px",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.92)",
                textTransform: "capitalize",
              }}
            >
              {visibility}
            </span>
            <ChevronDown
              size={14}
              style={{
                color: "rgba(255, 255, 255, 0.5)",
                transform: isSelectOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 150ms ease",
              }}
            />
          </button>

          {isSelectOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                backgroundColor: 'hsl(var(--background) / 0.98)',
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: PANEL_INPUT_RADIUS,
                padding: 4,
                zIndex: 10,
              }}
            >
              {(["public", "private", "unlisted"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    onVisibilityChange(option);
                    setIsSelectOpen(false);
                  }}
                  className="flex items-center"
                  style={{
                    width: "100%",
                    height: 32,
                    padding: "0 8px",
                    backgroundColor:
                      visibility === option
                        ? "rgba(255, 255, 255, 0.08)"
                        : "transparent",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "rgba(255, 255, 255, 0.92)",
                    textTransform: "capitalize",
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Pill */}
        <div
          className="flex items-center"
          style={{
            height: 28,
            gap: 6,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              backgroundColor:
                status === "published"
                  ? "rgba(74, 222, 128, 0.9)"
                  : "rgba(250, 204, 21, 0.9)",
            }}
          />
          <span
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.6)",
              textTransform: "capitalize",
            }}
          >
            {status}
          </span>
        </div>

        {/* Publish Button */}
        <button
          onClick={onPublish}
          onMouseEnter={() => setIsHoveringPublish(true)}
          onMouseLeave={() => setIsHoveringPublish(false)}
          disabled={publishDisabled}
          className="flex items-center justify-center"
          style={{
            width: "100%",
            height: 36,
            background: publishDisabled
              ? "rgba(255, 255, 255, 0.1)"
              : isHoveringPublish
                ? "linear-gradient(135deg, #D4470F 0%, #B23A0C 100%)"
                : "linear-gradient(135deg, #E8571A 0%, #D4470F 100%)",
            border: "none",
            borderRadius: 8,
            cursor: publishDisabled ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: publishDisabled
              ? "rgba(255, 255, 255, 0.4)"
              : "rgba(255, 255, 255, 1)",
            opacity: publishDisabled ? 0.6 : 1,
            transition: "background 150ms ease",
          }}
        >
          {status === "published" ? "Update" : "Publish"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col"
      style={{
          backgroundColor: PANEL_CARD_BACKGROUND,
          border: PANEL_DIVIDER,
        borderRadius: 8,
        padding: 10,
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: "rgba(255, 255, 255, 0.40)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.92)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
