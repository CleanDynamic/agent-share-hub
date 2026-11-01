/* SV-27 P10: the Map's Architecture view. Drawn at rest from `layoutArchitecture`, with the Map's existing boxes (`MAP_BOX`),
   lines in `--line`, labels in Geist Mono 10 `--label`, and the dot grid; no new look and no motion. A box opens its tile.
   Read only on the build page. Its own chunk: fetched when the Map's Architecture view is asked for. */

import type { ReactNode } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { layoutArchitecture, type ArchDirection } from "@/lib/build/architectureMap";
import { mapViewOf, type MapView } from "@/lib/build/making";
import type { NodeTree } from "@/lib/build/types";
import { DM_MONO } from "@/lib/theme/type";
import { t } from "@/lib/theme/tokens";

import { MAP_BOX, MAP_BOX_APP, MAP_BOX_TITLE, MAP_SCROLL } from "./mapRecipes";

export interface ArchitectureMapProps {
  tree: readonly NodeTree[];
  direction: ArchDirection;
  /** A box opens its tile; absent on the build page (read only). */
  onOpen?: (id: string) => void;
}

const PAD = 16;

export function ArchitectureMap({ tree, direction, onOpen }: ArchitectureMapProps) {
  const map = layoutArchitecture(tree, direction);
  const width = map.width + PAD * 2;
  const height = map.height + PAD * 2;
  return (
    <div data-testid="architecture-map" role="group" aria-label="Architecture" style={MAP_SCROLL}>
      <div style={{ position: "relative", width, height, backgroundImage: `radial-gradient(${t.dotGrid} 1px, transparent 1px)`, backgroundSize: "16px 16px" }}>
        <svg aria-hidden="true" width={width} height={height} style={{ position: "absolute", inset: 0 }}>
          {map.frames.map((frame) => (
            <rect key={frame.host} x={frame.x + PAD} y={frame.y + PAD} width={frame.w} height={frame.h} rx={10} fill="none" stroke={t.line} strokeWidth={1} />
          ))}
          {map.lines.map((line) => (
            <g key={`${line.from}>${line.to}>${line.label}`}>
              {/* SV-28: a handoff's condition is the line's tooltip; a mention with no handoff rule is dotted. */}
              {line.when ? <title>{`${line.label} when ${line.when}`}</title> : null}
              <line x1={line.x1 + PAD} y1={line.y1 + PAD} x2={line.x2 + PAD} y2={line.y2 + PAD} stroke={t.line} strokeWidth={1} strokeDasharray={line.dotted ? "2 3" : undefined} data-testid={line.dotted ? "arch-line-dotted" : undefined} />
              <text x={(line.x1 + line.x2) / 2 + PAD} y={(line.y1 + line.y2) / 2 + PAD - 4} textAnchor="middle" fontFamily={DM_MONO} fontSize={10} fill={t.label}>
                {line.label}
              </text>
            </g>
          ))}
          {map.frames.map((frame) => (
            <text key={`${frame.host}-label`} x={frame.x + PAD + 12} y={frame.y + PAD + 14} fontFamily={DM_MONO} fontSize={10} fill={t.label}>
              {frame.label}
            </text>
          ))}
        </svg>
        {map.boxes.map((box) => {
          const body = (
            <>
              <span style={MAP_BOX_TITLE}>{box.title}</span>
              {box.lines.map((line, at) => (
                <span key={at} style={MAP_BOX_APP}>
                  {line}
                </span>
              ))}
            </>
          );
          const style = { ...MAP_BOX, left: box.x + PAD, top: box.y + PAD, width: box.w, height: box.h, flexDirection: "column" as const, alignItems: "flex-start" as const, justifyContent: "center" as const, gap: 0 };
          return onOpen && box.tile ? (
            <button key={box.id} type="button" data-testid="architecture-box" onClick={() => onOpen(box.tile as string)} style={style}>
              {body}
            </button>
          ) : (
            <div key={box.id} data-testid="architecture-box" style={{ ...style, cursor: "default" }}>
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The Map with its view switch: Sessions (the existing map, given as `sessionsMap`) or Architecture. The choice changes at once
 * and is stored through the making writer (`onView`, `making.map.view`); with none stored, a build with deployment tiles and one
 * session opens on Architecture.
 */
export function MapViews({ made, sessions, tree, direction, sessionsMap, onView, onOpen }: { made: unknown; sessions: number; tree: readonly NodeTree[]; direction: ArchDirection; sessionsMap: ReactNode; onView: (view: MapView) => void; onOpen?: (id: string) => void }) {
  const view = mapViewOf(made, true, sessions);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      <Segmented<MapView>
        label="Map view"
        semantics="radio"
        size={28}
        value={view}
        items={[
          { value: "sessions", label: "Sessions" },
          { value: "architecture", label: "Architecture" },
        ]}
        onChange={onView}
      />
      {view === "architecture" ? <ArchitectureMap tree={tree} direction={direction} onOpen={onOpen} /> : sessionsMap}
    </div>
  );
}

export default ArchitectureMap;
