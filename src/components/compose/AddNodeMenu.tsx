// Add a node, grouped by the six categories.
//
// The list is read from the node_types rows on the loaded record — never a
// hardcoded list. A type added, renamed, recoloured or retired in the registry
// changes this menu with no code change, which is the whole point of having a
// registry.

import { useMemo } from "react";
import type { CSSProperties } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NodeType } from "@/lib/build";
import {
  CATEGORY_COLOUR,
  HAIRLINE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  hexToRgba,
  labelText,
} from "@/components/build/tokens";

/** The six categories, in the order the registry defines them. A category the
 *  registry grows beyond these still renders, after them. */
const CATEGORY_ORDER = [
  "instruction",
  "configuration",
  "data",
  "artefact",
  "evidence",
  "narrative",
];

function categoryLabel(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

const trigger: CSSProperties = {
  fontFamily: "inherit",
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: "0.04em",
  height: 28,
  padding: "0 12px",
  borderRadius: 8,
  background: "rgba(255,255,255,0.025)",
  border: `1px solid rgba(255,255,255,0.06)`,
  color: TEXT_SECONDARY,
  cursor: "pointer",
  flexShrink: 0,
};

interface AddNodeMenuProps {
  nodeTypes: NodeType[];
  /** Appends at the end of the current level, then selects what it made. */
  onAdd: (typeKey: string) => void;
  disabled?: boolean;
  /** Named so the creator knows where the node is about to land. */
  levelLabel: string;
}

export function AddNodeMenu({ nodeTypes, onAdd, disabled, levelLabel }: AddNodeMenuProps) {
  // Retired types still render on existing nodes, but nothing new is created
  // against one — that is what is_active means.
  const groups = useMemo(() => {
    const byCategory = new Map<string, NodeType[]>();
    for (const type of nodeTypes) {
      if (!type.is_active) continue;
      const list = byCategory.get(type.category);
      if (list) list.push(type);
      else byCategory.set(type.category, [type]);
    }
    const rank = (category: string) => {
      const index = CATEGORY_ORDER.indexOf(category);
      return index === -1 ? CATEGORY_ORDER.length : index;
    };
    return [...byCategory.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([category, types]) => ({
        category,
        types: [...types].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
      }));
  }, [nodeTypes]);

  if (groups.length === 0) {
    return (
      <span style={{ ...labelText, color: TEXT_MUTED }}>
        No node types are available
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} style={trigger}>
          + Add node
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-visual-slot="modal-surface"
        style={{ fontFamily: "inherit", maxHeight: "60vh", overflowY: "auto", minWidth: 240 }}
      >
        <DropdownMenuLabel style={{ ...labelText, color: TEXT_MUTED, fontSize: 11 }}>
          Adds to {levelLabel}
        </DropdownMenuLabel>
        {groups.map(({ category, types }, index) => (
          <div key={category}>
            {index > 0 ? <DropdownMenuSeparator style={{ background: HAIRLINE }} /> : null}
            <DropdownMenuLabel
              style={{
                ...labelText,
                textTransform: "uppercase",
                fontSize: 10,
                color: CATEGORY_COLOUR[category] ?? TEXT_SECONDARY,
              }}
            >
              {categoryLabel(category)}
            </DropdownMenuLabel>
            {types.map((type) => {
              const colour = type.colour ?? CATEGORY_COLOUR[category] ?? TEXT_SECONDARY;
              return (
                <DropdownMenuItem
                  key={type.key}
                  onSelect={() => onAdd(type.key)}
                  style={{ ...labelText, color: TEXT_PRIMARY, cursor: "pointer", gap: 8 }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 100,
                      background: colour,
                      boxShadow: `0 0 0 3px ${hexToRgba(colour, 0.15)}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span>{type.label}</span>
                    {/* What kind of thing this is, in the colour that means it.
                        The group heading says the same word, but a creator
                        scanning a scrolled menu is not always looking at one,
                        and the colour is the part they learn to read. */}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        color: colour,
                      }}
                    >
                      {categoryLabel(category)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
