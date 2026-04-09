// Placeholder — full implementation in Prompt 3
import type { useCanvasDocument } from '@/hooks/useCanvasDocument';

interface CanvasToolbarProps {
  doc: ReturnType<typeof useCanvasDocument>;
  onSave?: () => void;
  onPublish?: () => void;
  saving?: boolean;
  submitting?: boolean;
}

export function CanvasToolbar(_props: CanvasToolbarProps) {
  return null;
}
