import * as React from 'react'
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react'
import type { SearchMode } from './DiscoverSearchHeader'

export interface FilterValue {
  postTypes: string[]
  blockTypes: string[]
  models: string[]
  tools: string[]
  domain: string | null
  tags: string[]
  difficulty: string | null
  length: string | null
  bountyStatus: string | null
  timeRange: string | null
  // Competitions (Phase 3) — only meaningful when the Competitions chip is on.
  competitionsOnly: boolean
  bountyRewardType: string | null
  bountyHasUnsolvedSlots: string | null
  bountyHealthScore: string | null
}

export interface DiscoverFilterSheetProps {
  isOpen: boolean
  onClose: () => void
  activeMode: SearchMode
  value: FilterValue
  onChange: (value: FilterValue) => void
  resultCountPreview: number
  onApply: () => void
  onReset: () => void
  modelOptions: string[]
  toolOptions: string[]
  tagSuggestions: string[]
}

const blockTypes = [
  { name: 'Text', color: '#8B8B8B' },
  { name: 'Heading', color: '#A78BFA' },
  { name: 'Prompt', color: '#F59E0B' },
  { name: 'Code', color: '#10B981' },
  { name: 'Result', color: '#3B82F6' },
  { name: 'Image', color: '#EC4899' },
  { name: 'Video', color: '#EF4444' },
  { name: 'Agent', color: '#8B5CF6' },
  { name: 'Workflow', color: '#F97316' },
  { name: 'Compare', color: '#14B8A6' },
  { name: 'Tool', color: '#6366F1' },
  { name: 'Model', color: '#22D3EE' },
  { name: 'Tutorial', color: '#84CC16' },
  { name: 'Resource', color: '#FB923C' },
  { name: 'Note', color: '#FBBF24' },
  { name: 'Quote', color: '#A3A3A3' },
]

const postTypes = ['Blueprint', 'Blog', 'Bounty']
const domains = ['Academic', 'Finance', 'Marketing', 'Engineering', 'Creative', 'Productivity', 'Research', 'Other']
const difficulties = ['Beginner', 'Intermediate', 'Advanced']
const lengths = ['Quick (<5 min)', 'Medium (5–15 min)', 'Deep (>15 min)', 'Any']
const bountyStatuses = ['Open', 'Closed', 'Solved', 'Partially-solved']
const bountyRewardTypes = ['Cash', 'Token', 'Kudos', 'None']
const bountyHasUnsolvedSlotsOptions = ['Yes', 'No']
const bountyHealthScores = ['High', 'Medium', 'Low']
const timeRanges = ['Past 24h', 'Past week', 'Past month', 'Past 3 months', 'All time']

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.40)',
      }}
    >
      {children}
    </span>
  )
}

function Chip({
  selected,
  onClick,
  children,
  dot,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  dot?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center"
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        fontWeight: 500,
        padding: '3px 8px',
        borderRadius: 100,
        background: selected ? 'rgba(232,87,26,0.10)' : 'rgba(255,255,255,0.03)',
        color: selected ? '#E8571A' : 'rgba(255,255,255,0.65)',
        border: selected ? '0.5px solid rgba(232,87,26,0.40)' : '0.5px solid rgba(255, 255, 255, 0.14)',
        cursor: 'pointer',
        gap: 5,
        transition: 'all 0.15s',
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </button>
  )
}

