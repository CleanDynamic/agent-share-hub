/* CA-17 P4 — the map of sessions: its head, its drawing and its legend, as the boards "Map: horizontal" and
   "Map: vertical" draw them. The panel beside it is `SessionMapPanel`.

   THE MAP SHOWS SESSIONS ONLY. One box each: the app's mark, the title (or the app's name), and the number. A line joins
   two sessions where a tile in one uses something from the other. Where everything goes is `layoutSessionMap`'s
   (`sessionMap.ts`, pure); this draws what it says: dividers and lines in one SVG under the boxes, the stage strip, the
   part labels, and a button for each box in reading order.

   The head's controls (direction, Fit to screen, Map options) are the maker's; a reader's head has Fit to screen only.
   Below 768 wide the map is always vertical. */

import { GROUP_LABEL_COPY, useGroupLookup } from "./groupLabels";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { Maximize2, MoreHorizontal } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";

import { usePartRegister } from "@/components/build/partNav";
import { IconButton } from "@/components/brand/IconButton";
import { Segmented } from "@/components/brand/Segmented";
import { Glyph } from "@/components/brand/Glyph";
import { useMinWidth } from "@/components/shell/useMinWidth";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { refTo } from "@/lib/build/thread";
import {
  SESSION_MAP_SIZES,
  joinedSessions,
  layoutSessionMap,
  mapSummary,
  readingOrder,
  type MapDirection,
  type SessionMapModel,
} from "@/lib/build/sessionMap";
import { borderFor, nameColourFor, swatchFor } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";

import { MenuContent } from "./ComposeMenu";
import {
  MAP_BOX,
  MAP_BOX_APP,
  MAP_BOX_NUMBER,
  MAP_BOX_SELECTED,
  MAP_BOX_TITLE,
  MAP_COLUMN,
  MAP_HEAD,
  MAP_HEAD_CONTROLS,
  MAP_HEAD_TEXT,
  MAP_LEGEND,
  MAP_LEGEND_BAR,
  MAP_LEGEND_KEY,
  MAP_LEGEND_KEYS,
  MAP_LEGEND_NOTE,
  MAP_LEGEND_NOTE_BELOW,
  MAP_LEGEND_SELECTED,
  MAP_LEGEND_SQUARE,
  MAP_LEGEND_TEXT,
  MAP_NONE,
  MAP_NONE_BODY,
  MAP_NONE_TITLE,
  MAP_PART_NAME,
  MAP_PART_NOTE,
  MAP_SCROLL,
  MAP_STAGE_LABEL,
  MAP_STRIP,
  MAP_SUB,
  MAP_TITLE,
} from "./mapRecipes";
import { ToolMark } from "./refinedPieces";
import { RecipeButton } from "./modalRecipes";
import { menuItem, menuSurface } from "./refinedStyles";

export const MAP_COPY = {
  directionLabel: "Map direction",
  horizontal: "Horizontal",
  vertical: "Vertical",
  fit: "Fit to screen",
  options: "Map options",
  showOnBuildPage: "Show on build page",
  remove: "Remove map",
  shown: "Shown on build page",
  notShown: "Not on build page",
  legend: "A line means a tile in the later session uses something from the earlier one.",
  selectedPath: "Selected path",
  noMap: "No map for this build.",
  noMapBody: "A map shows how the sessions connect across parts and stages. It is built from the sessions you already have.",
  create: "Create a map",
  untitled: "untitled",
  noApp: "No app chosen",
} as const;

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** "6 sessions in 2 parts", or "6 sessions" with one part. */
export function mapTitle(model: Pick<SessionMapModel, "sessions" | "parts" | "hasParts">): string {
  const sessions = plural(model.sessions.length, "session");
  return model.hasParts ? `${sessions} in ${plural(model.parts.length, "part")}` : sessions;
}

/** What a box's accessible name says. */
export const boxName = (session: { number: number; title?: string; app: string | null }): string =>
  [`Session ${session.number}`, session.title, session.app].filter(Boolean).join(", ");

/** A session's name in the panel and the legend: its title, else its app's, else "untitled". */
export const sessionTitle = (session: { title?: string; app: string | null }): string => session.title ?? session.app ?? MAP_COPY.untitled;

