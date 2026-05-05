/**
 * VariableChips
 *
 * Renders detected `{{name}}` tokens as small status-dotted chips.
 *  - green dot   → resolved (block exists and has an output value)
 *  - amber dot   → block exists but has no output yet
 *  - red dot     → no block found with that name
 */

import * as React from 'react';
import type { VariableInfo } from '@/lib/variables';

const DOT_COLOR: Record<VariableInfo['status'], string> = {
  resolved: '#22C55E',
  no_output: '#F59E0B',
  missing: '#EF4444',
};

const TOOLTIP: Record<VariableInfo['status'], string> = {
  resolved: 'Resolved — value available',
  no_output: 'Block exists but has no output yet',
  missing: 'No block with this name found',
};

export interface VariableChipsProps {
  variables: VariableInfo[];
  onChipClick?: (info: VariableInfo) => void;
}

export function VariableChips({ variables, onChipClick }: VariableChipsProps) {
  if (variables.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {variables.map((v) => (
        <button
          key={v.name}
          type="button"
          title={TOOLTIP[v.status]}
          onClick={() => onChipClick?.(v)}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium rounded-full text-white/80 hover:text-white transition-colors"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ background: DOT_COLOR[v.status] }}
          />
          {`{{${v.name}}}`}
        </button>
      ))}
    </div>
  );
}

export default VariableChips;
