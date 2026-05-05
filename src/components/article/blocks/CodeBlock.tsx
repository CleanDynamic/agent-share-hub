import * as React from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Play,
  MoreHorizontal,
  ArrowUpRight,
  ChevronDown,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import Editor, { loader } from '@monaco-editor/react';

import { cn } from '@/lib/utils';
import { useDocumentStore } from '@/lib/documentStore';
import { eventBus } from '@/lib/eventBus';
import {
  detectLanguage,
  SUPPORTED_LANGUAGES,
  type CodeLanguage,
} from '@/lib/detectLanguage';
import { runCode, isRunnable } from '@/lib/codeRunner';
import {
  describeVariables,
  extractVariables,
  indexBlocksByName,
  isNameUnique,
} from '@/lib/variables';
import { VariableChips } from '@/components/article/blocks/shared/VariableChips';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type BlockStatus = 'idle' | 'running' | 'success' | 'error';

interface CodeBlockData {
  blockId: string;
  label?: string;
  [key: string]: unknown;
}

const TYPE_COLOR = '#22C55E';

const PORT_STYLE: React.CSSProperties = {
  width: 8,
  height: 8,
  background: '#2EC4B6',
  border: '2px solid white',
  opacity: 0,
  transition: 'opacity 150ms ease',
};

// Define a transparent Monaco theme once globally.
let monacoThemeRegistered = false;
function ensureMonacoTheme() {
  if (monacoThemeRegistered) return;
  monacoThemeRegistered = true;
  loader.init().then((monaco) => {
    monaco.editor.defineTheme('lovable-transparent', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#00000000',
        'editor.lineHighlightBackground': '#ffffff08',
        'editorGutter.background': '#00000000',
        'editorLineNumber.foreground': '#ffffff40',
        'editorLineNumber.activeForeground': '#ffffff80',
      },
    });
  });
}

function StatusDot({ status }: { status: BlockStatus }) {
  if (status === 'running') {
    return (
      <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
    );
  }
  if (status === 'success') {
    return (
      <span className="inline-flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white">
        <Check size={8} strokeWidth={3} />
      </span>
    );
  }
  if (status === 'error') {
    return <span className="inline-block w-2 h-2 rounded-full bg-red-500" />;
  }
  return <span className="inline-block w-2 h-2 rounded-full bg-white/25" />;
}

