import { useMemo, useState } from 'react';
import { Check, MessageSquareOff, Send } from 'lucide-react';

import {
  EmptyPanelState,
  PANEL_CARD_BACKGROUND,
  PANEL_DIVIDER,
  PANEL_INPUT_BACKGROUND,
  PANEL_INPUT_BORDER,
  PANEL_INPUT_RADIUS,
} from './toolPanelStyles';

type CommentFilter = 'all' | 'unresolved' | 'resolved';

interface CommentThread {
  id: string;
  author: string;
  timestamp: string;
  anchorKind: string;
  anchorLabel: string;
  anchorColor: string;
  body: string;
  replyCount: number;
  resolved: boolean;
}

interface CurrentUser {
  name: string;
  avatarUrl?: string;
}

interface CommentsToolProps {
  threads?: CommentThread[];
  filter?: CommentFilter;
  onFilterChange?: (filter: CommentFilter) => void;
  onThreadClick?: (id: string) => void;
  onResolve?: (id: string) => void;
  onSubmit?: (body: string) => void;
  currentUser?: CurrentUser;
}

const DEFAULT_THREADS: CommentThread[] = [
  {
    id: 'thread-1',
    author: 'Maya Chen',
    timestamp: '2m ago',
    anchorKind: 'Prompt',
    anchorLabel: 'SystemPrompt_v1',
    anchorColor: 'hsl(var(--secondary))',
    body: 'The framing is strong, but this prompt could use a clearer success criterion so reviewers know what the intended output should look like.',
    replyCount: 2,
    resolved: false,
  },
  {
    id: 'thread-2',
    author: 'Ravi Patel',
    timestamp: '18m ago',
    anchorKind: 'Stage',
    anchorLabel: 'Research pass',
    anchorColor: 'hsl(var(--primary))',
    body: 'Consider moving this note into the stage intro so the rationale is visible before the workflow branches.',
    replyCount: 0,
    resolved: false,
  },
  {
    id: 'thread-3',
    author: 'Noah Kim',
    timestamp: 'Yesterday',
    anchorKind: 'Block',
    anchorLabel: 'Results summary',
    anchorColor: 'hsl(262 83% 58%)',
    body: 'Resolved after tightening the final summary copy and reducing duplication across the stage.',
    replyCount: 1,
    resolved: true,
  },
];

