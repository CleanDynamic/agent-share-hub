// Placeholder — full implementation in Prompt 3
import type { CanvasStage, CanvasBlock } from '@/lib/canvas-types';

interface CanvasTOCProps {
  open: boolean;
  onToggle: () => void;
  stages: CanvasStage[];
  blocks: CanvasBlock[];
  mode: 'edit' | 'view';
  onBlockClick: (blockId: string) => void;
}

export function CanvasTOC(_props: CanvasTOCProps) {
  return null;
}
