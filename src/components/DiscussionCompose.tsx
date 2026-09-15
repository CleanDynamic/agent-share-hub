import { type } from "@/lib/theme/type";
import { feedback } from "@/lib/theme/motion";

interface DiscussionComposeProps {
  form: any;
  threads: string[];
  setThreads: (t: string[]) => void;
  onPost: () => void;
  submitting: boolean;
}

export function DiscussionCompose({
  form, threads, setThreads, onPost, submitting
}: DiscussionComposeProps) {
  const charLimit = 500;
  const mainText = form.watch('description') ?? '';
  const charsLeft = charLimit - mainText.length;
  const isOverLimit = charsLeft < 0;

  // Auto-resize textarea
  const adjustHeight = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 300) + 'px';
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', padding: '16px 20px',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 18, lineHeight: 1,
        }}>💬</span>
        <span style={{
          color: 'var(--text2)',
          ...type.cardTitle,
        }}>
          Start a Discussion
        </span>
      </div>

      {/* Main thread compose */}
      <div style={{
        flex: 1, overflowY: 'auto',
      }}>
        {/* First tweet — main post */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 4,
        }}>
          {/* Avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--cat-data) 20%, transparent)',
            border: '1px solid color-mix(in srgb, var(--cat-data) 35%, transparent)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            fontSize: 13, fontWeight: 700,
            color: 'var(--cat-data)',
          }}>
            ST
          </div>

          {/* Text area */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <textarea
              {...form.register('description')}
              placeholder="What's on your mind? Share a question, challenge, or thought..."
              onChange={e => {
                form.setValue('description', e.target.value);
                adjustHeight(e.target);
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',

                color: 'var(--text)',

                resize: 'none',
                ...type.cardTitle,
                minHeight: 80,
                overflow: 'hidden',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Thread line + replies */}
        {threads.map((thread, i) => (
          <div key={i} style={{
            display: 'flex', gap: 12, marginTop: 0,
          }}>
            {/* Thread connector */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', width: 36, flexShrink: 0,
            }}>
              <div style={{
                width: 2, flex: 1, minHeight: 16,
                background: 'color-mix(in srgb, var(--cat-data) 20%, transparent)',
              }} />
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--recess)',
                border: '1px solid var(--line)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
                fontSize: 13, fontWeight: 700,
                color: 'var(--text2)',
                marginTop: 4,
              }}>
                ST
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: 20 }}>
              <textarea
                value={thread}
                onChange={e => {
                  const next = [...threads];
                  next[i] = e.target.value;
                  setThreads(next);
                  adjustHeight(e.target);
                }}
                placeholder="Add to your thread..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none', outline: 'none',
                  fontSize: 14,
                  color: 'var(--text)',
                  lineHeight: 1.65, resize: 'none',
                  fontFamily: 'Figtree, sans-serif',
                  minHeight: 60, overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              />
              {thread && (
                <button
                  type="button"
                  onClick={() => setThreads(threads.filter((_,j) => j !== i))}
                  style={{
                    fontSize: 11, color: 'var(--text2)',
                    background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0,
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Add to thread button */}
        <div style={{
          display: 'flex', gap: 12, marginTop: 8,
          paddingLeft: 0,
        }}>
          <div style={{ width: 36, flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center' }}>
            <div style={{
              width: 2, height: 16,
              background: 'color-mix(in srgb, var(--cat-data) 20%, transparent)',
            }} />
          </div>
          <button
            type="button"
            onClick={() => setThreads([...threads, ''])}
            style={{
              fontSize: 13, color: 'color-mix(in srgb, var(--cat-data) 60%, transparent)',
              background: 'none', border: 'none',
              cursor: 'pointer', padding: '4px 0',
              fontFamily: 'Figtree',
            }}
          >
            + Add to thread
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: '1px solid var(--line)',
        paddingTop: 12, marginTop: 12,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Char counter */}
        <div style={{
          fontSize: 12,
          /* The counter warns in breakage red, leans on --text at the elbow,
             and is otherwise ordinary secondary type. Amber stood at the
             middle step and cannot: it is 3.01:1 on the Exhibition ground and
             the theme forbids it as type outright. */
          color: isOverLimit
            ? 'var(--cat-breakage)'
            : charsLeft < 50
              ? 'var(--text)'
              : 'var(--text2)',
        }}>
          {charsLeft}
        </div>

        {/* Post button */}
        <button
          type="button"
          onClick={onPost}
          disabled={!mainText.trim() || isOverLimit || submitting}
          style={{
            padding: '8px 22px', borderRadius: 'var(--r-control)',
            background: mainText.trim() && !isOverLimit
              ? 'var(--cat-data)' : 'color-mix(in srgb, var(--cat-data) 25%, transparent)',
            border: 'none', color: 'var(--text)',
            fontSize: 13, fontWeight: 700,
            cursor: mainText.trim() && !isOverLimit
              ? 'pointer' : 'default',
            fontFamily: 'Figtree',
            transition: feedback("background-color"),
          }}
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}