const DEFAULT_CURRENT_USER: CurrentUser = {
  name: 'You',
};

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function Avatar({ name, avatarUrl }: CurrentUser) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
      }}
    />
  ) : (
    <div
      aria-hidden="true"
      style={{
        width: 20,
        height: 20,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'hsl(var(--foreground) / 0.08)',
        color: 'hsl(var(--foreground) / 0.72)',
        fontSize: 9,
        fontWeight: 600,
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export function CommentsTool({
  threads = DEFAULT_THREADS,
  filter,
  onFilterChange,
  onThreadClick,
  onResolve,
  onSubmit,
  currentUser = DEFAULT_CURRENT_USER,
}: CommentsToolProps) {
  const defaultFilter: CommentFilter = filter ?? 'all';
  const [internalFilter, setInternalFilter] = useState<CommentFilter>(defaultFilter);
  const [draft, setDraft] = useState('');

  const activeFilter = filter ?? internalFilter;
  const counts = useMemo(
    () => ({
      all: threads.length,
      unresolved: threads.filter((thread) => !thread.resolved).length,
      resolved: threads.filter((thread) => thread.resolved).length,
    }),
    [threads],
  );

  const visibleThreads = useMemo(() => {
    if (activeFilter === 'resolved') return threads.filter((thread) => thread.resolved);
    if (activeFilter === 'unresolved') return threads.filter((thread) => !thread.resolved);
    return threads;
  }, [activeFilter, threads]);

  const handleFilterChange = (nextFilter: CommentFilter) => {
    if (!filter) {
      setInternalFilter(nextFilter);
    }
    onFilterChange?.(nextFilter);
  };

  const handleSubmit = () => {
    const value = draft.trim();
    if (!value) return;
    onSubmit?.(value);
    if (!onSubmit) return;
    setDraft('');
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'transparent',
      }}
    >
      <div
        style={{
          height: 32,
          minHeight: 32,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '0.5px solid hsl(var(--foreground) / 0.08)',
          padding: 0,
        }}
      >
        {([
          ['all', `All · ${counts.all}`],
          ['unresolved', `Unresolved · ${counts.unresolved}`],
          ['resolved', `Resolved · ${counts.resolved}`],
        ] as const).map(([value, label]) => {
          const active = activeFilter === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => handleFilterChange(value)}
              style={{
                border: 'none',
                backgroundColor: active ? 'hsl(var(--foreground) / 0.06)' : 'transparent',
                color: active ? 'hsl(var(--foreground) / 0.92)' : 'hsl(var(--foreground) / 0.5)',
                fontSize: 10,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 8px 10px',
        }}
      >
        {visibleThreads.length === 0 ? (
          <EmptyPanelState
            icon={MessageSquareOff}
            title="No comments yet"
            description="Select text, a block, or a stage to add a comment."
          />
        ) : (
          visibleThreads.map((thread) => (
            <button
              key={thread.id}
              type="button"
              onClick={() => onThreadClick?.(thread.id)}
              style={{
                width: '100%',
                marginBottom: 6,
                padding: '8px 10px',
                borderRadius: 8,
                 border: PANEL_DIVIDER,
                 backgroundColor: PANEL_CARD_BACKGROUND,
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                }}
              >
                <Avatar name={thread.author} />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'hsl(var(--foreground) / 0.9)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {thread.author}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 400,
                      color: 'hsl(var(--foreground) / 0.35)',
                      flexShrink: 0,
                    }}
                  >
                    {thread.timestamp}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onResolve?.(thread.id);
                  }}
                  aria-label={thread.resolved ? 'Unresolve comment' : 'Resolve comment'}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `0.5px solid ${thread.resolved ? 'hsl(var(--primary) / 0.35)' : 'hsl(var(--foreground) / 0.18)'}`,
                    backgroundColor: thread.resolved ? 'hsl(var(--primary) / 0.18)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: thread.resolved ? 'hsl(var(--primary-foreground))' : 'transparent',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Check size={10} />
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onThreadClick?.(thread.id);
                  }}
                  style={{
                    maxWidth: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '1px 6px',
                    border: 'none',
                    borderRadius: 4,
                    backgroundColor: 'hsl(var(--foreground) / 0.03)',
                    color: 'hsl(var(--foreground) / 0.72)',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: thread.anchorColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    on {thread.anchorKind} '{thread.anchorLabel}'
                  </span>
                </button>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  color: 'hsl(var(--foreground) / 0.8)',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {thread.body}
              </p>

              <div
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'hsl(var(--foreground) / 0.45)',
                }}
              >
                {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
              </div>
            </button>
          ))
        )}
      </div>

      <div
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
           borderTop: PANEL_DIVIDER,
        }}
      >
        <Avatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} />
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Add a comment..."
          style={{
            flex: 1,
            minWidth: 0,
            height: 28,
            padding: '6px 8px',
             border: PANEL_INPUT_BORDER,
             borderRadius: PANEL_INPUT_RADIUS,
             backgroundColor: PANEL_INPUT_BACKGROUND,
            fontSize: 11,
            fontWeight: 400,
            color: 'hsl(var(--foreground) / 0.85)',
            outline: 'none',
            boxShadow: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          aria-label="Send comment"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
             border: '0.5px solid transparent',
            backgroundColor: 'transparent',
            color: draft.trim()
              ? 'hsl(var(--secondary))'
              : 'hsl(var(--foreground) / 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: draft.trim() ? 'pointer' : 'default',
          }}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
