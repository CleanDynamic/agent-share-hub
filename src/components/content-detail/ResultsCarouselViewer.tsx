import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  MessageSquare,
  Volume2,
  VolumeX,
} from "lucide-react";
import { scrollBehavior } from "@/lib/theme/motion";

export interface Slide {
  id: string;
  kind: "photo" | "video" | "written";
  mediaUrl?: string;
  text?: string;
  caption: string;
  commentCount: number;
}

interface ResultsCarouselViewerProps {
  slides: Slide[];
  postSlug: string;
  onSaveAll: () => void;
  onSlideShare: (slideId: string, anchorEl: HTMLElement) => void;
  onSlideComments: (slideId: string) => void;
  initialSlideId?: string | null;
}

export function ResultsCarouselViewer({
  slides,
  postSlug,
  onSaveAll,
  onSlideShare,
  onSlideComments,
  initialSlideId,
}: ResultsCarouselViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [isSmall, setIsSmall] = useState(
    typeof window !== "undefined" ? window.innerWidth < 600 : false,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < 600);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Snap to deep-linked slide on mount or when slides load
  useEffect(() => {
    if (!initialSlideId || slides.length === 0) return;
    const idx = slides.findIndex((s) => s.id === initialSlideId);
    if (idx >= 0) {
      setCurrentIndex(idx);
      requestAnimationFrame(() => {
        containerRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: "center" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlideId, slides.length]);

  const goToSlide = useCallback(
    (index: number) => {
      if (index >= 0 && index < slides.length) {
        setCurrentIndex(index);
        setExpandedCaption(false);
      }
    },
    [slides.length],
  );

  const goToPrevious = useCallback(() => goToSlide(currentIndex - 1), [currentIndex, goToSlide]);
  const goToNext = useCallback(() => goToSlide(currentIndex + 1), [currentIndex, goToSlide]);

  // Keyboard nav (only when carousel is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        !containerRef.current ||
        (active !== containerRef.current && !containerRef.current.contains(active))
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToPrevious, goToNext]);

  const currentSlide = slides[currentIndex];

  // Video autoplay handling
  useEffect(() => {
    if (!currentSlide) return;
    videoRefs.current.forEach((video, id) => {
      if (id === currentSlide.id && currentSlide.kind === "video") {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [currentIndex, currentSlide]);

  if (!slides || slides.length === 0) return null;
  if (!currentSlide) return null;

  const handleDragEnd = (
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    const threshold = 50;
    if (info.offset.x > threshold) goToPrevious();
    else if (info.offset.x < -threshold) goToNext();
  };

  const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) =>
    onSlideShare(currentSlide.id, e.currentTarget);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    videoRefs.current.forEach((v) => {
      v.muted = !isMuted;
    });
  };

  const renderDots = () => {
    const maxDots = 10;
    const showCollapsed = slides.length > maxDots;
    return (
      <div
        className="flex items-center justify-center gap-1.5 flex-wrap"
        style={{ minHeight: 16, padding: "12px 0" }}
      >
        {slides.slice(0, showCollapsed ? maxDots - 1 : slides.length).map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => goToSlide(index)}
            aria-label={`Go to slide ${index + 1}`}
            style={{
              width: index === currentIndex ? 9 : 6,
              height: index === currentIndex ? 9 : 6,
              borderRadius: "50%",
              backgroundColor:
                index === currentIndex ? "var(--text)" : "var(--recess)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              transition: "all 200ms ease",
            }}
          />
        ))}
        {showCollapsed && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "Figtree, sans-serif",
              color: "var(--text2)",
              marginLeft: 2,
            }}
          >
            …
          </span>
        )}
      </div>
    );
  };

  const isCaptionLong = !!currentSlide.caption && currentSlide.caption.length > 200;
  const viewerHeight = isSmall ? 240 : 380;

  return (
    <div
      ref={containerRef}
      id={`result-slide-${currentSlide.id}`}
      data-results-carousel
      className="w-full max-w-[880px] mx-auto outline-none"
      tabIndex={0}
      style={{ fontFamily: "Figtree, sans-serif", marginBottom: 24 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ height: 32, padding: "0 0 8px 0" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Results
          </span>
          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text2)" }}>
            {currentIndex + 1} of {slides.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onSaveAll}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors hover:bg-muted"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Bookmark size={12} style={{ color: "var(--text2)" }} />
          <span style={{ fontSize: 12, color: "var(--text2)" }}>Save all to Library</span>
        </button>
      </div>

      {/* Viewer */}
      <div
        className="relative overflow-hidden"
        style={{
          height: viewerHeight,
          backgroundColor: "color-mix(in srgb, var(--porthole) 62%, transparent)",
          borderRadius: 12,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
          >
            {currentSlide.kind === "photo" && currentSlide.mediaUrl && (
              <img
                src={currentSlide.mediaUrl}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            )}

            {currentSlide.kind === "video" && currentSlide.mediaUrl && (
              <div className="relative w-full h-full">
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(currentSlide.id, el);
                  }}
                  src={currentSlide.mediaUrl}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  muted={isMuted}
                  playsInline
                />
                <button
                  type="button"
                  onClick={toggleMute}
                  className="absolute bottom-3 right-3 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
                  style={{
                    width: 32,
                    height: 32,
                    backgroundColor: "color-mix(in srgb, var(--porthole) 62%, transparent)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? (
                    <VolumeX size={16} style={{ color: "var(--text)" }} />
                  ) : (
                    <Volume2 size={16} style={{ color: "var(--text)" }} />
                  )}
                </button>
              </div>
            )}

            {currentSlide.kind === "written" && (
              <div
                className="w-full h-full flex items-center justify-center text-center"
                style={{
                  background:
                    "linear-gradient(180deg, color-mix(in srgb, var(--evidence) 4%, transparent) 0%, transparent 100%)",
                  padding: "32px 48px",
                }}
              >
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 400,
                    fontStyle: "italic",
                    lineHeight: 1.6,
                    color: "var(--text)",
                  }}
                >
                  {currentSlide.text}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Arrows */}
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={goToPrevious}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "color-mix(in srgb, var(--porthole) 62%, transparent)",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Previous slide"
          >
            <ChevronLeft size={20} style={{ color: "var(--text)" }} />
          </button>
        )}
        {currentIndex < slides.length - 1 && (
          <button
            type="button"
            onClick={goToNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
            style={{
              width: 40,
              height: 40,
              backgroundColor: "color-mix(in srgb, var(--porthole) 62%, transparent)",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Next slide"
          >
            <ChevronRight size={20} style={{ color: "var(--text)" }} />
          </button>
        )}

        <button
          type="button"
          onClick={handleMenuClick}
          className="absolute top-3 right-3 flex items-center justify-center rounded-full transition-colors hover:bg-muted"
          style={{
            width: 28,
            height: 28,
            backgroundColor: "color-mix(in srgb, var(--porthole) 62%, transparent)",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Slide options"
        >
          <MoreHorizontal size={14} style={{ color: "var(--text)" }} />
        </button>

        {currentSlide.commentCount > 0 && (
          <button
            type="button"
            onClick={() => onSlideComments(currentSlide.id)}
            className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full transition-colors hover:bg-muted"
            style={{
              padding: "4px 8px",
              backgroundColor: "color-mix(in srgb, var(--porthole) 62%, transparent)",
              border: "none",
              cursor: "pointer",
            }}
            aria-label={`${currentSlide.commentCount} comments on this slide`}
          >
            <MessageSquare size={12} style={{ color: "var(--text)" }} />
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                minWidth: 14,
                height: 14,
                fontSize: 9,
                fontWeight: 600,
                color: "var(--text)",
                backgroundColor: "var(--recess)",
              }}
            >
              {currentSlide.commentCount}
            </span>
          </button>
        )}
      </div>

      {/* Caption */}
      {currentSlide.caption && (
        <div
          style={{
            maxHeight: expandedCaption ? "none" : 100,
            overflow: "hidden",
            padding: "12px 16px 0 16px",
          }}
        >
          <AnimatePresence mode="wait">
            <motion.p
              key={`caption-${currentSlide.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                fontSize: 14,
                fontWeight: 400,
                fontStyle: "italic",
                lineHeight: 1.5,
                color: "var(--text)",
                margin: 0,
              }}
            >
              {currentSlide.caption}
            </motion.p>
          </AnimatePresence>
          {isCaptionLong && !expandedCaption && (
            <button
              type="button"
              onClick={() => setExpandedCaption(true)}
              style={{
                marginTop: 4,
                padding: 0,
                border: "none",
                background: "transparent",
                fontSize: 14,
                color: "var(--text2)",
                cursor: "pointer",
              }}
            >
              Read more →
            </button>
          )}
        </div>
      )}

      {renderDots()}
    </div>
  );
}
