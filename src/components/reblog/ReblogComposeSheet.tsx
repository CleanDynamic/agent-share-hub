import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type ChangeEvent,
} from "react"
import {
  X,
  ImagePlus,
  Video,
  Globe,
  Repeat2,
  Play,
} from "lucide-react"
import { EmbeddedExcerptCard } from "./EmbeddedExcerptCard"

export interface ExcerptComposeContext {
  text: string
  sourceBlockId?: string | null
  sourceBlockTypeLabel?: string | null
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReblogUser {
  displayName: string
  handle: string
  avatarUrl?: string
  initials: string
}

export interface OriginalPost {
  id: string
  slug: string
  postType: "Blueprint" | "Blog" | "Bounty"
  title: string
  description?: string
  authorDisplayName: string
  authorHandle: string
  authorAvatarUrl?: string
  publishedAt: string
  coverUrl?: string
}

export interface MediaAttachment {
  kind: "image" | "video"
  url: string
  file?: File
}

export interface ReblogComposeSheetProps {
  isOpen: boolean
  variant: "desktop" | "mobile"
  onClose: () => void
  currentUser: ReblogUser
  originalPost: OriginalPost
  text: string
  onTextChange: (text: string) => void
  mediaAttachment: MediaAttachment | null
  onAttachImage: () => void
  onAttachVideo: () => void
  onRemoveMedia: () => void
  onPost: () => void
  isPosting: boolean
  charCount: number
}

const POST_TYPE_COLOURS: Record<string, string> = {
  Blueprint: "#E8571A",
  Blog: "#2EC4B6",
  Bounty: "#F59E0B",
}

function Avatar({
  url,
  initials,
  size,
}: {
  url?: string
  initials: string
  size: number
}) {
  const [failed, setFailed] = useState(false)
  const showInitials = !url || failed

  return (
    <div
      className="flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: showInitials
          ? "linear-gradient(135deg, #3a3a4a 0%, #2a2a38 100%)"
          : "transparent",
      }}
    >
      {showInitials ? (
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: size * 0.42,
            fontWeight: 600,
            color: "rgba(255,255,255,0.75)",
            lineHeight: 1,
          }}
        >
          {initials}
        </span>
      ) : (
        <img
          src={url}
          alt=""
          onError={() => setFailed(true)}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            objectFit: "cover",
          }}
        />
      )}
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "now"
  if (diffMin < 60) return `${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d`
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function PostButton({
  disabled,
  onClick,
  isPosting,
}: {
  disabled: boolean
  onClick: () => void
  isPosting: boolean
}) {
  return (
    <button
      disabled={disabled || isPosting}
      onClick={onClick}
      style={{
        background: "linear-gradient(135deg, #16A34A 0%, #15803D 100%)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: "#fff",
        padding: "8px 18px",
        borderRadius: 8,
        border: "none",
        lineHeight: 1,
        transition: "opacity 150ms ease",
      }}
    >
      {isPosting ? "Posting…" : "Post"}
    </button>
  )
}

function EmbeddedOriginalCard({ post }: { post: OriginalPost }) {
  const typeColour = POST_TYPE_COLOURS[post.postType] ?? "#E8571A"

  return (
    <div
      style={{
        background: "rgba(82, 82, 100, 0.40)",
        border: "0.5px solid rgba(255, 255, 255, 0.10)",
        borderRadius: 10,
        padding: "12px 14px",
        marginTop: 16,
      }}
    >
      <div className="flex items-center gap-2">
        <Avatar
          url={post.authorAvatarUrl}
          initials={post.authorDisplayName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          size={22}
        />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
          }}
        >
          {post.authorDisplayName}
        </span>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 400,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {post.authorHandle}
        </span>

        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#fff",
            background: typeColour,
            padding: "2px 6px",
            borderRadius: 4,
            lineHeight: 1.4,
          }}
        >
          {post.postType}
        </span>

        <div className="flex-1" />

        {post.coverUrl ? (
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 10,
                fontWeight: 400,
                color: "rgba(255,255,255,0.40)",
              }}
            >
              {timeAgo(post.publishedAt)}
            </span>
            <img
              src={post.coverUrl}
              alt=""
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          </div>
        ) : (
          <span
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 10,
              fontWeight: 400,
              color: "rgba(255,255,255,0.40)",
            }}
          >
            {timeAgo(post.publishedAt)}
          </span>
        )}
      </div>

      <p
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,255,255,0.92)",
          marginTop: 6,
          marginBottom: 0,
          lineHeight: 1.4,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {post.title}
      </p>

      {post.description && (
        <p
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 400,
            color: "rgba(255,255,255,0.65)",
            marginTop: 2,
            marginBottom: 0,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {post.description}
        </p>
      )}
    </div>
  )
}

