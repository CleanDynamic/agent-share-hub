import * as React from "react";
import { Node, mergeAttributes } from "@tiptap/react";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { InlineReferenceChip } from "./InlineReferenceChip";
import { blueprintUrl, stageDeepLink, blockDeepLink } from "@/lib/deepLink";
import { toast } from "sonner";

/**
 * BlogReferenceExtension
 *
 * Inline atom node that renders an InlineReferenceChip. Stored in the
 * article TipTap document as `<blogReference …/>` and round-trips via
 * data attributes on a <span> element.
 *
 * Attributes
 *  - referenceType        : 'blueprint' | 'stage' | 'block'
 *  - referenceId          : id of the referenced item
 *  - referenceLabel       : title/name shown on the chip (kept fresh on save)
 *  - parentBlueprintSlug  : id (named "slug" for spec parity) of the parent
 *                            blueprint — used to build the deep link
 *  - parentStageId        : (block only) parent stage id, for deep-link hash
 *  - blockColor           : (block only) dot colour
 *  - isAccessible         : false → lock icon
 *  - isBroken             : true  → broken/red strikethrough state
 */

export type BlogReferenceType = "blueprint" | "stage" | "block";

export interface BlogReferenceAttrs {
  referenceType: BlogReferenceType;
  referenceId: string;
  referenceLabel: string;
  parentBlueprintSlug: string; // actually parent blueprint id
  parentStageId?: string | null;
  blockColor?: string | null;
  isAccessible?: boolean;
  isBroken?: boolean;
}

function deepLinkFor(attrs: BlogReferenceAttrs): string {
  const parent = attrs.parentBlueprintSlug || attrs.referenceId;
  switch (attrs.referenceType) {
    case "blueprint":
      return blueprintUrl(attrs.referenceId);
    case "stage":
      return stageDeepLink(parent, attrs.referenceId);
    case "block":
      return blockDeepLink(parent, attrs.referenceId);
  }
}

function ChipNodeView({ node, editor, getPos }: NodeViewProps) {
  const attrs = node.attrs as BlogReferenceAttrs;
  const href = deepLinkFor(attrs);
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    // While editing, plain click should NOT navigate. Cmd/Ctrl-click opens.
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) {
      e.preventDefault();
      return;
    }
    if (attrs.isBroken) {
      toast("This reference is unavailable");
      return;
    }
    if (attrs.isAccessible === false) {
      toast("This content is private");
      return;
    }
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  React.useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("mousedown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const removeChip = () => {
    setMenu(null);
    if (typeof getPos !== "function") return;
    const pos = getPos();
    editor
      .chain()
      .focus()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .run();
  };

  const replaceChip = () => {
    setMenu(null);
    // Remove the chip; the editor host's @-trigger will re-open the picker
    // when the user types a fresh "@".
    removeChip();
    toast("Type @ to pick a new reference");
  };

  const openInNewTab = () => {
    setMenu(null);
    if (attrs.isBroken) return;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <NodeViewWrapper
      as="span"
      data-blog-reference
      style={{ display: "inline" }}
      onContextMenu={handleContextMenu}
    >
      <InlineReferenceChip
        type={attrs.referenceType}
        label={attrs.referenceLabel || "Untitled"}
        subColor={attrs.blockColor || undefined}
        href={href}
        isAccessible={attrs.isAccessible !== false}
        isBroken={attrs.isBroken === true}
        onClick={handleClick}
      />
      {menu ? (
        <span
          contentEditable={false}
          style={{
            position: "fixed",
            top: menu.y,
            left: menu.x,
            zIndex: 9999,
            background: "rgba(16,16,24,0.96)",
            border: "0.5px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            padding: 4,
            minWidth: 180,
            display: "flex",
            flexDirection: "column",
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <ContextMenuItem onClick={openInNewTab}>Open reference</ContextMenuItem>
          <ContextMenuItem onClick={replaceChip}>Replace reference</ContextMenuItem>
          <ContextMenuItem onClick={removeChip} danger>
            Remove reference
          </ContextMenuItem>
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}

function ContextMenuItem({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        padding: "7px 10px",
        borderRadius: 4,
        color: danger ? "#ef4444" : "rgba(255,255,255,0.85)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255, 255, 255, 0.14)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

export const BlogReferenceExtension = Node.create({
  name: "blogReference",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      referenceType: { default: "blueprint" },
      referenceId: { default: "" },
      referenceLabel: { default: "" },
      parentBlueprintSlug: { default: "" },
      parentStageId: { default: null },
      blockColor: { default: null },
      isAccessible: { default: true },
      isBroken: { default: false },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-blog-reference]",
        getAttrs: (el) => {
          const node = el as HTMLElement;
          return {
            referenceType: node.getAttribute("data-ref-type") ?? "blueprint",
            referenceId: node.getAttribute("data-ref-id") ?? "",
            referenceLabel: node.getAttribute("data-ref-label") ?? "",
            parentBlueprintSlug: node.getAttribute("data-parent-slug") ?? "",
            parentStageId: node.getAttribute("data-parent-stage") || null,
            blockColor: node.getAttribute("data-block-color") || null,
            isAccessible: node.getAttribute("data-accessible") !== "false",
            isBroken: node.getAttribute("data-broken") === "true",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const a = node.attrs as BlogReferenceAttrs;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-blog-reference": "",
        "data-ref-type": a.referenceType,
        "data-ref-id": a.referenceId,
        "data-ref-label": a.referenceLabel,
        "data-parent-slug": a.parentBlueprintSlug,
        "data-parent-stage": a.parentStageId ?? "",
        "data-block-color": a.blockColor ?? "",
        "data-accessible": String(a.isAccessible !== false),
        "data-broken": String(a.isBroken === true),
      }),
      a.referenceLabel || "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChipNodeView);
  },
});
