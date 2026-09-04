import { type } from "@/lib/theme/type";

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
          color: 'rgba(255,255,255,0.70)',
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
            background: 'rgba(59,130,246,0.20)',
            border: '1px solid rgba(59,130,246,0.35)',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
            fontSize: 13, fontWeight: 700,
            color: '#3B82F6',
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

                color: 'rgba(255,255,255,0.88)',

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
                background: 'rgba(59,130,246,0.20)',
              }} />
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
                fontSize: 13, fontWeight: 700,
                color: 'rgba(255,255,255,0.30)',
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
                  color: 'rgba(255,255,255,0.75)',
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
                    fontSize: 11, color: 'rgba(255,255,255,0.25)',
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
              background: 'rgba(59,130,246,0.20)',
            }} />
          </div>
          <button
            type="button"
            onClick={() => setThreads([...threads, ''])}
            style={{
              fontSize: 13, color: 'rgba(59,130,246,0.60)',
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
        borderTop: '1px solid rgba(255, 255, 255, 0.14)',
        paddingTop: 12, marginTop: 12,
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Char counter */}
        <div style={{
          fontSize: 12,
          color: isOverLimit
            ? '#EF4444'
            : charsLeft < 50
              ? '#F59E0B'
              : 'rgba(255,255,255,0.25)',
        }}>
          {charsLeft}
        </div>

        {/* Post button */}
        <button
          type="button"
          onClick={onPost}
          disabled={!mainText.trim() || isOverLimit || submitting}
          style={{
            padding: '8px 22px', borderRadius: 9999,
            background: mainText.trim() && !isOverLimit
              ? '#3B82F6' : 'rgba(59,130,246,0.25)',
            border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: mainText.trim() && !isOverLimit
              ? 'pointer' : 'default',
            fontFamily: 'Figtree',
            transition: 'background 0.15s',
          }}
        >
          {submitting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}