function TagInput({
  tags,
  onChange,
  suggestions,
  maxTags = 6,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions: string[]
  maxTags?: number
}) {
  const [inputValue, setInputValue] = React.useState('')
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s)
  )

  const addTag = (tag: string) => {
    if (tags.length < maxTags && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInputValue('')
    setShowSuggestions(false)
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="flex flex-wrap items-center"
        style={{
          gap: 6,
          padding: '8px 10px',
          background: 'rgba(30,30,40,0.50)',
          border: '0.5px solid rgba(255,255,255,0.08)',
          borderRadius: 8,
          minHeight: 40,
        }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'rgba(232,87,26,0.10)',
              color: '#E8571A',
              border: '0.5px solid rgba(232,87,26,0.20)',
              gap: 4,
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
            >
              <X size={10} style={{ color: '#E8571A' }} />
            </button>
          </span>
        ))}
        {tags.length < maxTags && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue.trim()) {
                addTag(inputValue.trim())
              }
            }}
            placeholder={tags.length === 0 ? 'Add tags...' : ''}
            style={{
              flex: 1,
              minWidth: 80,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
            }}
          />
        )}
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'rgba(16,16,24,0.98)',
            border: '0.5px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: '4px 0',
            maxHeight: 160,
            overflowY: 'auto',
            zIndex: 10,
          }}
        >
          {filteredSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                color: 'rgba(255,255,255,0.75)',
                background: 'transparent',
                border: 'none',
                padding: '8px 12px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ExpandableChipList({
  options,
  selected,
  onChange,
  initialShow = 8,
}: {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  initialShow?: number
}) {
  const [expanded, setExpanded] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')

  const toggleItem = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter((s) => s !== item))
    } else {
      onChange([...selected, item])
    }
  }

  const visibleOptions = expanded
    ? options.filter((o) => o.toLowerCase().includes(searchValue.toLowerCase()))
    : options.slice(0, initialShow)

  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {expanded && (
        <div
          className="flex items-center"
          style={{
            padding: '6px 10px',
            background: 'rgba(30,30,40,0.50)',
            border: '0.5px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            gap: 8,
          }}
        >
          <Search size={12} style={{ color: 'rgba(255,255,255,0.40)' }} />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              color: 'rgba(255,255,255,0.85)',
            }}
          />
        </div>
      )}
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {visibleOptions.map((option) => (
          <Chip key={option} selected={selected.includes(option)} onClick={() => toggleItem(option)}>
            {option}
          </Chip>
        ))}
        {!expanded && options.length > initialShow && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.50)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              gap: 2,
            }}
          >
            + {options.length - initialShow} More
            <ChevronDown size={10} />
          </button>
        )}
        {expanded && (
          <button
            onClick={() => {
              setExpanded(false)
              setSearchValue('')
            }}
            className="flex items-center"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.50)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              gap: 2,
            }}
          >
            Show less
            <ChevronUp size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

