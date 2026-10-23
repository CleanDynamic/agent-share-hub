/* CA-17 P4 — the map's panel, 312 wide, in place of Details in the Map view (on a phone it goes under the map).

   With a session selected: its name and where it stands, the sessions it uses and the sessions that use it, what joins
   them (a timeline of the tile-level sentences), and the tiles it holds. With nothing selected: the parts, then the
   stages. Nothing here writes. The maker's panel has "Open in the build"; a reader's does not. */

import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { IconButton } from "@/components/brand/IconButton";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import { dayLabel, stageDays, stagesRange } from "@/lib/build/stages";
import { workstreamMark } from "@/lib/build/workstreams";
import type { MapSession, SessionMapModel, TileLink } from "@/lib/build/sessionMap";
import { nameColourFor } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";

import { MAP_COPY, sessionTitle } from "./SessionMap";
import {
  MAP_PANEL,
  PANEL_BADGE,
  PANEL_COUNT,
  PANEL_HEAD,
  PANEL_HEAD_TEXT,
  PANEL_HEADING,
  PANEL_HINT,
  PANEL_ROW,
  PANEL_ROWS,
  PANEL_ROW_APP,
  PANEL_ROW_SIDE,
  PANEL_ROW_TITLE,
  PANEL_RULE,
  PANEL_SUB,
  PANEL_TITLE,
  TIMELINE,
  TIMELINE_DOT,
  TIMELINE_ITEM,
  TIMELINE_LINE1,
  TIMELINE_LINE2,
  TIMELINE_RAIL,
  TIMELINE_SENTENCE,
  TIMELINE_SESSION,
  TIMELINE_SESSIONS,
  TIMELINE_SIDE,
} from "./mapRecipes";
import { ToolMark } from "./refinedPieces";

export const PANEL_COPY = {
  openInBuild: "Open in the build",
  usesFrom: "Uses from",
  usedBy: "Used by",
  whatJoins: "What joins them",
  inThisSession: "In this session",
  tilesNote: (n: number) => `${n} ${n === 1 ? "tile" : "tiles"}, shown here and not on the map`,
  connections: (n: number) => `${n} ${n === 1 ? "connection" : "connections"}`,
  parts: "Parts",
  partsNote: (n: number, labels: "letters" | "numbers") => `${n} ${n === 1 ? "part" : "parts"} · labelled with ${labels}`,
  stages: "Stages",
  stagesRange: (first: number, last: number) => (first === last ? `Stage ${first}` : `Stages ${first} to ${last}`),
  nothing: "Nothing selected. Select a session to see what joins it.",
} as const;

export interface SessionMapPanelProps {
  model: SessionMapModel;
  selected: string | null;
  /** The maker's "Open in the build". Absent: no button. */
  onOpenInBuild?: (key: string) => void;
  /** A row of "In this session" opens the build at that tile. */
  onOpenTile?: (tileId: string) => void;
  stacked?: boolean;
}

const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;

/** The badge at a row's left: "S2". */
function Badge({ children, colour }: { children: ReactNode; colour?: string }) {
  return <span style={{ ...PANEL_BADGE, ...(colour ? { color: colour } : null) }}>{children}</span>;
}

/** "Session 4 · Part B · Claude · 9 Oct", with "Part B" in the part's colour. */
function Where({ model, session, theme }: { model: SessionMapModel; session: MapSession; theme: "noon" | "dusk" }) {
  const part = model.hasParts ? model.parts.find((entry) => entry.key === session.part) : undefined;
  const bits: ReactNode[] = [`Session ${session.number}`];
  if (part) bits.push(<span key="part" style={part.colour ? { color: nameColourFor(part.colour, theme) } : undefined}>{part.label}</span>);
  if (session.app) bits.push(session.app);
  if (session.day) bits.push(dayLabel(session.day));
  return (
    <p data-testid="panel-where" style={PANEL_SUB}>
      {bits.map((bit, at) => (
        <Fragment key={at}>
          {at > 0 ? " · " : null}
          {bit}
        </Fragment>
      ))}
    </p>
  );
}

