import { type } from "@/lib/theme/type";

// /bounty/new — the standalone bounty form. RETIRED BY NS-P54.
//
// The route is still registered and this page still renders, wrapped in
// LegacyUploadRoute so the notice above it says where bounties live now. What
// stopped is the write: handleSubmit asks assertLegacyBountyCreateEnabled()
// before it touches anything, and while the flag is false that throws
// BOUNTY_RETIRED. The insert below is left whole and unreachable rather than
// deleted — deleting it is NS-P55's, and a gate that is one statement is a
// rollback that is one flag.
//
// Nothing is lost by freezing this one rather than letting it finish, the way
// /upload/blueprint is allowed to finish: every field on this form lives in
// React state for the length of one visit. There is no draft here to strand.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { WorksWithPicker } from '@/components/WorksWithPicker'
import { assertLegacyBountyCreateEnabled } from '@/lib/bounty-legacy/flags'

const BOUNTY_NEEDS = [
  { value: 'Prompt File', label: 'A Prompt',
    desc: 'A copyable prompt I can use directly',
    emoji: '💬' },
  { value: 'Agent Blueprint', label: 'An Agent',
    desc: 'A configured AI agent or assistant',
    emoji: '🤖' },
  { value: 'Workflow Template', label: 'A Workflow',
    desc: 'A step-by-step automation or process',
    emoji: '🔄' },
  { value: 'Evaluation Framework', label: 'A Technique',
    desc: 'A method or approach I can apply',
    emoji: '⚡' },
  { value: 'Integration Guide', label: 'A Setup Guide',
    desc: 'Instructions to configure a specific tool',
    emoji: '🔧' },
]

