import * as React from 'react';
import { Switch } from '@/components/ui/switch';
import { useDocumentStore } from '@/lib/documentStore';
import { toggleStageMissing, toggleBlockMissing } from '@/lib/bountyMissing';
import {
  PANEL_INPUT_BACKGROUND,
  PANEL_INPUT_BORDER,
  PANEL_INPUT_RADIUS,
  SECTION_LABEL_STYLE,
} from './toolPanelStyles';

const STAGE_DESC_MAX = 200;
const BLOCK_DESC_MAX = 100;

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: 16,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  fontWeight: 500,
  color: 'hsl(var(--foreground) / 0.85)',
};

const helperStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontSize: 11,
  fontWeight: 400,
  color: 'hsl(var(--foreground) / 0.45)',
  lineHeight: 1.4,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 64,
  padding: '8px 10px',
  background: PANEL_INPUT_BACKGROUND,
  border: PANEL_INPUT_BORDER,
  borderRadius: PANEL_INPUT_RADIUS,
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  color: 'hsl(var(--foreground) / 0.9)',
  resize: 'vertical',
  outline: 'none',
};

interface BountyInspectorProps {
  kind: 'stage' | 'block';
  id: string;
}

export function BountyInspector({ kind, id }: BountyInspectorProps) {
  const stage = useDocumentStore((s) => (kind === 'stage' ? s.stages[id] : undefined));
  const block = useDocumentStore((s) => (kind === 'block' ? s.blocks[id] : undefined));
  const updateStage = useDocumentStore((s) => s.updateStage);
  const updateBlock = useDocumentStore((s) => s.updateBlock);

  const isMissing = Boolean(kind === 'stage' ? stage?.is_missing : block?.is_missing);
  const description = (kind === 'stage' ? stage?.missing_description : block?.missing_description) ?? '';
  const max = kind === 'stage' ? STAGE_DESC_MAX : BLOCK_DESC_MAX;

  const handleToggle = () => {
    if (kind === 'stage') toggleStageMissing(id);
    else toggleBlockMissing(id);
  };

  const handleDescChange = (value: string) => {
    const trimmed = value.slice(0, max);
    if (kind === 'stage') updateStage(id, { missing_description: trimmed });
    else updateBlock(id, { missing_description: trimmed });
  };

  const subjectLabel = kind === 'stage' ? 'Stage' : 'Block';

  if (kind === 'stage' && !stage) return null;
  if (kind === 'block' && !block) return null;

  return (
    <div style={containerStyle}>
      <div style={SECTION_LABEL_STYLE}>Bounty</div>

      <div style={rowStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={labelStyle}>Mark as missing</span>
          <span style={helperStyle}>
            Solvers will see this {subjectLabel.toLowerCase()} as a slot they can fill.
          </span>
        </div>
        <Switch checked={isMissing} onCheckedChange={handleToggle} />
      </div>

      {isMissing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={labelStyle} htmlFor={`bounty-desc-${id}`}>
            What's needed?
          </label>
          <textarea
            id={`bounty-desc-${id}`}
            value={description}
            onChange={(e) => handleDescChange(e.target.value)}
            placeholder={
              kind === 'stage'
                ? 'Briefly describe what this stage should accomplish (max 200 chars)…'
                : 'Briefly describe what this block needs (max 100 chars)…'
            }
            maxLength={max}
            style={textareaStyle}
          />
          <div
            style={{
              ...helperStyle,
              textAlign: 'right',
            }}
          >
            {description.length}/{max}
          </div>
        </div>
      ) : null}
    </div>
  );
}
