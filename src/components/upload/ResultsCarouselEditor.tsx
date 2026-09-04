import React, { useState, useRef, useCallback } from "react";
import {
  Images,
  Image as ImageIcon,
  Video,
  Pencil,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Repeat,
  GripVertical,
  X,
  Plus,
  Play,
  Loader2,
} from "lucide-react";

export interface Slide {
  id: string;
  kind: "photo" | "video" | "written";
  mediaUrl?: string;
  text?: string;
  caption: string;
  uploadProgress?: number;
}

interface ResultsCarouselEditorProps {
  slides: Slide[];
  activeSlideIndex: number;
  onActiveSlideChange: (index: number) => void;
  onAddSlide: (kind: "photo" | "video" | "written", files?: File[]) => void;
  onRemoveSlide: (id: string) => void;
  onReplaceSlide: (id: string, file: File) => void;
  onUpdateCaption: (id: string, value: string) => void;
  onUpdateText: (id: string, value: string) => void;
  onReorderSlides: (newOrder: string[]) => void;
  isFileUploading?: boolean;
  maxSlides?: number;
}

export function ResultsCarouselEditor({
  slides,
  activeSlideIndex,
  onActiveSlideChange,
  onAddSlide,
  onRemoveSlide,
  onReplaceSlide,
  onUpdateCaption,
  onUpdateText,
  onReorderSlides,
  maxSlides = 20,
}: ResultsCarouselEditorProps) {
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [draggedThumbnailId, setDraggedThumbnailId] = useState<string | null>(null);
  const [hoveredThumbnailId, setHoveredThumbnailId] = useState<string | null>(null);
  const [showArrows, setShowArrows] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replaceSlideId, setReplaceSlideId] = useState<string | null>(null);

  const isAtCapacity = slides.length >= maxSlides;
  const activeSlide = slides[activeSlideIndex];

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      if (isAtCapacity) return;

      const files = Array.from(e.dataTransfer.files);
      const photos = files.filter((f) => f.type.startsWith("image/"));
      const videos = files.filter((f) => f.type.startsWith("video/"));
      if (photos.length) onAddSlide("photo", photos);
      videos.forEach((v) => onAddSlide("video", [v]));
    },
    [isAtCapacity, onAddSlide]
  );

  const handlePhotoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) onAddSlide("photo", Array.from(files));
      e.target.value = "";
    },
    [onAddSlide]
  );

  const handleVideoSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) onAddSlide("video", Array.from(files));
      e.target.value = "";
    },
    [onAddSlide]
  );

  const handleReplaceFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && replaceSlideId) {
        onReplaceSlide(replaceSlideId, files[0]);
      }
      e.target.value = "";
      setReplaceSlideId(null);
    },
    [onReplaceSlide, replaceSlideId]
  );

  const triggerAdd = (kind: "photo" | "video" | "written") => {
    setShowAddDropdown(false);
    if (kind === "photo") photoInputRef.current?.click();
    else if (kind === "video") videoInputRef.current?.click();
    else onAddSlide("written");
  };

  const goToPrevSlide = useCallback(() => {
    if (activeSlideIndex > 0) onActiveSlideChange(activeSlideIndex - 1);
  }, [activeSlideIndex, onActiveSlideChange]);

  const goToNextSlide = useCallback(() => {
    if (activeSlideIndex < slides.length - 1) onActiveSlideChange(activeSlideIndex + 1);
  }, [activeSlideIndex, slides.length, onActiveSlideChange]);

  const handleThumbnailDragStart = (slideId: string) => setDraggedThumbnailId(slideId);
  const handleThumbnailDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (draggedThumbnailId && draggedThumbnailId !== targetId) {
      const newOrder = slides.map((s) => s.id);
      const draggedIndex = newOrder.indexOf(draggedThumbnailId);
      const targetIndex = newOrder.indexOf(targetId);
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedThumbnailId);
      onReorderSlides(newOrder);
    }
  };
  const handleThumbnailDragEnd = () => setDraggedThumbnailId(null);

  const AddSlideDropdown = () => (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        right: 0,
        zIndex: 50,
        minWidth: 140,
        padding: 4,
        background: "rgba(20,20,24,0.96)",
        border: "0.5px solid rgba(255,255,255,0.10)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.40)",
      }}
    >
      {[
        { kind: "photo" as const, icon: ImageIcon, label: "Photo" },
        { kind: "video" as const, icon: Video, label: "Video" },
        { kind: "written" as const, icon: Pencil, label: "Written" },
      ].map(({ kind, icon: Icon, label }) => (
        <button
          key={kind}
          type="button"
          onClick={() => triggerAdd(kind)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "8px 12px",
            background: "transparent",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontFamily: "Figtree, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(255,255,255,0.85)",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <Icon size={14} color="rgba(255,255,255,0.65)" />
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div style={{ width: "100%", color: "rgba(255,255,255,0.85)" }}>
      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={handleVideoSelect}
      />
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={handleReplaceFile}
      />

      {/* Section Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "Figtree, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          <Images size={12} />
          Your results
        </div>

        <div style={{ position: "relative" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 6,
            }}
          >
            <button
              type="button"
              onClick={() => !isAtCapacity && triggerAdd("photo")}
              disabled={isAtCapacity}
              title={isAtCapacity ? "Maximum 20 slides reached" : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "4px 8px",
                background: "transparent",
                border: "none",
                borderRadius: "6px 0 0 6px",
                cursor: isAtCapacity ? "not-allowed" : "pointer",
                fontFamily: "Figtree, sans-serif",
                fontSize: 12,
                fontWeight: 500,
                color: isAtCapacity ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.85)",
                opacity: isAtCapacity ? 0.5 : 1,
              }}
            >
              <Plus size={12} />
              Add slide
            </button>
            <button
              type="button"
              onClick={() => !isAtCapacity && setShowAddDropdown((v) => !v)}
              disabled={isAtCapacity}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "4px 6px",
                background: "transparent",
                border: "none",
                borderLeft: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: "0 6px 6px 0",
                cursor: isAtCapacity ? "not-allowed" : "pointer",
                color: isAtCapacity ? "rgba(255,255,255,0.30)" : "rgba(255,255,255,0.85)",
                opacity: isAtCapacity ? 0.5 : 1,
              }}
            >
              <ChevronDown size={12} />
            </button>
          </div>
          {showAddDropdown && !isAtCapacity && <AddSlideDropdown />}
        </div>
      </div>

      {/* Carousel */}
      {slides.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            minHeight: 200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            background: isDraggingOver ? "rgba(46,196,182,0.06)" : "rgba(255,255,255,0.02)",
            border: `1px dashed ${
              isDraggingOver ? "rgba(46,196,182,0.5)" : "rgba(255,255,255,0.10)"
            }`,
            borderRadius: 8,
            transition: "all 150ms ease",
          }}
        >
          <Images size={28} color="rgba(255,255,255,0.30)" />
          <div
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: 13,
              color: "rgba(255,255,255,0.50)",
            }}
          >
            {isDraggingOver
              ? "Drop to add"
              : "Drop photos, videos, or add a written result"}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {[
              { kind: "photo" as const, icon: ImageIcon, label: "Photo(s)" },
              { kind: "video" as const, icon: Video, label: "Video" },
              { kind: "written" as const, icon: Pencil, label: "Written" },
            ].map(({ kind, icon: Icon, label }) => (
              <button
                key={kind}
                type="button"
                onClick={() => triggerAdd(kind)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  background: "transparent",
                  border: "0.5px solid rgba(255,255,255,0.10)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          {/* Viewer */}
          <div
            onMouseEnter={() => setShowArrows(true)}
            onMouseLeave={() => setShowArrows(false)}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: "16 / 9",
              background: "rgba(0,0,0,0.40)",
              borderRadius: 8,
              overflow: "hidden",
              border: isDraggingOver
                ? "1px solid rgba(46,196,182,0.5)"
                : "0.5px solid rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ position: "absolute", inset: 0 }}>
              {activeSlide && (
                <>
                  {activeSlide.uploadProgress !== undefined && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        zIndex: 5,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        background: "rgba(0,0,0,0.55)",
                      }}
                    >
                      <Loader2
                        size={28}
                        style={{ color: "#2EC4B6", animation: "spin 1s linear infinite" }}
                      />
                      <div style={{ fontSize: 12, color: "white" }}>
                        {activeSlide.uploadProgress}%
                      </div>
                    </div>
                  )}

                  {activeSlide.kind === "photo" && activeSlide.mediaUrl && (
                    <img
                      src={activeSlide.mediaUrl}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  )}
                  {activeSlide.kind === "video" && activeSlide.mediaUrl && (
                    <video
                      src={activeSlide.mediaUrl}
                      controls
                      style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    />
                  )}
                  {activeSlide.kind === "written" && (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        padding: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <textarea
                        value={activeSlide.text ?? ""}
                        onChange={(e) => onUpdateText(activeSlide.id, e.target.value)}
                        placeholder="Write your result…"
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "transparent",
                          border: "none",
                          outline: "none",
                          resize: "none",
                          fontFamily: "Figtree, sans-serif",
                          fontSize: 16,
                          fontWeight: 400,
                          fontStyle: activeSlide.text ? "normal" : "italic",
                          color: activeSlide.text
                            ? "rgba(255,255,255,0.85)"
                            : "rgba(255,255,255,0.30)",
                          textAlign: "center",
                          lineHeight: 1.6,
                        }}
                      />
                    </div>
                  )}

                  {activeSlide.kind !== "written" && activeSlide.mediaUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplaceSlideId(activeSlide.id);
                        replaceFileInputRef.current?.click();
                      }}
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "4px 10px",
                        background: "rgba(0,0,0,0.50)",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontFamily: "Figtree, sans-serif",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "white",
                      }}
                    >
                      <Repeat size={12} />
                      Replace
                    </button>
                  )}
                </>
              )}
            </div>

            {slides.length > 1 && showArrows && (
              <>
                {activeSlideIndex > 0 && (
                  <button
                    type="button"
                    onClick={goToPrevSlide}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.50)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronLeft size={20} color="white" />
                  </button>
                )}
                {activeSlideIndex < slides.length - 1 && (
                  <button
                    type="button"
                    onClick={goToNextSlide}
                    style={{
                      position: "absolute",
                      right: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.50)",
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ChevronRight size={20} color="white" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Caption */}
          {activeSlide && (
            <div
              style={{
                height: 60,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <input
                type="text"
                value={activeSlide.caption}
                onChange={(e) =>
                  onUpdateCaption(activeSlide.id, e.target.value.slice(0, 500))
                }
                placeholder="Add a caption describing this result…"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 13,
                  fontWeight: 400,
                  fontStyle: "italic",
                  color: activeSlide.caption
                    ? "rgba(255,255,255,0.85)"
                    : "rgba(255,255,255,0.30)",
                }}
              />
              <span
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.30)",
                  whiteSpace: "nowrap",
                }}
              >
                {activeSlide.caption.length} / 500
              </span>
            </div>
          )}

          {/* Dots */}
          {slides.length > 1 && (
            <div
              style={{
                height: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  type="button"
                  onClick={() => onActiveSlideChange(index)}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background:
                      index === activeSlideIndex
                        ? "rgba(255,255,255,0.85)"
                        : "rgba(255,255,255,0.20)",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "background 0.2s ease",
                  }}
                />
              ))}
            </div>
          )}

          {/* Thumbnail strip */}
          <div
            style={{
              height: 50,
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflowX: "auto",
              paddingBottom: 4,
            }}
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => handleThumbnailDragStart(slide.id)}
                onDragOver={(e) => handleThumbnailDragOver(e, slide.id)}
                onDragEnd={handleThumbnailDragEnd}
                onMouseEnter={() => setHoveredThumbnailId(slide.id)}
                onMouseLeave={() => setHoveredThumbnailId(null)}
                onClick={() => onActiveSlideChange(index)}
                style={{
                  position: "relative",
                  width: 60,
                  height: 40,
                  flexShrink: 0,
                  borderRadius: 4,
                  overflow: "hidden",
                  cursor: "pointer",
                  border:
                    index === activeSlideIndex
                      ? "1px solid #E8571A"
                      : "1px solid transparent",
                  opacity: draggedThumbnailId === slide.id ? 0.5 : 1,
                  transition: "opacity 0.2s ease",
                  background: "rgba(0,0,0,0.40)",
                }}
              >
                {slide.kind === "photo" && slide.mediaUrl && (
                  <img
                    src={slide.mediaUrl}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                {slide.kind === "video" && slide.mediaUrl && (
                  <>
                    <video
                      src={slide.mediaUrl}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.30)",
                      }}
                    >
                      <Play size={14} color="white" fill="white" />
                    </div>
                  </>
                )}
                {slide.kind === "written" && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "rgba(46,196,182,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "Figtree, sans-serif",
                        fontSize: 9,
                        fontWeight: 500,
                        color: "rgba(255,255,255,0.85)",
                      }}
                    >
                      Written
                    </span>
                  </div>
                )}
                {slide.uploadProgress !== undefined && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "rgba(0,0,0,0.60)",
                    }}
                  >
                    <Loader2
                      size={14}
                      style={{ color: "#2EC4B6", animation: "spin 1s linear infinite" }}
                    />
                  </div>
                )}
                {hoveredThumbnailId === slide.id && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSlide(slide.id);
                    }}
                    style={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.70)",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <X size={10} color="white" />
                  </button>
                )}
              </div>
            ))}

            {!isAtCapacity && (
              <div style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setShowAddDropdown((v) => !v)}
                  style={{
                    width: 60,
                    height: 40,
                    flexShrink: 0,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.05)",
                    border: "0.5px dashed rgba(255,255,255,0.20)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Plus size={18} color="rgba(255,255,255,0.50)" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