export default function ReblogComposeSheet({
  isOpen,
  variant,
  onClose,
  currentUser,
  originalPost,
  text,
  onTextChange,
  mediaAttachment,
  onAttachImage,
  onAttachVideo,
  onRemoveMedia,
  onPost,
  isPosting,
  charCount,
}: ReblogComposeSheetProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef<number | null>(null)
  const [dragOffsetY, setDragOffsetY] = useState(0)
  const [visible, setVisible] = useState(false)

  const isDisabled = charCount === 0 && !mediaAttachment

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [isOpen])

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = "auto"
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`
  }, [text])

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 300)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (!isDisabled && !isPosting) onPost()
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose, onPost, isDisabled, isPosting])

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (dy > 0) setDragOffsetY(dy)
  }, [])

  const onTouchEnd = useCallback(() => {
    if (dragOffsetY > 100) {
      onClose()
    }
    setDragOffsetY(0)
    dragStartY.current = null
  }, [dragOffsetY, onClose])

  let counterColour = "rgba(255,255,255,0.40)"
  if (charCount >= 500) counterColour = "#EF4444"
  else if (charCount >= 400) counterColour = "#F59E0B"

  if (!isOpen) return null

  const sheetBackground = "rgba(40, 40, 52, 0.95)"
  const sheetBorder = "0.5px solid rgba(255,255,255,0.14)"
  const sheetBackdropFilter = "blur(40px) saturate(160%)"

  if (variant === "desktop") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          opacity: visible ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          ref={sheetRef}
          className="flex flex-col"
          style={{
            width: 560,
            maxHeight: "80vh",
            background: sheetBackground,
            border: sheetBorder,
            borderRadius: 16,
            backdropFilter: sheetBackdropFilter,
            WebkitBackdropFilter: sheetBackdropFilter,
            transform: visible ? "scale(1)" : "scale(0.96)",
            opacity: visible ? 1 : 0,
            transition: "transform 200ms ease, opacity 200ms ease",
            overflow: "hidden",
          }}
        >
          <Header
            onClose={onClose}
            isDisabled={isDisabled}
            isPosting={isPosting}
            onPost={onPost}
          />

          <div className="flex-1 overflow-y-auto" style={{ padding: "16px 18px" }}>
            <ComposeBody
              currentUser={currentUser}
              text={text}
              onTextChange={onTextChange}
              textareaRef={textareaRef}
              charCount={charCount}
              counterColour={counterColour}
              mediaAttachment={mediaAttachment}
              onAttachImage={onAttachImage}
              onAttachVideo={onAttachVideo}
              onRemoveMedia={onRemoveMedia}
              originalPost={originalPost}
            />
          </div>

          <ActionBar
            isDisabled={isDisabled}
            isPosting={isPosting}
            onPost={onPost}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 280ms cubic-bezier(0.16,1,0.3,1)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 flex flex-col"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          maxHeight: "88vh",
          background: sheetBackground,
          border: sheetBorder,
          borderRadius: "16px 16px 0 0",
          backdropFilter: sheetBackdropFilter,
          WebkitBackdropFilter: sheetBackdropFilter,
          transform: visible
            ? `translateY(${dragOffsetY}px)`
            : "translateY(100%)",
          transition:
            dragOffsetY > 0
              ? "none"
              : "transform 280ms cubic-bezier(0.16,1,0.3,1)",
          overflow: "hidden",
        }}
      >
        <div className="flex justify-center" style={{ paddingTop: 10, paddingBottom: 4 }}>
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 9999,
              background: "rgba(255,255,255,0.30)",
            }}
          />
        </div>

        <Header
          onClose={onClose}
          isDisabled={isDisabled}
          isPosting={isPosting}
          onPost={onPost}
        />

        <div className="flex-1 overflow-y-auto" style={{ padding: "16px 18px" }}>
          <ComposeBody
            currentUser={currentUser}
            text={text}
            onTextChange={onTextChange}
            textareaRef={textareaRef}
            charCount={charCount}
            counterColour={counterColour}
            mediaAttachment={mediaAttachment}
            onAttachImage={onAttachImage}
            onAttachVideo={onAttachVideo}
            onRemoveMedia={onRemoveMedia}
            originalPost={originalPost}
          />
        </div>

        <ActionBar
          isDisabled={isDisabled}
          isPosting={isPosting}
          onPost={onPost}
        />
      </div>
    </div>
  )
}

function Header({
  onClose,
  isDisabled,
  isPosting,
  onPost,
}: {
  onClose: () => void
  isDisabled: boolean
  isPosting: boolean
  onPost: () => void
}) {
  return (
    <div
      className="flex items-center justify-between flex-shrink-0"
      style={{
        height: 52,
        padding: "12px 18px",
        borderBottom: "0.5px solid rgba(255,255,255,0.10)",
      }}
    >
      <button
        onClick={onClose}
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 13,
          fontWeight: 500,
          color: "rgba(255,255,255,0.65)",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        Cancel
      </button>

      <div className="flex items-center gap-1.5">
        <Repeat2
          size={15}
          style={{ color: "#16A34A" }}
          strokeWidth={2.2}
        />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: "rgba(255,255,255,0.95)",
          }}
        >
          Reblog
        </span>
      </div>

      <PostButton
        disabled={isDisabled}
        isPosting={isPosting}
        onClick={onPost}
      />
    </div>
  )
}

function ComposeBody({
  currentUser,
  text,
  onTextChange,
  textareaRef,
  charCount,
  counterColour,
  mediaAttachment,
  onAttachImage,
  onAttachVideo,
  onRemoveMedia,
  originalPost,
}: {
  currentUser: ReblogUser
  text: string
  onTextChange: (t: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  charCount: number
  counterColour: string
  mediaAttachment: MediaAttachment | null
  onAttachImage: () => void
  onAttachVideo: () => void
  onRemoveMedia: () => void
  originalPost: OriginalPost
}) {
  return (
    <>
      <div className="flex items-center gap-2" style={{ height: 28 }}>
        <Avatar
          url={currentUser.avatarUrl}
          initials={currentUser.initials}
          size={28}
        />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: "rgba(255,255,255,0.92)",
          }}
        >
          {currentUser.displayName}
        </span>
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 400,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {currentUser.handle}
        </span>
      </div>

      <div className="relative" style={{ marginTop: 12 }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
            if (e.target.value.length <= 500) {
              onTextChange(e.target.value)
            }
          }}
          placeholder="Add your take…"
          rows={3}
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 14,
            fontWeight: 400,
            color: "rgba(255,255,255,0.92)",
            background: "transparent",
            border: "none",
            outline: "none",
            width: "100%",
            minHeight: 80,
            maxHeight: 240,
            resize: "none",
            lineHeight: 1.55,
            padding: "8px 0",
            transition: "background 150ms ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.04)"
            e.currentTarget.style.borderRadius = "8px"
            e.currentTarget.style.padding = "8px"
          }}
          onBlur={(e) => {
            e.currentTarget.style.background = "transparent"
            e.currentTarget.style.padding = "8px 0"
          }}
        />

        <div
          style={{
            textAlign: "right",
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 500,
            color: counterColour,
            marginTop: 2,
          }}
        >
          {charCount} / 500
        </div>
      </div>

      {!mediaAttachment ? (
        <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
          <button
            onClick={onAttachImage}
            className="flex items-center gap-1.5"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.55)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 6,
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "none")
            }
          >
            <ImagePlus size={16} />
            Photo
          </button>
          <button
            onClick={onAttachVideo}
            className="flex items-center gap-1.5"
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.55)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 6,
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.04)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "none")
            }
          >
            <Video size={16} />
            Video
          </button>
        </div>
      ) : (
        <div className="relative" style={{ marginTop: 12 }}>
          {mediaAttachment.kind === "image" ? (
            <img
              src={mediaAttachment.url}
              alt="Attached media"
              style={{
                width: "100%",
                maxHeight: 280,
                objectFit: "cover",
                borderRadius: 12,
                display: "block",
              }}
            />
          ) : (
            <div
              className="relative flex items-center justify-center"
              style={{
                width: "100%",
                maxHeight: 280,
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(0,0,0,0.40)",
                aspectRatio: "16/9",
              }}
            >
              <video
                src={mediaAttachment.url}
                style={{
                  width: "100%",
                  maxHeight: 280,
                  objectFit: "cover",
                  borderRadius: 12,
                }}
              />
              <div
                className="absolute flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.50)",
                }}
              >
                <Play size={22} style={{ color: "#fff", marginLeft: 2 }} />
              </div>
            </div>
          )}

          <button
            onClick={onRemoveMedia}
            className="absolute flex items-center justify-center"
            style={{
              top: 8,
              right: 8,
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.60)",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <X size={14} style={{ color: "#fff" }} />
          </button>
        </div>
      )}

      <EmbeddedOriginalCard post={originalPost} />
    </>
  )
}

function ActionBar({
  isDisabled,
  isPosting,
  onPost,
}: {
  isDisabled: boolean
  isPosting: boolean
  onPost: () => void
}) {
  return (
    <div
      className="flex items-center justify-between flex-shrink-0"
      style={{
        height: 60,
        padding: "12px 18px",
        borderTop: "0.5px solid rgba(255,255,255,0.10)",
      }}
    >
      <div className="flex items-center gap-1">
        <Globe size={12} style={{ color: "rgba(255,255,255,0.45)" }} />
        <span
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11,
            fontWeight: 500,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Public
        </span>
      </div>

      <PostButton
        disabled={isDisabled}
        isPosting={isPosting}
        onClick={onPost}
      />
    </div>
  )
}