/** What the maker can do to the map from its head. Absent: a reader's head. */
export interface MapControls {
  onDirection: (direction: MapDirection) => void;
  /** Whether readers see the map. */
  onBuildPage: boolean;
  onToggleBuildPage: (next: boolean) => void;
  onRemove: () => void;
}

export interface SessionMapColumnProps {
  model: SessionMapModel;
  /** The maker's direction; below 768 wide the map is vertical whatever it says. */
  direction: MapDirection;
  selected: string | null;
  onSelect: (key: string | null) => void;
  controls?: MapControls;
  /** The head's second line ends with this ("Shown on build page"). Absent for a reader. */
  shownLine?: string;
}

function MapOptionsMenu({ controls }: { controls: MapControls }) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <IconButton icon={MoreHorizontal} glyph="more" label={MAP_COPY.options} size={26} />
      </Menu.Trigger>
      <Menu.Portal>
        <MenuContent align="end" sideOffset={4} style={menuSurface(220)}>
          <Menu.CheckboxItem
            checked={controls.onBuildPage}
            onCheckedChange={(next) => controls.onToggleBuildPage(next)}
            onSelect={(event) => event.preventDefault()}
            style={{ ...menuItem(true, false), gap: 8 }}
          >
            <span style={{ width: 16, display: "inline-flex" }}>
              <Menu.ItemIndicator>
                <Glyph name="check" size={16} />
              </Menu.ItemIndicator>
            </span>
            {MAP_COPY.showOnBuildPage}
          </Menu.CheckboxItem>
          <Menu.Separator style={{ height: 1, margin: "4px 0", background: t.hairline }} />
          <Menu.Item onSelect={controls.onRemove} data-tone="danger" style={{ ...menuItem(true, false), color: t.breakage }}>
            {MAP_COPY.remove}
          </Menu.Item>
        </MenuContent>
      </Menu.Portal>
    </Menu.Root>
  );
}