/** A row for a session it uses, or one that uses it. */
function SessionRow({ session, side }: { session: MapSession; side: string }) {
  return (
    <div data-testid="panel-session-row" data-session-key={session.key} style={PANEL_ROW}>
      <Badge>S{session.number}</Badge>
      {session.title ? (
        <>
          <span style={PANEL_ROW_TITLE}>{session.title}</span>
          {session.app ? <span style={PANEL_ROW_APP}>· {session.app}</span> : null}
        </>
      ) : (
        <>
          <span style={PANEL_ROW_TITLE}>{session.app ?? MAP_COPY.noApp}</span>
          <span style={PANEL_ROW_APP}>· {MAP_COPY.untitled}</span>
        </>
      )}
      <span style={PANEL_ROW_SIDE}>{side}</span>
    </div>
  );
}

interface Connection {
  tile: TileLink;
  other: MapSession;
  side: string;
}

function SelectedPanel({ model, session, onOpenInBuild, onOpenTile, theme }: { model: SessionMapModel; session: MapSession; onOpenInBuild?: SessionMapPanelProps["onOpenInBuild"]; onOpenTile?: SessionMapPanelProps["onOpenTile"]; theme: "noon" | "dusk" }) {
  const byKey = new Map(model.sessions.map((entry) => [entry.key, entry]));
  const uses = model.links.filter((link) => link.session === session.key).flatMap((link) => (byKey.get(link.from) ? [{ link, other: byKey.get(link.from) as MapSession }] : []));
  const usedBy = model.links.filter((link) => link.from === session.key).flatMap((link) => (byKey.get(link.session) ? [{ link, other: byKey.get(link.session) as MapSession }] : []));
  const connections: Connection[] = [
    ...uses.flatMap(({ link, other }) => link.tiles.map((tile) => ({ tile, other, side: PANEL_COPY.usesFrom }))),
    ...usedBy.flatMap(({ link, other }) => link.tiles.map((tile) => ({ tile, other, side: PANEL_COPY.usedBy }))),
  ];
  const tiles = model.tiles[session.key] ?? [];
  return (
    <>
      <div style={PANEL_HEAD}>
        <div style={PANEL_HEAD_TEXT}>
          <h2 data-testid="panel-title" style={PANEL_TITLE}>
            {sessionTitle(session)}
          </h2>
          <Where model={model} session={session} theme={theme} />
        </div>
        {onOpenInBuild ? <IconButton icon={ChevronRight} glyph="chev" label={PANEL_COPY.openInBuild} size={26} onClick={() => onOpenInBuild(session.key)} /> : null}
      </div>
      {uses.length + usedBy.length > 0 ? (
        <div data-testid="panel-sessions" style={PANEL_ROWS}>
          {uses.map(({ other }) => (
            <SessionRow key={`u:${other.key}`} session={other} side={PANEL_COPY.usesFrom} />
          ))}
          {usedBy.map(({ other }) => (
            <SessionRow key={`b:${other.key}`} session={other} side={PANEL_COPY.usedBy} />
          ))}
        </div>
      ) : null}
      <hr style={PANEL_RULE} />
      <h3 style={PANEL_HEADING}>{PANEL_COPY.whatJoins}</h3>
      <p data-testid="panel-connections" style={PANEL_COUNT}>
        {PANEL_COPY.connections(connections.length)}
      </p>
      {connections.length > 0 ? (
        <div data-testid="panel-timeline" style={TIMELINE}>
          <span aria-hidden="true" style={TIMELINE_RAIL} />
          {connections.map((connection, at) => (
            <div key={`${connection.tile.to}>${connection.tile.from}:${connection.tile.verb}`} data-testid="panel-connection" style={TIMELINE_ITEM}>
              <span aria-hidden="true" style={{ ...TIMELINE_DOT, background: at === 0 ? t.text : t.label, ...(at === 0 ? null : { filter: t.dimFilter }) }} />
              <div style={TIMELINE_LINE1}>
                <span style={TIMELINE_SENTENCE}>{connection.tile.sentence}</span>
                <span style={TIMELINE_SIDE}>{connection.side}</span>
              </div>
              <div style={TIMELINE_LINE2}>
                <ToolMark tool={connection.other.app} size={16} />
                <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{`${connection.tile.what} · Session ${connection.other.number}`}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <hr style={PANEL_RULE} />
      <h3 style={PANEL_HEADING}>{PANEL_COPY.inThisSession}</h3>
      <p data-testid="panel-tiles-note" style={PANEL_COUNT}>
        {PANEL_COPY.tilesNote(tiles.length)}
      </p>
      {tiles.length > 0 ? (
        <div data-testid="panel-tiles" style={PANEL_ROWS}>
          {tiles.map((tile) => (
            <button key={tile.id} type="button" data-testid="panel-tile-row" data-tile-id={tile.id} onClick={() => onOpenTile?.(tile.id)} style={{ ...PANEL_ROW, cursor: onOpenTile ? "pointer" : "default" }}>
              <Badge>{tile.number || "·"}</Badge>
              <span style={PANEL_ROW_TITLE}>{tile.title}</span>
              <span style={PANEL_ROW_SIDE}>{tile.kind}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}

function NothingSelected({ model, theme }: { model: SessionMapModel; theme: "noon" | "dusk" }) {
  const byKey = new Map(model.sessions.map((entry) => [entry.key, entry]));
  const stages = model.stages.stages;
  return (
    <>
      {model.hasParts ? (
        <>
          <h3 style={PANEL_HEADING}>{PANEL_COPY.parts}</h3>
          <p data-testid="panel-parts-note" style={PANEL_COUNT}>
            {PANEL_COPY.partsNote(model.parts.length, model.labels)}
          </p>
          <div data-testid="panel-parts" style={PANEL_ROWS}>
            {model.parts.map((part) => {
              const numbers = part.sessions.map((key) => model.stages.stageOf[key] ?? 1);
              const colour = part.colour ? nameColourFor(part.colour, theme) : undefined;
              return (
                <div key={part.key} data-testid="panel-part-row" data-part-key={part.key} style={PANEL_ROW}>
                  <Badge colour={colour}>{workstreamMark(part.index, model.labels)}</Badge>
                  <span style={PANEL_ROW_TITLE}>{part.name ?? part.label}</span>
                  <span style={PANEL_ROW_APP}>· {plural(part.sessions.length, "session")}</span>
                  {numbers.length > 0 ? <span style={PANEL_ROW_SIDE}>{PANEL_COPY.stagesRange(Math.min(...numbers), Math.max(...numbers))}</span> : null}
                </div>
              );
            })}
          </div>
          <hr style={PANEL_RULE} />
        </>
      ) : null}
      <h3 style={PANEL_HEADING}>{PANEL_COPY.stages}</h3>
      <p data-testid="panel-stages-note" style={PANEL_COUNT}>
        {mapRange(model)}
      </p>
      <div data-testid="panel-timeline" style={TIMELINE}>
        <span aria-hidden="true" style={TIMELINE_RAIL} />
        {stages.map((stage, at) => (
          <div key={stage.number} data-testid="panel-stage" style={TIMELINE_ITEM}>
            <span aria-hidden="true" style={{ ...TIMELINE_DOT, background: at === 0 ? t.text : t.label, ...(at === 0 ? null : { filter: t.dimFilter }) }} />
            <div style={TIMELINE_LINE1}>
              <span style={TIMELINE_SENTENCE}>Stage {stage.number}</span>
              <span style={TIMELINE_SIDE}>{stageDays(stage)}</span>
            </div>
            <div style={TIMELINE_SESSIONS}>
              {stage.sessions.map((key) => {
                const session = byKey.get(key);
                return session ? (
                  <span key={key} style={TIMELINE_SESSION}>
                    <ToolMark tool={session.app} size={16} />
                    {sessionTitle(session)}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>
      <p data-testid="panel-nothing" style={PANEL_HINT}>
        {PANEL_COPY.nothing}
      </p>
    </>
  );
}

const mapRange = (model: SessionMapModel): string => stagesRange(model.stages.stages);

export function SessionMapPanel({ model, selected, onOpenInBuild, onOpenTile, stacked = false }: SessionMapPanelProps) {
  const theme = useResolvedTheme();
  const session = selected ? model.sessions.find((entry) => entry.key === selected) : undefined;
  return (
    <aside data-testid="map-panel" aria-label="Map panel" style={{ ...MAP_PANEL, ...(stacked ? { width: "100%" } : null) }}>
      {session ? <SelectedPanel model={model} session={session} onOpenInBuild={onOpenInBuild} onOpenTile={onOpenTile} theme={theme} /> : <NothingSelected model={model} theme={theme} />}
    </aside>
  );
}