export function CodeBlockNode({ id, data, selected }: NodeProps) {
  const blockId = (data as CodeBlockData).blockId ?? id;

  const block = useDocumentStore((s) => s.blocks[blockId]);
  const allBlocks = useDocumentStore((s) => s.blocks);
  const updateBlock = useDocumentStore((s) => s.updateBlock);
  const setSelection = useDocumentStore((s) => s.setSelection);
  const expandedSelection = useDocumentStore(
    (s) => s.selection.kind === 'block' && s.selection.ids[0] === blockId,
  );

  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [showLangDropdown, setShowLangDropdown] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [status, setStatus] = React.useState<BlockStatus>('idle');
  const [nameError, setNameError] = React.useState<string | null>(null);

  React.useEffect(() => {
    ensureMonacoTheme();
  }, []);

  const props = (block?.properties ?? {}) as Record<string, unknown>;
  const name = block?.name ?? '';
  const code = (props.code as string) ?? '';
  const manualLanguage = props.language as CodeLanguage | undefined;
  const output = (props.output as string) ?? '';
  const lastRun = props.lastRun as
    | { stdout?: string; stderr?: string; error?: string; timestamp?: string }
    | undefined;

  const language: CodeLanguage = manualLanguage ?? detectLanguage(code);
  const languageLabel =
    SUPPORTED_LANGUAGES.find((l) => l.value === language)?.label ?? language;

  const patchProps = React.useCallback(
    (patch: Record<string, unknown>) => {
      if (!block) return;
      updateBlock(blockId, {
        properties: { ...(block.properties ?? {}), ...patch },
      });
    },
    [block, blockId, updateBlock],
  );

  const onCodeChange = (v: string | undefined) => patchProps({ code: v ?? '' });
  const onLanguageChange = (v: CodeLanguage) => patchProps({ language: v });
  const onNameChange = (v: string) => {
    if (!isNameUnique(v, blockId, allBlocks)) {
      setNameError(`Name "${v.trim()}" is already used by another block.`);
      return;
    }
    setNameError(null);
    updateBlock(blockId, { name: v });
  };

  const selectThis = React.useCallback(() => {
    setSelection({ kind: 'block', ids: [blockId] });
  }, [blockId, setSelection]);

  const inputs = React.useMemo(() => extractVariables(code), [code]);

  const blocksByName = React.useMemo(
    () => indexBlocksByName(allBlocks),
    [allBlocks],
  );

  const inputInfos = React.useMemo(
    () => describeVariables(inputs, blocksByName),
    [inputs, blocksByName],
  );

  const compactPreview = React.useMemo(() => {
    return code.split('\n').slice(0, 6).join('\n');
  }, [code]);

  const runnable = isRunnable(language);

  const handleRun = React.useCallback(async () => {
    if (!block) return;
    if (!runnable) {
      toast.error(`Cannot run ${languageLabel} — JavaScript or Python only.`);
      return;
    }
    if (!code.trim()) {
      toast.error('Code is empty');
      return;
    }
    setStatus('running');
    eventBus.emit('block:run:start', { blockId });
    try {
      const result = await runCode(language, code);
      const combined =
        result.stdout +
        (result.stderr ? `\n[stderr]\n${result.stderr}` : '') +
        (result.error ? `\n[error] ${result.error}` : '');
      patchProps({
        output: combined.trim(),
        lastRun: {
          timestamp: new Date().toISOString(),
          stdout: result.stdout,
          stderr: result.stderr,
          error: result.error,
        },
      });
      if (result.error) {
        setStatus('error');
        eventBus.emit('block:run:error', { blockId, error: result.error });
        toast.error(result.error);
      } else {
        setStatus('success');
        eventBus.emit('block:run:complete', { blockId, result: combined });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      eventBus.emit('block:run:error', { blockId, error: err });
      patchProps({
        lastRun: {
          timestamp: new Date().toISOString(),
          error: msg,
        },
      });
      toast.error(msg);
    }
  }, [block, blockId, code, language, languageLabel, patchProps, runnable]);

  const portOpacity = hovered || selected ? 1 : 0;

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={selectThis}
        className="group relative rounded-lg p-2.5 bg-[rgba(20,20,28,0.85)] backdrop-blur-md transition-all"
        style={{
          width: 280,
          border: selected
            ? `1px solid ${TYPE_COLOR}99`
            : expandedSelection
              ? `1px dashed ${TYPE_COLOR}73`
              : '1px solid rgba(255,255,255,0.08)',
          boxShadow: selected ? `0 0 0 2px ${TYPE_COLOR}26` : 'none',
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />
        <Handle
          type="target"
          position={Position.Left}
          style={{ ...PORT_STYLE, opacity: portOpacity }}
        />

        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: TYPE_COLOR }}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
            Code
          </span>
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent text-[10px] font-medium text-white/70 placeholder:text-white/30 outline-none nodrag"
          />

          {/* Language dropdown */}
          <div className="relative nodrag" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowLangDropdown((v) => !v)}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/60 hover:text-white/85 hover:bg-white/[0.06] transition-colors"
            >
              {languageLabel}
              <ChevronDown size={10} />
            </button>
            {showLangDropdown && (
              <div className="absolute top-full right-0 mt-1 py-1 bg-[rgba(22,22,30,0.98)] border border-white/[0.08] rounded-md z-20 min-w-[120px]">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => {
                      onLanguageChange(l.value);
                      setShowLangDropdown(false);
                    }}
                    className={cn(
                      'w-full px-2.5 py-1 text-left text-[11px] hover:bg-white/[0.06] transition-colors',
                      l.value === language ? 'text-white' : 'text-white/60',
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <StatusDot status={status} />
          <button
            type="button"
            className="p-0.5 text-white/40 hover:text-white/80 nodrag"
            title="More"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={12} />
          </button>
        </div>

        {/* Compact code preview (read-only Monaco, no line numbers) */}
        <div
          className="rounded-md overflow-hidden mb-2 nodrag"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.05)',
            minHeight: 96,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {code.trim() ? (
            <Editor
              height={Math.min(6, Math.max(2, compactPreview.split('\n').length)) * 18}
              language={language}
              value={compactPreview}
              theme="lovable-transparent"
              loading={null}
              options={{
                readOnly: true,
                lineNumbers: 'off',
                glyphMargin: false,
                folding: false,
                lineDecorationsWidth: 4,
                renderLineHighlight: 'none',
                scrollBeyondLastLine: false,
                minimap: { enabled: false },
                overviewRulerLanes: 0,
                scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                fontSize: 11,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                padding: { top: 6, bottom: 6 },
                contextmenu: false,
                domReadOnly: true,
              }}
            />
          ) : (
            <div className="px-3 py-4 text-[11px] text-white/30">
              Click expand to write code…
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="text-[10px] text-white/40 mb-2 truncate">
          {code.split('\n').length} lines · {languageLabel}
          {output ? ' · output ready' : ''}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {runnable ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectThis();
                handleRun();
              }}
              className="nodrag flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold text-white"
              style={{ background: `${TYPE_COLOR}E6` }}
            >
              <Play size={10} className="fill-current" />
              Run
            </button>
          ) : (
            <span className="text-[10px] text-white/30">
              Run unavailable for {languageLabel}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              selectThis();
              setDrawerOpen(true);
            }}
            className="nodrag p-1 text-white/45 hover:text-white/85 rounded transition-colors"
            title="Expand"
          >
            <ArrowUpRight size={12} />
          </button>
        </div>
      </div>

      {/* Expanded drawer */}
      <Sheet
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (open) selectThis();
        }}
      >
        <SheetContent
          side="right"
          className="w-[560px] sm:max-w-[560px] bg-[rgba(15,15,20,0.98)] border-white/10 text-white overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle className="text-white/90 text-base">
              Code block
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* Name + language */}
            <div>
              <div className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Block name"
                  className={cn(
                    'flex-1 px-3 py-2 rounded-md bg-white/[0.03] border text-sm text-white/80 placeholder:text-white/30 outline-none transition-colors',
                    nameError
                      ? 'border-red-500/50 focus:border-red-500/70'
                      : 'border-white/[0.06] focus:border-white/[0.12]',
                  )}
                />
                <select
                  value={language}
                  onChange={(e) =>
                    onLanguageChange(e.target.value as CodeLanguage)
                  }
                  className="px-3 py-2 rounded-md bg-white/[0.03] border border-white/[0.06] text-xs text-white/80 outline-none focus:border-white/[0.12]"
                >
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value} className="bg-[#16161e]">
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              {nameError && (
                <p className="mt-1 text-[10.5px] text-red-400">{nameError}</p>
              )}
            </div>

            {/* Editor */}
            <div
              className="rounded-md overflow-hidden"
              style={{
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
              }}
            >
              <Editor
                height="320px"
                language={language}
                value={code}
                theme="lovable-transparent"
                onChange={onCodeChange}
                options={{
                  fontSize: 13,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  padding: { top: 10, bottom: 10 },
                  bracketPairColorization: { enabled: true },
                  matchBrackets: 'always',
                  suggest: { showWords: true },
                }}
              />
            </div>

            {/* Inputs */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Inputs ({inputs.length})
              </label>
              {inputInfos.length > 0 ? (
                <VariableChips
                  variables={inputInfos}
                  onChipClick={(info) => {
                    if (info.blockId) {
                      setSelection({ kind: 'block', ids: [info.blockId] });
                    }
                  }}
                />
              ) : (
                <p className="text-[11px] text-white/35">
                  No <code className="text-white/50">{`{{variable}}`}</code>{' '}
                  references detected.
                </p>
              )}
            </div>

            {/* Outputs */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                Output
              </label>
              <pre
                className="text-[11px] leading-snug whitespace-pre-wrap break-words rounded-md p-3 max-h-48 overflow-auto"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255, 255, 255, 0.14)',
                  color: lastRun?.error ? '#fca5a5' : 'rgba(255,255,255,0.8)',
                  minHeight: 48,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                }}
              >
                {output || (
                  <span className="text-white/30">
                    Run the code to see output here.
                  </span>
                )}
              </pre>
              {lastRun?.timestamp && (
                <p className="mt-1 text-[10px] text-white/35">
                  Last run: {new Date(lastRun.timestamp).toLocaleString()}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <span className="text-[11px] text-white/40">
                {code.split('\n').length} lines · {languageLabel}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="px-3 py-1.5 text-[11px] font-medium text-white/50 hover:text-white/70 transition-colors"
                >
                  Collapse
                </button>
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={!runnable}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-full text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  style={{ background: `${TYPE_COLOR}E6` }}
                  title={runnable ? 'Run code' : 'Only JavaScript and Python can be run'}
                >
                  <Play className="w-3 h-3 fill-current" />
                  Run
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default CodeBlockNode;