/** The map's drawing: dividers and lines under the boxes. `scale` fits it to its column. */
function Drawing({ model, direction, selected, onSelect, scale }: { model: SessionMapModel; direction: MapDirection; selected: string | null; onSelect: (key: string | null) => void; scale: number }) {
  /* CA-19 P5: no label on a box, which keeps its outline; its tooltip says "Session 2 · in Login flow". */
  const groupOf = useGroupLookup();
  const tooltipFor = (session: { key: string; number: number }) => {
    const group = groupOf(refTo({ kind: "session", id: session.key }));
    return group?.name ? GROUP_LABEL_COPY.tooltip(`Session ${session.number}`, group.name) : `Session ${session.number}`;
  };
  const theme = useResolvedTheme();
  const register = usePartRegister();
  const layout = useMemo(() => layoutSessionMap(model, direction), [model, direction]);
  const joined = useMemo(() => joinedSessions(model, selected), [model, selected]);
  const sessions = useMemo(() => new Map(model.sessions.map((session) => [session.key, session])), [model.sessions]);
  const partOf = useMemo(() => new Map(model.parts.map((part) => [part.key, part])), [model.parts]);
  const boxes = useMemo(() => {
    const at = new Map(layout.boxes.map((box) => [box.key, box]));
    return readingOrder(model).flatMap((key) => (at.has(key) ? [at.get(key)!] : []));
  }, [layout, model]);
  const top = -layout.minY;
  const width = layout.width;
  const height = layout.height - layout.minY;
  const selectedStage = selected ? (model.stages.stageOf[selected] ?? null) : null;
  const horizontal = layout.direction === "horizontal";

  return (
    <div style={{ position: "relative", width: width * scale, height: height * scale, flexShrink: 0 }}>
      <div
        data-testid="session-map-drawing"
        data-direction={layout.direction}
        style={{ position: "absolute", left: 0, top: 0, width, height, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: "0 0" }}
      >
        {/* The stage strip: a bar across the bottom (horizontal) or a column at the left (vertical). */}
        <div data-testid="map-strip" style={{ ...MAP_STRIP, left: layout.strip.x, top: layout.strip.y + top, width: layout.strip.w, height: layout.strip.h }} />
        {layout.stageLabels.map((label) => {
          const own: CSSProperties = { left: label.x, top: label.y + top, color: selectedStage === label.stage ? t.text : t.label };
          return horizontal ? (
            <span key={label.stage} data-testid="map-stage-label" data-stage={label.stage} data-selected={selectedStage === label.stage || undefined} style={{ ...MAP_STAGE_LABEL, ...own }}>
              {label.text}
            </span>
          ) : (
            <span key={label.stage} data-testid="map-stage-label" data-stage={label.stage} data-selected={selectedStage === label.stage || undefined} style={{ ...MAP_STAGE_LABEL, ...own, display: "flex", flexDirection: "column" }}>
              <span>{label.line1}</span>
              {label.line2 ? <span>{label.line2}</span> : null}
            </span>
          );
        })}

        {/* Dividers and lines, in one SVG, under the boxes and the labels. */}
        <svg width={width} height={height} aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }}>
          <g transform={`translate(0 ${top})`}>
            {layout.dividers.map((divider) => (
              <line key={divider.id} data-testid="map-divider" data-kind={divider.kind} x1={divider.x1} y1={divider.y1} x2={divider.x2} y2={divider.y2} strokeWidth={1} strokeDasharray="4 4" style={{ stroke: t.hairlineModule }} />
            ))}
            {layout.lines.map((line) => {
              const touching = selected !== null && (line.from === selected || line.to === selected);
              const dim = selected !== null && !touching;
              return (
                <g key={line.id} data-testid="map-line" data-from={line.from} data-to={line.to} data-touching={touching || undefined} data-dimmed={dim || undefined} style={dim ? { filter: t.dimFilter } : undefined}>
                  {/* The clear band: the line first as a 9px stroke in the surface's colour, then as itself. */}
                  <path data-testid="map-line-halo" d={line.d} fill="none" strokeLinecap="round" strokeWidth={SESSION_MAP_SIZES.haloWidth} style={{ stroke: t.surface }} />
                  <path data-testid="map-line-stroke" d={line.d} fill="none" strokeLinecap="round" strokeWidth={SESSION_MAP_SIZES.lineWidth} style={{ stroke: touching ? t.text : t.label }} />
                </g>
              );
            })}
          </g>
        </svg>

        {layout.partLabels.map((label) => {
          const part = partOf.get(label.key);
          const colour = part?.colour ? nameColourFor(part.colour, theme) : t.text;
          return (
            <span key={label.key} ref={(el) => register(refTo({ kind: "workstream", id: label.key }), el)} data-testid="map-part-label" data-part-key={label.key} style={{ ...MAP_PART_NAME, left: label.x, top: label.y + top, color: colour }}>
              {label.label}
              <span style={MAP_PART_NOTE}>{label.note}</span>
            </span>
          );
        })}

        {boxes.map((box) => {
          const session = sessions.get(box.key);
          if (!session) return null;
          const isSelected = selected === box.key;
          const dim = selected !== null && !isSelected && !joined.has(box.key);
          const coloured = session.colour ? borderFor(session.colour) : null;
          const shadow = [coloured?.boxShadow as string | undefined, isSelected ? MAP_BOX_SELECTED : undefined].filter(Boolean).join(", ");
          return (
            <button
              key={box.key}
              type="button"
              ref={(el) => register(refTo({ kind: "session", id: box.key }), el)}
              data-testid="map-box"
              data-session-key={box.key}
              data-stage={box.stage}
              data-session-colour={session.colour}
              data-dimmed={dim || undefined}
              aria-label={boxName(session)}
              title={tooltipFor(session)}
              aria-pressed={isSelected}
              onClick={() => onSelect(box.key)}
              style={{ ...MAP_BOX, left: box.x, top: box.y + top, width: box.w, height: box.h, ...coloured, ...(shadow ? { boxShadow: shadow } : null), ...(dim ? { filter: t.dimFilter } : null) }}
            >
              <ToolMark tool={session.app} size={20} />
              {session.title ? <span style={MAP_BOX_TITLE}>{session.title}</span> : <span style={MAP_BOX_APP}>{session.app ?? MAP_COPY.noApp}</span>}
              <span style={MAP_BOX_NUMBER}>S{session.number}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The legend row: what is selected on the left, the parts on the right, then the sentence under it. */
function Legend({ model, selected }: { model: SessionMapModel; selected: string | null }) {
  const session = selected ? model.sessions.find((entry) => entry.key === selected) : undefined;
  const uses = session ? model.links.filter((link) => link.session === session.key).length : 0;
  const usedBy = session ? model.links.filter((link) => link.from === session.key).length : 0;
  return (
    <div data-testid="map-legend">
      <div style={MAP_LEGEND}>
        {session ? (
          <span data-testid="map-legend-selected" style={MAP_LEGEND_SELECTED}>
            <span aria-hidden="true" style={{ ...MAP_LEGEND_SQUARE, ...(session.colour ? swatchFor(session.colour) : { background: t.label }) }} />
            <span style={MAP_LEGEND_TEXT}>
              {`Session ${session.number} · ${sessionTitle(session)} uses ${plural(uses, "session")} and is used by ${usedBy}`}
            </span>
          </span>
        ) : (
          <p data-testid="map-legend-note" style={MAP_LEGEND_NOTE}>
            {MAP_COPY.legend}
          </p>
        )}
        <span style={MAP_LEGEND_KEYS}>
          {model.hasParts
            ? model.parts.map((part) => (
                <span key={part.key} data-testid="map-legend-part" style={MAP_LEGEND_KEY}>
                  <span aria-hidden="true" style={{ ...MAP_LEGEND_BAR, ...(part.colour ? swatchFor(part.colour) : { background: t.label }) }} />
                  {part.label}
                </span>
              ))
            : null}
          {session ? (
            <span data-testid="map-legend-path" style={MAP_LEGEND_KEY}>
              <span aria-hidden="true" style={{ ...MAP_LEGEND_BAR, background: t.text }} />
              {MAP_COPY.selectedPath}
            </span>
          ) : null}
        </span>
      </div>
      {session ? (
        <p data-testid="map-legend-note" style={MAP_LEGEND_NOTE_BELOW}>
          {MAP_COPY.legend}
        </p>
      ) : null}
    </div>
  );
}

/** The map column: head, drawing, legend. */
export function SessionMapColumn({ model, direction: wanted, selected, onSelect, controls, shownLine }: SessionMapColumnProps) {
  const wide = useMinWidth(768);
  const direction: MapDirection = wide ? wanted : "vertical";
  const [fit, setFit] = useState(false);
  const scroller = useRef<HTMLDivElement | null>(null);
  const [room, setRoom] = useState(0);
  const layout = useMemo(() => layoutSessionMap(model, direction), [model, direction]);

  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const read = () => setRoom(box.clientWidth);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  const scale = fit && room > 0 && layout.width > room ? room / layout.width : 1;

  // Escape clears the selection.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && selected) {
      event.stopPropagation();
      onSelect(null);
    }
  };

  const summary = [model.stages.stages.length > 0 ? mapSummary(model) : "", shownLine].filter(Boolean).join(" · ");

  return (
    <div data-testid="session-map" onKeyDown={onKeyDown} style={MAP_COLUMN}>
      <div data-testid="map-head" style={MAP_HEAD}>
        <div style={MAP_HEAD_TEXT}>
          <h2 data-testid="map-title" style={MAP_TITLE}>
            {mapTitle(model)}
          </h2>
          <p data-testid="map-sub" style={MAP_SUB}>
            {summary}
          </p>
        </div>
        <div style={MAP_HEAD_CONTROLS}>
          {controls && wide ? (
            <Segmented
              label={MAP_COPY.directionLabel}
              size={28}
              fontSize={12}
              compact
              value={wanted}
              onChange={controls.onDirection}
              items={[
                { value: "horizontal", label: MAP_COPY.horizontal },
                { value: "vertical", label: MAP_COPY.vertical },
              ]}
            />
          ) : null}
          <IconButton icon={Maximize2} glyph="fit" label={MAP_COPY.fit} size={26} aria-pressed={fit} onClick={() => setFit((on) => !on)} />
          {controls ? <MapOptionsMenu controls={controls} /> : null}
        </div>
      </div>
      <div ref={scroller} data-testid="map-scroll" style={MAP_SCROLL}>
        <Drawing model={model} direction={direction} selected={selected} onSelect={onSelect} scale={scale} />
      </div>
      <Legend model={model} selected={selected} />
    </div>
  );
}

/** "No map for this build." and the way to make one. */
export function NoMap({ onCreate }: { onCreate: () => void }) {
  return (
    <div data-testid="no-map" style={MAP_NONE}>
      <p style={MAP_NONE_TITLE}>{MAP_COPY.noMap}</p>
      <p style={MAP_NONE_BODY}>{MAP_COPY.noMapBody}</p>
      <RecipeButton variant="primary" small onClick={onCreate}>
        {MAP_COPY.create}
      </RecipeButton>
    </div>
  );
}
