import * as React from 'react'
import {
  FileText,
  LayoutGrid,
  Box,
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
} from 'lucide-react'

export type SearchMode = 'blueprints' | 'stages' | 'blocks'

export interface ActiveFilter {
  key: string
  label: string
}

export interface DiscoverSearchHeaderProps {
  activeMode: SearchMode
  onModeChange: (mode: SearchMode) => void
  query: string
  onQueryChange: (query: string) => void
  counts: { blueprints: string; stages: string; blocks: string }
  activeFilters: ActiveFilter[]
  onFilterRemove: (key: string) => void
  onClearFilters: () => void
  onOpenFilters: () => void
  resultCount: number
  sort: string
  onSortChange: (sort: string) => void
}

const sortOptions = ['Most recent', 'Most engaged', 'Most referenced', 'Newest first']

const placeholders: Record<SearchMode, string> = {
  blueprints: 'Search blueprints...',
  stages: 'Search stages by name, contents, or pattern...',
  blocks: 'Search blocks by name, prompt text, or content...',
}

export function DiscoverSearchHeader({
  activeMode,
  onModeChange,
  query,
  onQueryChange,
  counts,
  activeFilters,
  onFilterRemove,
  onClearFilters,
  onOpenFilters,
  resultCount,
  sort,
  onSortChange,
}: DiscoverSearchHeaderProps) {
  const [sortOpen, setSortOpen] = React.useState(false)
  const sortRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const tabs: { mode: SearchMode; icon: React.ReactNode; label: string; count: string }[] = [
    { mode: 'blueprints', icon: <FileText size={14} />, label: 'Blueprints', count: counts.blueprints },
    { mode: 'stages', icon: <LayoutGrid size={14} />, label: 'Stages', count: counts.stages },
    { mode: 'blocks', icon: <Box size={14} />, label: 'Blocks', count: counts.blocks },
  ]

  return (
    <div className="w-full flex flex-col gap-0">

      {/* ROW 2 — Search mode tabs */}
      <div className="flex items-end gap-0" style={{ height: 40 }}>
        {tabs.map((tab) => {
          const isActive = activeMode === tab.mode
          return (
            <button
              key={tab.mode}
              onClick={() => onModeChange(tab.mode)}
              className="flex flex-col items-center"
              style={{
                padding: '8px 14px',
                paddingBottom: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderBottom: isActive ? '2px solid #E8571A' : '2px solid transparent',
              }}
            >
              <div
                className="flex items-center"
                style={{
                  gap: 6,
                  color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                  fontFamily: 'Figtree, sans-serif',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </div>
              <span
                style={{
                  fontFamily: 'Figtree, sans-serif',
                  fontSize: 10,
                  fontWeight: 400,
                  color: 'rgba(255,255,255,0.30)',
                  marginTop: 2,
                }}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ROW 3 — Search input + filters button */}
      <div className="flex items-center" style={{ height: 52, gap: 12, marginTop: 8 }}>
        <div
          className="flex items-center flex-1"
          style={{
            height: 44,
            background: 'rgba(30,30,40,0.50)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '0 14px',
            position: 'relative',
          }}
        >
          <Search size={16} style={{ color: 'rgba(255,255,255,0.40)', flexShrink: 0 }} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholders[activeMode]}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'Figtree, sans-serif',
              fontSize: 14,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.85)',
              marginLeft: 10,
            }}
            onFocus={(e) => {
              const parent = e.currentTarget.parentElement
              if (parent) parent.style.border = '0.5px solid rgba(232,87,26,0.40)'
            }}
            onBlur={(e) => {
              const parent = e.currentTarget.parentElement
              if (parent) parent.style.border = '0.5px solid rgba(255,255,255,0.08)'
            }}
          />
          <span
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: 10,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.30)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              padding: '1px 5px',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            ⌘K
          </span>
        </div>

        <button
          onClick={onOpenFilters}
          className="flex items-center"
          style={{
            height: 44,
            background: 'rgba(30,30,40,0.50)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '0 14px',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={14} style={{ color: 'rgba(255,255,255,0.75)' }} />
          <span
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.75)',
            }}
          >
            Filters
          </span>
          {activeFilters.length > 0 && (
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'rgba(232,87,26,0.20)',
                color: '#E8571A',
                fontFamily: 'Figtree, sans-serif',
                fontSize: 10,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeFilters.length}
            </span>
          )}
        </button>
      </div>

      {/* ROW 4 — Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center" style={{ gap: 8, marginTop: 12 }}>
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="flex items-center"
              style={{
                fontFamily: 'Figtree, sans-serif',
                fontSize: 11,
                fontWeight: 500,
                padding: '3px 8px',
                borderRadius: 100,
                background: 'rgba(232,87,26,0.10)',
                color: '#E8571A',
                border: '0.5px solid rgba(232,87,26,0.20)',
                gap: 4,
              }}
            >
              {filter.key}: {filter.label}
              <button
                onClick={() => onFilterRemove(filter.key)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={10} style={{ color: '#E8571A' }} />
              </button>
            </span>
          ))}
          {activeFilters.length >= 2 && (
            <button
              onClick={onClearFilters}
              style={{
                fontFamily: 'Figtree, sans-serif',
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.50)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* ROW 5 — Sort + result count */}
      <div className="flex items-center justify-between" style={{ height: 32, marginTop: 12 }}>
        <span
          style={{
            fontFamily: 'Figtree, sans-serif',
            fontSize: 12,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          {resultCount.toLocaleString()} results
        </span>

        <div ref={sortRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center"
            style={{
              fontFamily: 'Figtree, sans-serif',
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.75)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              gap: 4,
            }}
          >
            Sort: {sort}
            <ChevronDown size={12} />
          </button>

          {sortOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'rgba(16,16,24,0.96)',
                backdropFilter: 'blur(20px)',
                border: '0.5px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
                padding: '4px 0',
                minWidth: 160,
                zIndex: 50,
              }}
            >
              {sortOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    onSortChange(option)
                    setSortOpen(false)
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'Figtree, sans-serif',
                    fontSize: 12,
                    fontWeight: option === sort ? 600 : 400,
                    color: option === sort ? '#E8571A' : 'rgba(255,255,255,0.75)',
                    background: 'transparent',
                    border: 'none',
                    padding: '8px 14px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
