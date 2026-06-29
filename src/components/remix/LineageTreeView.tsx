import { useState } from 'react'
import { GitFork, ChevronDown, ChevronRight, Crown } from 'lucide-react'
import { tokens, fontMono } from './tokens'

export interface LineageNode {
  id: string
  authorHandle: string
  title: string
  xp: number
  /** Marks the root original blueprint. */
  root?: boolean
  children?: LineageNode[]
}

export interface LineageTreeViewProps {
  root: LineageNode
  /** Generations deeper than this start collapsed. Default 2. */
  collapseDepth?: number
}

interface RowProps {
  node: LineageNode
  depth: number
  collapseDepth: number
  isLast: boolean
}

function TreeRow({ node, depth, collapseDepth, isLast }: RowProps) {
  const hasChildren = !!node.children?.length
  const [open, setOpen] = useState(depth < collapseDepth)

  return (
    <div className="flex flex-col">
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: depth * 22 }}
      >
        {/* connector / toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Collapse' : 'Expand'}
            aria-expanded={open}
            className="inline-flex items-center justify-center"
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: tokens.input,
              border: tokens.borderFaint,
              color: tokens.textMuted,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        ) : (
          <span style={{ width: 20, flexShrink: 0 }} aria-hidden />
        )}

        <div
          className="flex flex-1 items-center gap-2.5"
          style={{
            padding: '8px 11px',
            borderRadius: tokens.cardRadius,
            background: node.root ? 'rgba(232,87,26,0.10)' : tokens.card,
            border: node.root ? '0.5px solid rgba(232,87,26,0.32)' : tokens.borderFaint,
            marginTop: 6,
          }}
        >
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              background: tokens.input,
              flexShrink: 0,
            }}
          >
            {node.root ? (
              <Crown size={14} strokeWidth={2.3} style={{ color: tokens.orange }} />
            ) : (
              <GitFork size={14} strokeWidth={2.2} style={{ color: tokens.teal }} />
            )}
          </span>

          <div className="flex min-w-0 flex-col">
            <span className="truncate" style={{ fontSize: 13, color: tokens.text }}>
              {node.title}
            </span>
            <span style={{ fontSize: 11.5, color: tokens.textMuted }}>@{node.authorHandle}</span>
          </div>

          <span
            className="ml-auto"
            style={{ fontFamily: fontMono, fontSize: 12, color: tokens.orange, fontWeight: 600 }}
          >
            +{node.xp} XP
          </span>
        </div>
      </div>

      {hasChildren && open && (
        <div className="flex flex-col">
          {node.children!.map((child, i) => (
            <TreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              collapseDepth={collapseDepth}
              isLast={i === node.children!.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LineageTreeView({ root, collapseDepth = 2 }: LineageTreeViewProps) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: tokens.panel,
        background: tokens.shell,
        border: tokens.borderSoft,
        backdropFilter: tokens.glass,
        WebkitBackdropFilter: tokens.glass,
      }}
    >
      <div className="mb-1 flex items-center gap-2">
        <GitFork size={15} strokeWidth={2.3} style={{ color: tokens.teal }} />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: tokens.text }}>Lineage</span>
        <span style={{ fontSize: 12, color: tokens.textMuted }}>· family tree</span>
      </div>

      <TreeRow node={root} depth={0} collapseDepth={collapseDepth} isLast />
    </div>
  )
}