export function DiscoverFilterSheet({
  isOpen,
  onClose,
  activeMode,
  value,
  onChange,
  resultCountPreview,
  onApply,
  onReset,
  modelOptions,
  toolOptions,
  tagSuggestions,
}: DiscoverFilterSheetProps) {
  const updateValue = <K extends keyof FilterValue>(key: K, newValue: FilterValue[K]) => {
    onChange({ ...value, [key]: newValue })
  }

  const toggleArrayItem = (key: 'postTypes' | 'blockTypes' | 'models' | 'tools', item: string) => {
    const arr = value[key]
    if (arr.includes(item)) {
      updateValue(key, arr.filter((i) => i !== item))
    } else {
      updateValue(key, [...arr, item])
    }
  }

  const toggleSingleSelect = (
    key:
      | 'domain'
      | 'difficulty'
      | 'length'
      | 'bountyStatus'
      | 'timeRange'
      | 'bountyRewardType'
      | 'bountyHasUnsolvedSlots'
      | 'bountyHealthScore',
    item: string,
  ) => {
    updateValue(key, value[key] === item ? null : item)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.50)',
          zIndex: 40,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          maxWidth: '100vw',
          background: 'rgba(16,16,24,0.96)',
          backdropFilter: 'blur(20px)',
          borderLeft: '0.5px solid rgba(255,255,255,0.10)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{
            height: 52,
            padding: '0 20px',
            borderBottom: '0.5px solid rgba(255,255,255,0.10)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            Filters
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
            }}
          >
            <X size={16} style={{ color: 'rgba(255,255,255,0.45)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
          <div className="flex flex-col" style={{ gap: 24 }}>
            {/* Competitions toggle (Phase 3) */}
            {activeMode === 'blueprints' && (
              <div className="flex flex-col" style={{ gap: 8 }}>
                <SectionLabel>Competitions</SectionLabel>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  <Chip
                    selected={value.competitionsOnly}
                    onClick={() => updateValue('competitionsOnly', !value.competitionsOnly)}
                  >
                    🏆 Bounties only
                  </Chip>
                </div>
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.35)',
                    marginTop: 2,
                  }}
                >
                  Filter results to bounties with bounty-specific sub-filters
                </span>
              </div>
            )}

            {/* Post type — hidden while Competitions filter is on */}
            {activeMode === 'blueprints' && !value.competitionsOnly && (
              <div className="flex flex-col" style={{ gap: 8 }}>
                <SectionLabel>Post type</SectionLabel>
                <div className="flex flex-wrap" style={{ gap: 6 }}>
                  {postTypes.map((type) => (
                    <Chip
                      key={type}
                      selected={value.postTypes.includes(type)}
                      onClick={() => toggleArrayItem('postTypes', type)}
                    >
                      {type}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            {/* Block types used */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Block types used</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {blockTypes.map((bt) => (
                  <Chip
                    key={bt.name}
                    selected={value.blockTypes.includes(bt.name)}
                    onClick={() => toggleArrayItem('blockTypes', bt.name)}
                    dot={bt.color}
                  >
                    {bt.name}
                  </Chip>
                ))}
              </div>
              <span
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: 2,
                }}
              >
                Filter to content using these block types
              </span>
            </div>

            {/* Models referenced */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Models referenced</SectionLabel>
              <ExpandableChipList
                options={modelOptions}
                selected={value.models}
                onChange={(selected) => updateValue('models', selected)}
              />
            </div>

            {/* Tools / platforms */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Tools / platforms</SectionLabel>
              <ExpandableChipList
                options={toolOptions}
                selected={value.tools}
                onChange={(selected) => updateValue('tools', selected)}
              />
            </div>

            {/* Domain */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Domain</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {domains.map((domain) => (
                  <Chip
                    key={domain}
                    selected={value.domain === domain}
                    onClick={() => toggleSingleSelect('domain', domain)}
                  >
                    {domain}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Tags</SectionLabel>
              <TagInput
                tags={value.tags}
                onChange={(tags) => updateValue('tags', tags)}
                suggestions={tagSuggestions}
              />
            </div>

            {/* Difficulty */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Difficulty</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {difficulties.map((diff) => (
                  <Chip
                    key={diff}
                    selected={value.difficulty === diff}
                    onClick={() => toggleSingleSelect('difficulty', diff)}
                  >
                    {diff}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Length */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Length</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {lengths.map((len) => (
                  <Chip
                    key={len}
                    selected={value.length === len}
                    onClick={() => toggleSingleSelect('length', len)}
                  >
                    {len}
                  </Chip>
                ))}
              </div>
            </div>

            {/* Bounty sub-filters — visible when Competitions is on or Bounty post-type is selected */}
            {(value.competitionsOnly || value.postTypes.includes('Bounty')) && (
              <>
                <div className="flex flex-col" style={{ gap: 8 }}>
                  <SectionLabel>Bounty status</SectionLabel>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {bountyStatuses.map((status) => (
                      <Chip
                        key={status}
                        selected={value.bountyStatus === status}
                        onClick={() => toggleSingleSelect('bountyStatus', status)}
                      >
                        {status}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: 8 }}>
                  <SectionLabel>Reward type</SectionLabel>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {bountyRewardTypes.map((rt) => (
                      <Chip
                        key={rt}
                        selected={value.bountyRewardType === rt}
                        onClick={() => toggleSingleSelect('bountyRewardType', rt)}
                      >
                        {rt}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: 8 }}>
                  <SectionLabel>Has unsolved slots</SectionLabel>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {bountyHasUnsolvedSlotsOptions.map((opt) => (
                      <Chip
                        key={opt}
                        selected={value.bountyHasUnsolvedSlots === opt}
                        onClick={() => toggleSingleSelect('bountyHasUnsolvedSlots', opt)}
                      >
                        {opt}
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: 8 }}>
                  <SectionLabel>Bounty health score</SectionLabel>
                  <div className="flex flex-wrap" style={{ gap: 6 }}>
                    {bountyHealthScores.map((h) => (
                      <Chip
                        key={h}
                        selected={value.bountyHealthScore === h}
                        onClick={() => toggleSingleSelect('bountyHealthScore', h)}
                      >
                        {h}
                      </Chip>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Time range */}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <SectionLabel>Time range</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {timeRanges.map((range) => (
                  <Chip
                    key={range}
                    selected={value.timeRange === range}
                    onClick={() => toggleSingleSelect('timeRange', range)}
                  >
                    {range}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{
            height: 60,
            padding: '0 20px',
            borderTop: '0.5px solid rgba(255,255,255,0.10)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onReset}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.60)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255,255,255,0.60)')}
          >
            Reset
          </button>
          <button
            onClick={onApply}
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              color: 'white',
              padding: '0 18px',
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'linear-gradient(135deg, #E8571A 0%, #D4470F 100%)',
              cursor: 'pointer',
            }}
          >
            Apply ({resultCountPreview.toLocaleString()} results)
          </button>
        </div>
      </div>
    </>
  )
}
