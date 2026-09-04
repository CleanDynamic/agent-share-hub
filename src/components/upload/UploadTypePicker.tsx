import * as React from "react"
import { Sparkles, PenLine, Trophy, Target, X, ChevronRight } from "lucide-react"

export type UploadContentType = "blueprint" | "blog" | "bounty" | "meta-bounty"

interface UploadTypePickerProps {
  isOpen: boolean
  onClose: () => void
  variant: "desktop" | "mobile"
  onSelect: (type: UploadContentType) => void
  mode?: "all" | "bounty"
}

const contentOptions: Array<{
  type: UploadContentType
  icon: React.ElementType
  iconColor: string
  title: string
  description: string
}> = [
  {
    type: "blueprint",
    icon: Sparkles,
    iconColor: "#E8571A",
    title: "Blueprint",
    description:
      "An article with embedded visual workflows. Best for tutorials, recipes, and how-tos.",
  },
  {
    type: "blog",
    icon: PenLine,
    iconColor: "#2EC4B6",
    title: "Blog",
    description:
      "Long-form writing with inline references to blueprints, stages, or blocks.",
  },
  {
    type: "bounty",
    icon: Trophy,
    iconColor: "#F59E0B",
    title: "Bounty",
    description:
      "Post a partial blueprint and ask the community to fill in the gaps.",
  },
  {
    type: "meta-bounty",
    icon: Target,
    iconColor: "#7C3AED",
    title: "Meta-bounty",
    description:
      "Spawn multiple linked bounties under one umbrella problem.",
  },
]

export function UploadTypePicker({
  isOpen,
  onClose,
  variant,
  onSelect,
  mode = "all",
}: UploadTypePickerProps) {
  const visibleOptions = React.useMemo(
    () => (mode === "bounty"
      ? contentOptions.filter((o) => o.type === "bounty" || o.type === "meta-bounty")
      : contentOptions),
    [mode],
  )
  const pickerTitle = mode === "bounty" ? "Start a bounty" : "What are you creating?"
  const modalRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const [isAnimating, setIsAnimating] = React.useState(false)
  const [isVisible, setIsVisible] = React.useState(false)
  const [dragY, setDragY] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragStartY = React.useRef(0)

  React.useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement
      setIsVisible(true)
      setIsAnimating(true)
      const timer = setTimeout(() => setIsAnimating(false), variant === "desktop" ? 200 : 280)
      return () => clearTimeout(timer)
    } else if (isVisible) {
      setIsAnimating(true)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setIsAnimating(false)
        triggerRef.current?.focus()
      }, variant === "desktop" ? 200 : 280)
      return () => clearTimeout(timer)
    }
  }, [isOpen, variant, isVisible])

  React.useEffect(() => {
    if (!isOpen || !modalRef.current) return
    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]
    setTimeout(() => firstElement?.focus(), 50)

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleTab)
    return () => document.removeEventListener("keydown", handleTab)
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (variant === "desktop" && e.key >= "1" && e.key <= "4") {
        const index = parseInt(e.key) - 1
        if (visibleOptions[index]) {
          onSelect(visibleOptions[index].type)
          onClose()
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, variant, onSelect, onClose])

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    if (variant !== "mobile") return
    setIsDragging(true)
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
  }

  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging || variant !== "mobile") return
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY
    const delta = Math.max(0, clientY - dragStartY.current)
    setDragY(delta)
  }

  const handleDragEnd = () => {
    if (!isDragging || variant !== "mobile") return
    setIsDragging(false)
    if (dragY > 100) {
      onClose()
    }
    setDragY(0)
  }

  const handleOptionClick = (type: UploadContentType) => {
    onSelect(type)
    onClose()
  }

  if (!isVisible) return null

  const isDesktop = variant === "desktop"
  const isClosing = !isOpen && isAnimating

  const getBackdropStyle = (): React.CSSProperties => ({
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    zIndex: 50,
    opacity: isClosing ? 0 : 1,
    transition: `opacity ${isDesktop ? 200 : 280}ms ease-out`,
  })

  const getModalStyle = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      position: "fixed",
      backgroundColor: "rgba(40, 40, 52, 0.95)",
      backdropFilter: "blur(40px) saturate(160%)",
      WebkitBackdropFilter: "blur(40px) saturate(160%)",
      border: "0.5px solid rgba(255, 255, 255, 0.14)",
      boxShadow: "0 24px 64px rgba(0, 0, 0, 0.50)",
      display: "flex",
      flexDirection: "column",
      zIndex: 51,
    }

    if (isDesktop) {
      return {
        ...baseStyle,
        top: "50%",
        left: "50%",
        width: "540px",
        maxWidth: "92vw",
        borderRadius: "16px",
        padding: "24px",
        transform: isClosing
          ? "translate(-50%, -50%) scale(0.96)"
          : isAnimating
            ? "translate(-50%, -50%) scale(0.96)"
            : "translate(-50%, -50%) scale(1)",
        opacity: isClosing ? 0 : isAnimating ? 0 : 1,
        transition: "transform 200ms ease-out, opacity 200ms ease-out",
      }
    }

    const translateY = isClosing ? "100%" : isDragging ? `${dragY}px` : isAnimating ? "100%" : "0"
    return {
      ...baseStyle,
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: "75vh",
      borderRadius: "16px 16px 0 0",
      padding: "16px",
      transform: `translateY(${translateY})`,
      transition: isDragging ? "none" : "transform 280ms cubic-bezier(0.16, 1, 0.3, 1)",
    }
  }

  const getCardStyle = (isHovered: boolean, isPressed: boolean): React.CSSProperties => ({
    backgroundColor: isHovered ? "rgba(68, 68, 84, 0.65)" : "rgba(68, 68, 84, 0.50)",
    border: isHovered
      ? "0.5px solid rgba(232, 87, 26, 0.40)"
      : "0.5px solid rgba(255, 255, 255, 0.10)",
    borderRadius: "12px",
    padding: "16px",
    cursor: "pointer",
    minHeight: isDesktop ? "130px" : "88px",
    transform: isPressed ? "scale(0.98)" : isHovered ? "scale(1.02)" : "scale(1)",
    transition: "transform 120ms ease-out, background-color 120ms ease-out, border 120ms ease-out",
    display: "flex",
    flexDirection: "column",
  })

  return (
    <>
      <div style={getBackdropStyle()} onClick={onClose} aria-hidden="true" />
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-picker-title"
        style={getModalStyle()}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {!isDesktop && (
          <div className="flex justify-center pb-3">
            <div
              style={{
                width: "36px",
                height: "4px",
                backgroundColor: "rgba(255, 255, 255, 0.30)",
                borderRadius: "9999px",
              }}
            />
          </div>
        )}

        <div
          className="flex items-center justify-between"
          style={{ height: "40px", paddingBottom: "16px" }}
        >
          <h2
            id="upload-picker-title"
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: "16px",
              fontWeight: 600,
              color: "rgba(255, 255, 255, 0.95)",
              margin: 0,
            }}
          >
            {pickerTitle}
          </h2>
          {isDesktop && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                borderRadius: "8px",
              }}
            >
              <X size={16} style={{ color: "rgba(255, 255, 255, 0.60)" }} />
            </button>
          )}
        </div>

        <div className={isDesktop ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2.5"}>
          {visibleOptions.map((option, index) => (
            <OptionCard
              key={option.type}
              option={option}
              isDesktop={isDesktop}
              index={index}
              onClick={() => handleOptionClick(option.type)}
              getCardStyle={getCardStyle}
            />
          ))}
        </div>

        <div
          className="flex items-center justify-between"
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "0.5px solid rgba(255, 255, 255, 0.10)",
          }}
        >
          <span
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: "12px",
              fontWeight: 400,
              color: "rgba(255, 255, 255, 0.50)",
            }}
          >
            Need help choosing?
          </span>
          <a
            href="/docs/content-types"
            style={{
              fontFamily: "Figtree, sans-serif",
              fontSize: "12px",
              fontWeight: 500,
              color: "#E8571A",
              textDecoration: "none",
            }}
          >
            Read the guide →
          </a>
        </div>
      </div>
    </>
  )
}

