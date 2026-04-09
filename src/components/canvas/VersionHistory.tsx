import { useState, useEffect } from 'react';
import { supabase } from
  '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface Version {
  id: string;
  versionNumber: number;
  label: string;
  createdAt: string;
  snapshot: any;
}

interface VersionHistoryProps {
  open: boolean;
  onClose: () => void;
  contentId: string;
  currentVersion: number;
  onRestore: (snapshot: any) => void;
  onSaveVersion: (label?: string) => void;
}

export function VersionHistory({
  open, onClose, contentId,
  currentVersion, onRestore, onSaveVersion,
}: VersionHistoryProps) {
  const [versions, setVersions] =
    useState<Version[]>([]);
  const [selected, setSelected] =
    useState<Version | null>(null);
  const [saving, setSaving] = useState(false);
  const [labelInput, setLabelInput] = useState('');

  useEffect(() => {
    if (!open || !contentId) return;
    loadVersions();
  }, [open, contentId]);

  const loadVersions = async () => {
    const { data } = await supabase
      .from('canvas_versions')
      .select('*')
      .eq('content_id', contentId)
      .order('version_number', { ascending: false })
      .limit(30);
    if (data) {
      setVersions(data.map(v => ({
        id: v.id,
        versionNumber: v.version_number,
        label: v.label ?? `v${v.version_number}`,
        createdAt: v.created_at,
        snapshot: v.snapshot,
      })));
    }
  };

  const handleSaveNow = async () => {
    setSaving(true);
    await onSaveVersion(labelInput || undefined);
    setLabelInput('');
    await loadVersions();
    setSaving(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.50)',
          zIndex: 200,
        }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed',
        right: 0, top: 0, bottom: 0,
        width: 320,
        background: 'rgba(10,10,16,0.99)',
        borderLeft:
          '1px solid rgba(255,255,255,0.10)',
        zIndex: 201,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 20px 14px 20px',
          borderBottom:
            '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 14, fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
            fontFamily:
              "'Playfair Display', Georgia, serif",
          }}>
            Version History
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.40)',
            cursor: 'pointer', fontSize: 18,
          }}>×</button>
        </div>

        {/* Save snapshot */}
        <div style={{
          padding: '12px 16px',
          borderBottom:
            '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            display: 'flex', gap: 6,
          }}>
            <input
              value={labelInput}
              onChange={e =>
                setLabelInput(e.target.value)
              }
              placeholder={`v${currentVersion + 1}`}
              style={{
                flex: 1, padding: '6px 10px',
                background: 'rgba(255,255,255,0.05)',
                border:
                  '1px solid rgba(255,255,255,0.10)',
                borderRadius: 6, fontSize: 12,
                color: '#fff', outline: 'none',
                fontFamily: 'Inter, sans-serif',
              }}
            />
            <button
              onClick={handleSaveNow}
              disabled={saving}
              style={{
                padding: '6px 14px',
                background: '#E8571A',
                border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Version list */}
        <div style={{
          flex: 1, overflowY: 'auto',
        }}>
          {versions.length === 0 ? (
            <div style={{
              padding: '30px 20px',
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,255,0.25)',
            }}>
              No saved versions yet.
              Save a snapshot to begin.
            </div>
          ) : (
            versions.map(v => (
              <div
                key={v.id}
                onClick={() =>
                  setSelected(
                    selected?.id === v.id ? null : v
                  )
                }
                style={{
                  padding: '12px 16px',
                  borderBottom:
                    '1px solid rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  background:
                    selected?.id === v.id
                      ? 'rgba(232,87,26,0.08)'
                      : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: selected?.id === v.id
                      ? '#E8571A'
                      : 'rgba(255,255,255,0.75)',
                  }}>
                    {v.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.25)',
                  }}>
                    {formatDistanceToNow(
                      new Date(v.createdAt),
                      { addSuffix: true }
                    )}
                  </div>
                </div>

                <div style={{
                  fontSize: 11, marginTop: 2,
                  color: 'rgba(255,255,255,0.30)',
                }}>
                  {v.snapshot?.blocks?.length ?? 0}
                  {' '}blocks ·{' '}
                  {v.snapshot?.arrows?.length ?? 0}
                  {' '}arrows ·{' '}
                  {v.snapshot?.stages?.length ?? 0}
                  {' '}stages
                </div>

                {/* Restore button */}
                {selected?.id === v.id && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onRestore(v.snapshot);
                      onClose();
                    }}
                    style={{
                      marginTop: 8,
                      padding: '5px 14px',
                      background:
                        'rgba(232,87,26,0.15)',
                      border:
                        '1px solid rgba(232,87,26,0.35)',
                      borderRadius: 6,
                      color: '#E8571A',
                      fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    Restore this version
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
