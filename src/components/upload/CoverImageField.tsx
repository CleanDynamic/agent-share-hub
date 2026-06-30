import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Move, RefreshCw, Trash2 } from "lucide-react";
import { uploadMedia, MediaUploadError, IMAGE_MIME } from "@/lib/media/uploadMedia";
import { deleteMedia } from "@/lib/media/deleteMedia";
import type { CoverImage } from "@/types/blueprintMedia";
import { useToast } from "@/hooks/use-toast";

const BUCKET = "blueprint-media";
const PATH_PREFIX = "covers";
const ACCEPT = IMAGE_MIME.join(",");

interface CoverImageFieldProps {
  value: CoverImage;
  onChange: (next: CoverImage) => void;
  altText?: string;
  onRequestReframe?: () => void;
}

export function CoverImageField({
  value,
  onChange,
  altText,
  onRequestReframe,
}: CoverImageFieldProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    };
  }, [pendingPreview]);

  const objectPosition = useMemo(() => {
    const fx = value?.focalX ?? 0.5;
    const fy = value?.focalY ?? 0.5;
    return `${Math.round(fx * 100)}% ${Math.round(fy * 100)}%`;
  }, [value]);

  const openPicker = useCallback(() => {
    if (uploading) return;
    inputRef.current?.click();
  }, [uploading]);

  const doUpload = useCallback(
    async (file: File) => {
      setError(null);
      // immediate preview
      const previewUrl = URL.createObjectURL(file);
      setPendingPreview(previewUrl);
      setUploading(true);
      setProgress(0);

      const previousPath = value?.path ?? null;
      try {
        const result = await uploadMedia({
          file,
          bucket: BUCKET,
          pathPrefix: PATH_PREFIX,
          onProgress: (pct) => setProgress(pct),
        });
        onChange({
          url: result.url,
          path: result.path,
          focalX: 0.5,
          focalY: 0.5,
        });
        if (previousPath && previousPath !== result.path) {
          deleteMedia({ bucket: BUCKET, path: previousPath }).catch(() => {});
        }
      } catch (err) {
        const msg =
          err instanceof MediaUploadError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Upload failed.";
        if (err instanceof MediaUploadError && (err.code === "MEDIA_TYPE_UNSUPPORTED" || err.code === "MEDIA_TOO_LARGE")) {
          setError(msg);
        } else {
          toast({ title: "Cover upload failed", description: msg, variant: "destructive" });
        }
      } finally {
        setUploading(false);
        setProgress(0);
        setPendingPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
      }
    },
    [onChange, value, toast],
  );

  const handleFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (!(IMAGE_MIME as readonly string[]).includes(file.type)) {
        setError("Please choose a JPG, PNG, WEBP or GIF image.");
        return;
      }
      void doUpload(file);
    },
    [doUpload],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      handleFile(f);
      e.target.value = "";
    },
    [handleFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const f = e.dataTransfer.files?.[0];
      handleFile(f);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  }, []);

  const onRemove = useCallback(async () => {
    if (!value) return;
    if (!window.confirm("Remove cover image?")) return;
    const path = value.path;
    onChange(null);
    if (path) {
      try {
        await deleteMedia({ bucket: BUCKET, path });
      } catch {
        /* silent — DB cleared, file is orphaned but harmless */
      }
    }
  }, [value, onChange]);

  const onReplaceClick = useCallback(() => {
    openPicker();
  }, [openPicker]);

  const onKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (uploading || value) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPicker();
      }
    },
    [openPicker, uploading, value],
  );

  const showLoaded = !!value && !uploading;
  const previewSrc = pendingPreview ?? value?.url ?? null;

  // visual states
  const borderStyle =
    isDragging
      ? "0.5px solid #E8571A"
      : isHovering && !value
        ? "0.5px solid rgba(255,255,255,0.18)"
        : value
          ? "0.5px solid rgba(255,255,255,0.10)"
          : "0.5px dashed rgba(255,255,255,0.14)";

  const bgStyle = isDragging
    ? "rgba(232,87,26,0.08)"
    : isHovering && !value
      ? "rgba(255,255,255,0.06)"
      : "rgba(255,255,255,0.02)";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onInputChange}
      />

      <div
        ref={dropRef}
        role={value ? undefined : "button"}
        tabIndex={value || uploading ? -1 : 0}
        aria-label={value ? "Cover image" : "Add cover image"}
        aria-busy={uploading || undefined}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={() => {
          if (value || uploading) return;
          openPicker();
        }}
        onKeyDown={onKey}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="relative overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        style={{
          height: "180px",
          width: "100%",
          border: borderStyle,
          background: bgStyle,
          borderRadius: "8px",
          cursor: value || uploading ? "default" : "pointer",
          transition: "background 120ms ease, border-color 120ms ease",
        }}
      >
        {/* Empty state */}
        {!previewSrc && !uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
            <ImagePlus size={32} color="rgba(255,255,255,0.45)" />
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "13px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Drag an image here, or
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openPicker();
              }}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "12px",
                fontWeight: 500,
                color: "rgba(255,255,255,0.85)",
                background: "rgba(255,255,255,0.04)",
                border: "0.5px solid rgba(255,255,255,0.18)",
                padding: "6px 14px",
                borderRadius: "100px",
                cursor: "pointer",
              }}
            >
              Choose image
            </button>
          </div>
        )}

        {/* Preview (loaded OR uploading) */}
        {previewSrc && (
          <img
            src={previewSrc}
            alt={altText || "Blueprint cover image"}
            className="absolute inset-0 w-full h-full"
            style={{
              objectFit: "cover",
              objectPosition: uploading ? "center" : objectPosition,
            }}
            draggable={false}
          />
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <CircularProgress value={progress} />
          </div>
        )}

        {/* Loaded hover toolbar */}
        {showLoaded && isHovering && (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 z-10"
            style={{
              padding: "4px",
              background: "rgba(8,8,12,0.65)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "0.5px solid rgba(255,255,255,0.14)",
              borderRadius: "100px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ToolbarIconButton
              label="Reframe"
              onClick={() => onRequestReframe?.()}
            >
              <Move size={14} color="rgba(255,255,255,0.85)" />
            </ToolbarIconButton>
            <ToolbarIconButton label="Replace" onClick={onReplaceClick}>
              <RefreshCw size={14} color="rgba(255,255,255,0.85)" />
            </ToolbarIconButton>
            <ToolbarIconButton
              label="Remove"
              onClick={onRemove}
              destructive
            >
              <Trash2 size={14} />
            </ToolbarIconButton>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: "6px",
            fontFamily: "Inter, sans-serif",
            fontSize: "12px",
            fontWeight: 500,
            color: "#F87171",
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}

function ToolbarIconButton({
  children,
  onClick,
  label,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  destructive?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex items-center justify-center"
      style={{
        width: "26px",
        height: "26px",
        borderRadius: "100px",
        background: hover ? "rgba(255,255,255,0.10)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: destructive && hover ? "#F87171" : "rgba(255,255,255,0.85)",
        transition: "background 120ms ease, color 120ms ease",
      }}
    >
      {React.isValidElement(children) && destructive
        ? React.cloneElement(children as React.ReactElement<any>, {
            color: hover ? "#F87171" : "rgba(255,255,255,0.85)",
          })
        : children}
    </button>
  );
}

function CircularProgress({ value }: { value: number }) {
  const size = 40;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circ - (clamped / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#E8571A"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 200ms ease" }}
      />
    </svg>
  );
}
