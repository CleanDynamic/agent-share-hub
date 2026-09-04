import { useCallback, useState } from 'react';
import { ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  ArrowLeft,
  Minus,
  Plus,
  Maximize,
  Map as MapIcon,
  HelpCircle,
} from 'lucide-react';

import { StageCanvasInner } from './StageCanvas';
import {
  getExpandedBlockId,
  setExpandedBlockId,
} from '@/lib/blockExpansion';

interface StageFullscreenProps {
  stageId: string;
  onClose: () => void;
}

/**
 * Fullscreen canvas-only surface that REPLACES the article editor in the
 * middle panel while a stage is open. Owns its own ReactFlowProvider so
 * the bottom-bar zoom/fit/minimap controls share the same React Flow store
 * as the canvas they control.
 */
export function StageFullscreen({ stageId, onClose }: StageFullscreenProps) {
  const [showMiniMap, setShowMiniMap] = useState(false);

  // Esc: collapse the currently-expanded block first; if none, close stage.
  useHotkeys(
    'esc',
    () => {
      if (getExpandedBlockId()) {
        setExpandedBlockId(null);
      } else {
        onClose();
      }
    },
    { enableOnFormTags: false },
  );

  return (
    <ReactFlowProvider>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'transparent',
          minHeight: 0,
        }}
      >
        {/* TOP STRIP — back button only */}
        <div
          style={{
            flexShrink: 0,
            height: 44,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            background: 'transparent',
            borderBottom: '0.5px solid rgba(255, 255, 255, 0.14)',
          }}
        >
          <BackButton onClick={onClose} />
        </div>

        {/* CANVAS BODY */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <StageCanvasInner stageId={stageId} showMiniMap={showMiniMap} />
        </div>

        {/* BOTTOM BAR — zoom / fit / minimap */}
        <BottomBar
          showMiniMap={showMiniMap}
          onToggleMiniMap={() => setShowMiniMap((v) => !v)}
        />
      </div>
    </ReactFlowProvider>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Back to article (Esc)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        background: hover ? 'rgba(255,255,255,0.08)' : 'rgba(255, 255, 255, 0.12)',
        border: '0.5px solid rgba(255, 255, 255, 0.14)',
        borderRadius: 6,
        color: 'rgba(255,255,255,0.75)',
        fontFamily: 'Figtree, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'background 120ms ease',
      }}
    >
      <ArrowLeft size={14} strokeWidth={1.8} />
      Back to article
    </button>
  );
}

interface BottomBarProps {
  showMiniMap: boolean;
  onToggleMiniMap: () => void;
}

function BottomBar({ showMiniMap, onToggleMiniMap }: BottomBarProps) {
  const { zoomTo, fitView, getZoom } = useReactFlow();
  // Live zoom subscription via React Flow's internal store.
  const zoom = useStore((s) => s.transform[2]);

  const clampZoom = (z: number) => Math.max(0.2, Math.min(1.5, z));

  const onZoomOut = useCallback(() => {
    const next = clampZoom((getZoom() ?? zoom) - 0.1);
    zoomTo(next, { duration: 0 });
  }, [getZoom, zoom, zoomTo]);

  const onZoomIn = useCallback(() => {
    const next = clampZoom((getZoom() ?? zoom) + 0.1);
    zoomTo(next, { duration: 0 });
  }, [getZoom, zoom, zoomTo]);

  const onFit = useCallback(() => {
    fitView({ padding: 0.2, duration: 200, minZoom: 0.2, maxZoom: 1.5 });
  }, [fitView]);

  const zoomLabel = `${Math.round((zoom ?? 1) * 100)}%`;

  return (
    <div
      style={{
        flexShrink: 0,
        height: 36,
        padding: '6px 14px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        background: 'transparent',
        borderTop: '0.5px solid rgba(255, 255, 255, 0.14)',
      }}
    >
      {/* Zoom group */}
      <IconBtn onClick={onZoomOut} title="Zoom out">
        <Minus size={12} strokeWidth={1.8} />
      </IconBtn>
      <span
        style={{
          minWidth: 36,
          textAlign: 'center',
          fontFamily: 'Figtree, sans-serif',
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.70)',
          fontVariantNumeric: 'tabular-nums',
          padding: '0 4px',
          userSelect: 'none',
        }}
      >
        {zoomLabel}
      </span>
      <IconBtn onClick={onZoomIn} title="Zoom in">
        <Plus size={12} strokeWidth={1.8} />
      </IconBtn>

      <Divider />

      <IconBtn onClick={onFit} title="Fit view">
        <Maximize size={14} strokeWidth={1.8} />
      </IconBtn>

      <Divider />

      <IconBtn
        onClick={onToggleMiniMap}
        title={showMiniMap ? 'Hide minimap' : 'Show minimap'}
        active={showMiniMap}
      >
        <MapIcon size={14} strokeWidth={1.8} />
      </IconBtn>

      <span
        title="Scroll to pan · Pinch or Cmd-scroll to zoom"
        aria-label="Scroll to pan · Pinch or Cmd-scroll to zoom"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          marginLeft: 6,
          color: 'rgba(255,255,255,0.30)',
          cursor: 'help',
        }}
      >
        <HelpCircle size={12} strokeWidth={1.8} />
      </span>
    </div>
  );
}

function Divider() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 1,
        height: 16,
        background: 'rgba(255, 255, 255, 0.14)',
        margin: '0 8px',
      }}
    />
  );
}

interface IconBtnProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

function IconBtn({ onClick, title, active = false, children }: IconBtnProps) {
  const [hover, setHover] = useState(false);
  const baseColor = active ? '#E8571A' : 'rgba(255,255,255,0.70)';
  const activeBg = 'rgba(232,87,26,0.10)';
  const hoverBg = 'rgba(255, 255, 255, 0.14)';
  const bg = active ? activeBg : hover ? hoverBg : 'transparent';
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 24,
        height: 24,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        border: 'none',
        borderRadius: 5,
        color: baseColor,
        cursor: 'pointer',
        transition: 'background 120ms ease, color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}
