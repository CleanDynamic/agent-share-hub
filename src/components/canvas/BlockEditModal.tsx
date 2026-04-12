import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BlockInlineEditor } from './BlockInlineEditor';
import type { CanvasBlock } from '@/lib/canvas-types';
import { useState } from 'react';

const BLOCK_TYPE_LABELS: Record<string, string> = {
  prompt: 'Prompt',
  code: 'Code',
  text: 'Text',
  long_text: 'Long Text',
  image: 'Image',
  video: 'Video',
  result: 'Result',
  comparison: 'Comparison',
  agent_config: 'Agent Config',
  workflow: 'Workflow',
  model_params: 'Model Parameters',
  tool_setup: 'Tool Setup',
  resource: 'Resource',
  tutorial_step: 'Tutorial Step',
  section_heading: 'Section Heading',
  sticky_note: 'Note',
};

interface BlockEditModalProps {
  block: CanvasBlock;
  open: boolean;
  onClose: () => void;
  onChange: (patch: Partial<CanvasBlock>) => void;
}

export function BlockEditModal({ block, open, onClose, onChange }: BlockEditModalProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto"
        style={{
          background: 'rgba(10,10,16,0.98)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 14,
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-foreground/80">
            Edit {BLOCK_TYPE_LABELS[block.type] ?? block.type}
            {block.subheading ? ` — ${block.subheading}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2">
          <BlockInlineEditor block={block} onChange={onChange} />
        </div>

        <div className="flex justify-end mt-4 pt-3 border-t border-border/30">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