export default function BountyUpload() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [what, setWhat] = useState('')       // bounty_gap: what they need
  const [need, setNeed] = useState('')       // content_type: what type of solution
  const [context, setContext] = useState('') // description: what they're building
  const [criteria, setCriteria] = useState('') // what_to_expect: acceptance criteria
  const [amount, setAmount] = useState('')   // bounty_amount
  const [tools, setTools] = useState<string[]>([]) // ai_tools
  const [deadline, setDeadline] = useState(30) // bounty_deadline_days
  const [submitting, setSubmitting] = useState(false)
  const [retired, setRetired] = useState(false)

  const handleSubmit = async () => {
    if (!user) return

    // The gate, first, before any state is read and before any row is touched.
    // The thrown BOUNTY_RETIRED message is the machine-readable one; the panel
    // below says the same thing in the words this page needs.
    try {
      assertLegacyBountyCreateEnabled()
    } catch {
      setRetired(true)
      return
    }

    setSubmitting(true)

    const { data, error } = await supabase
      .from('content_items')
      .insert({
        creator_id: user.id,
        title: what,
        description: context,
        content_type: need || 'Prompt File',
        what_to_expect: criteria,
        ai_tools: tools,
        difficulty: 'Any',
        status: 'approved',
        approved_at: new Date().toISOString(),
        monetisation_type: 'free',
      })
      .select('id')
      .single()

    setSubmitting(false)
    if (!error && data) navigate(`/content/${data.id}`)
  }

  return (
    <div style={{ height: '100%', display: 'flex',
                  flexDirection: 'column', overflowY: 'auto' }}>
      <button className="ns-back-btn" onClick={() => navigate(-1)}>
        ← Back
      </button>

      <div style={{ padding: '20px 20px 0 20px' }}>

        {/* Header */}
        <div style={{
          ...type.cardTitle,
            color: '#fff',
          marginBottom: 4,
        }}>
          Post a Bounty
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.35)',
          marginBottom: 20,
        }}>
          Describe what you need. The community builds it.
          You pay when you accept a solution.
        </div>

        {/* STEP 1 — What do you need built? */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
              marginBottom: 4,
            }}>
              What do you need?
            </div>
            <textarea
              value={what}
              onChange={e => setWhat(e.target.value)}
              placeholder="e.g. I need a prompt that rewrites my emails in my tone of voice..."
              rows={4}
              style={{
                width: '100%', background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 14, color: '#fff', outline: 'none',
                resize: 'vertical', fontFamily: 'Figtree, sans-serif',
                lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />

            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
              marginBottom: 4, marginTop: 8,
            }}>
              What type of solution are you looking for?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BOUNTY_NEEDS.map(n => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNeed(n.value)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: need === n.value
                      ? 'rgba(245,158,11,0.12)'
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${need === n.value
                      ? 'rgba(245,158,11,0.40)'
                      : 'rgba(255,255,255,0.07)'}`,
                    textAlign: 'left', width: '100%',
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{n.emoji}</span>
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 600,
                      color: need === n.value ? '#F59E0B' : '#fff',
                    }}>{n.label}</div>
                    <div style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.35)',
                    }}>{n.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2 — Context + criteria */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
            }}>
              What are you building or trying to do?
            </div>
            <textarea
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="Give context. What tool are you using? What's the end goal? What have you tried?"
              rows={4}
              style={{
                width: '100%', background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 14, color: '#fff', outline: 'none',
                resize: 'vertical', fontFamily: 'Figtree, sans-serif',
                lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />

            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
            }}>
              How will you judge a winning solution?
            </div>
            <textarea
              value={criteria}
              onChange={e => setCriteria(e.target.value)}
              placeholder="e.g. It should work with Claude, handle 3 different tones, and produce output under 200 words..."
              rows={3}
              style={{
                width: '100%', background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '12px 14px',
                fontSize: 14, color: '#fff', outline: 'none',
                resize: 'vertical', fontFamily: 'Figtree, sans-serif',
                lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />

            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
            }}>
              Which AI tools are you working with?
            </div>
            <WorksWithPicker
              value={tools}
              onChange={setTools}
            />
          </div>
        )}

        {/* STEP 3 — Reward */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
            }}>
              Bounty reward (£)
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 16, color: '#F59E0B', fontWeight: 700,
              }}>£</span>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="50"
                min="5"
                style={{
                  width: '100%', background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(245,158,11,0.30)',
                  borderRadius: 10, padding: '14px 14px 14px 32px',
                  fontSize: 22, fontWeight: 700, color: '#F59E0B',
                  outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'Figtree, sans-serif',
                }}
              />
            </div>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.30)',
            }}>
              You only pay when you accept a solution.
            </div>

            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.10em', color: 'rgba(255,255,255,0.30)',
              marginTop: 8,
            }}>
              Deadline
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 14, 30, 60, 0].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDeadline(d)}
                  style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: deadline === d
                      ? 'rgba(245,158,11,0.15)'
                      : 'rgba(255, 255, 255, 0.12)',
                    border: `1px solid ${deadline === d
                      ? 'rgba(245,158,11,0.40)'
                      : 'rgba(255,255,255,0.08)'}`,
                    color: deadline === d
                      ? '#F59E0B'
                      : 'rgba(255,255,255,0.50)',
                    transition: 'all 0.15s',
                  }}
                >
                  {d === 0 ? 'Open' : `${d}d`}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
              {deadline === 0
                ? 'No deadline — stays open until you close it'
                : `Closes in ${deadline} days`}
            </div>
          </div>
        )}

      </div>

      {/* Sticky bottom nav */}
      <div style={{
        position: 'sticky', bottom: 0, marginTop: 'auto',
        background: 'rgba(8,8,12,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.14)',
        padding: '12px 20px 16px 20px',
      }}>
        {/* Step dots */}
        <div style={{
          display: 'flex', justifyContent: 'center',
          gap: 6, marginBottom: 12,
        }}>
          {[1,2,3].map(s => (
            <div key={s} style={{
              width: s === step ? 20 : 6, height: 6,
              borderRadius: 3,
              background: s === step
                ? '#F59E0B'
                : s < step
                  ? 'rgba(245,158,11,0.40)'
                  : 'rgba(255,255,255,0.10)',
              transition: 'all 0.2s',
            }} />
          ))}
        </div>

        {/* NS-P54. The notice at the top of the route already says where
            bounties live now, but this form scrolls and the button is sticky,
            so by step 3 that notice is usually off screen. Its own words, not a
            repeat of the notice's. Shown only after a submit is attempted —
            nothing is offered that then fails silently. */}
        {retired && (
          <div
            data-visual-slot="legacy-bounty-retired"
            data-testid="legacy-bounty-retired"
            style={{
              marginBottom: 10,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(232,87,26,0.06)',
              border: '1px solid rgba(232,87,26,0.22)',
              fontSize: 12,
              fontWeight: 300,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.60)',
            }}
          >
            This form no longer posts bounties.{' '}
            <Link to="/compose/new" style={{ color: '#E8571A', fontWeight: 500 }}>
              Open the build workspace →
            </Link>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              style={{
                padding: '10px 18px', borderRadius: 9999,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.65)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Figtree',
              }}
            >
              ← Back
            </button>
          )}
          <button
            type="button"
            onClick={step < 3
              ? () => setStep(s => s + 1)
              : handleSubmit}
            disabled={
              (step === 1 && (!what.trim() || !need)) ||
              (step === 2 && !context.trim()) ||
              (step === 3 && !amount) ||
              submitting
            }
            style={{
              flex: 1, padding: '10px 0', borderRadius: 9999,
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Figtree', opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Posting...'
              : step < 3 ? 'Continue →'
              : 'Post Bounty 🎯'}
          </button>
        </div>
      </div>
    </div>
  )
}