function OptionCard({
  option,
  isDesktop,
  onClick,
  getCardStyle,
}: {
  option: {
    type: UploadContentType
    icon: React.ElementType
    iconColor: string
    title: string
    description: string
  }
  isDesktop: boolean
  index: number
  onClick: () => void
  getCardStyle: (isHovered: boolean, isPressed: boolean) => React.CSSProperties
}) {
  const [isHovered, setIsHovered] = React.useState(false)
  const [isPressed, setIsPressed] = React.useState(false)

  const Icon = option.icon

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setIsPressed(false)
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`Create ${option.title}: ${option.description}`}
      style={getCardStyle(isHovered, isPressed)}
    >
      <div className="flex items-start justify-between">
        <Icon size={isDesktop ? 28 : 22} style={{ color: option.iconColor }} />
        <ChevronRight size={14} style={{ color: "rgba(255, 255, 255, 0.35)" }} />
      </div>

      <div
        style={{
          marginTop: "10px",
          fontFamily: "Figtree, sans-serif",
          fontSize: isDesktop ? "14px" : "13px",
          fontWeight: 600,
          color: "rgba(255, 255, 255, 0.95)",
          textAlign: "left",
        }}
      >
        {option.title}
      </div>

      <div
        style={{
          marginTop: "4px",
          fontFamily: "Figtree, sans-serif",
          fontSize: "12px",
          fontWeight: 400,
          lineHeight: 1.45,
          color: "rgba(255, 255, 255, 0.60)",
          textAlign: "left",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {option.description}
      </div>
    </button>
  )
}
