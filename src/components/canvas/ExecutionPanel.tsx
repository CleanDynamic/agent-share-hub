import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { type } from "@/lib/theme/type";

interface ExecutionPanelProps {
  block: any; // CanvasBlock or BlockRow
  onAcceptResult: (result: string) => void;
  onClose: () => void;
  mode: 'edit' | 'view';
}

const MODELS = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet',
    provider: 'anthropic',
  },
  {
    id: 'gpt-4o', label: 'GPT-4o',
    provider: 'openai',
  },
  {
    id: 'gpt-4o-mini', label: 'GPT-4o Mini',
    provider: 'openai',
  },
  {
    id: 'gemini-2.0-flash', label: 'Gemini Flash',
    provider: 'google',
  },
];

export function ExecutionPanel({
  block, onAcceptResult, onClose, mode,
}: ExecutionPanelProps) {
  const { user } = useAuth();
  const [selectedModel, setSelectedModel] =
    useState(MODELS[0]);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(
    null
  );
  const [tokenCount, setTokenCount] =
    useState<number | null>(null);
  const [latency, setLatency] =
    useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(
    null
  );

  const promptText = (block.textContent
    || block.text_content) ?? '';

  const handleRun = async () => {
    if (!promptText.trim()) return;
    setRunning(true);
    setOutput('');
    setError(null);
    setTokenCount(null);
    setLatency(null);

    const start = Date.now();
    abortRef.current = new AbortController();

    try {
      // Use the Anthropic API via the existing
      // fetch setup (API key handled server-side
      // via Supabase edge function or proxy)
      const response = await fetch(
        '/api/execute-block',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: promptText,
            model: selectedModel.id,
            userId: user?.id,
          }),
          signal: abortRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error(
          `API error: ${response.status}`
        );
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } =
            await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullText += chunk;
          setOutput(fullText);
        }
      }

      setLatency(Date.now() - start);
      // Approximate token count
      setTokenCount(
        Math.round(
          (promptText.length + fullText.length) / 4
        )
      );
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message ?? 'Execution failed');
      }
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  return (
    <div style={{
      position: 'fixed',
      right: 0, top: 0, bottom: 0,
      width: 380,
      background: 'rgba(10,10,16,0.99)',
      borderLeft:
        '1px solid rgba(255,255,255,0.10)',
      zIndex: 300,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.40)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px 16px',
        borderBottom:
          '1px solid rgba(255, 255, 255, 0.14)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: 13, fontWeight: 700,
            color: 'rgba(255,255,255,0.85)',
          }}>
            Run Block
          </div>
          <div style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.30)',
            marginTop: 2,
          }}>
            Test this block live
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none',
          color: 'rgba(255,255,255,0.40)',
          cursor: 'pointer', fontSize: 18,
        }}>×</button>
      </div>

      {/* Model selector */}
      <div style={{
        padding: '10px 16px',
        borderBottom:
          '1px solid rgba(255, 255, 255, 0.14)',
        display: 'flex', gap: 6, flexWrap: 'wrap',
      }}>
        {MODELS.map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedModel(m)}
            style={{
              padding: '4px 10px', borderRadius: 6,
              fontSize: 11, cursor: 'pointer',
              background:
                selectedModel.id === m.id
                  ? 'rgba(139,69,19,0.15)'
                  : 'rgba(255, 255, 255, 0.12)',
              border: `1px solid ${
                selectedModel.id === m.id
                  ? 'rgba(139,69,19,0.35)'
                  : 'rgba(255,255,255,0.08)'
              }`,
              color: selectedModel.id === m.id
                ? '#8B4513'
                : 'rgba(255,255,255,0.45)',
              fontWeight:
                selectedModel.id === m.id ? 700 : 400,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Prompt preview */}
      <div style={{
        padding: '12px 16px',
        borderBottom:
          '1px solid rgba(255,255,255,0.05)',
        maxHeight: 140, overflowY: 'auto',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.10em',
          color: 'rgba(255,255,255,0.25)',
          marginBottom: 6,
        }}>
          Prompt
        </div>
        <pre style={{
          color: 'rgba(255,255,255,0.55)',
          whiteSpace: 'pre-wrap',
          margin: 0,
          ...type.data,
        }}>
          {promptText.substring(0, 300)}
          {promptText.length > 300 ? '\u2026' : ''}
        </pre>
      </div>

      {/* Output area */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 16px',
        position: 'relative',
      }}>
        {!output && !error && !running && (
          <div style={{
            color: 'rgba(255,255,255,0.20)',
            fontSize: 13, textAlign: 'center',
            marginTop: 40,
            fontStyle: 'italic',
          }}>
            Press Run to execute
          </div>
        )}

        {error && (
          <div style={{
            color: '#ef4444', fontSize: 12,
            lineHeight: 1.6,
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.20)',
            borderRadius: 6, padding: '10px 12px',
          }}>
            {error}
          </div>
        )}

        {output && (
          <div>
            <div style={{
              fontSize: 9, fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.10em',
              color: 'rgba(34,197,94,0.70)',
              marginBottom: 8,
            }}>
              Output
            </div>
            <pre style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.70,
              whiteSpace: 'pre-wrap',
              margin: 0,
              fontFamily: 'Figtree, sans-serif',
            }}>
              {output}
            </pre>
            {!running && latency && (
              <div style={{
                marginTop: 10, fontSize: 10,
                color: 'rgba(255,255,255,0.25)',
                display: 'flex', gap: 12,
              }}>
                <span>{latency}ms</span>
                {tokenCount && (
                  <span>~{tokenCount} tokens</span>
                )}
                <span>{selectedModel.label}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{
        padding: '12px 16px',
        borderTop:
          '1px solid rgba(255, 255, 255, 0.14)',
        display: 'flex', gap: 8,
      }}>
        {running ? (
          <button
            onClick={handleStop}
            style={{
              flex: 1, padding: '9px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.30)',
              borderRadius: 8, color: '#ef4444',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            disabled={!promptText.trim()}
            style={{
              flex: 1, padding: '9px',
              background: '#22C55E',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
              opacity: promptText.trim() ? 1 : 0.5,
            }}
          >
            Run
          </button>
        )}
        {output && !running && mode === 'edit' && (
          <button
            onClick={() => onAcceptResult(output)}
            style={{
              padding: '9px 16px',
              background: 'rgba(34,197,94,0.12)',
              border:
                '1px solid rgba(34,197,94,0.30)',
              borderRadius: 8, color: '#22C55E',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Accept as Result block
          </button>
        )}
      </div>
    </div>
  );
}
