// The default cover (29g): what a build shows on a phone when its maker chose no picture. The build's title in Geist Serif 22/28
// (a work's name, the one place the serif stands), its session count under it in mono 13 Text 3, on Card with 16 padding. Never a
// guess from the build's evidence: a session's screenshots can be captures of the OpenBuilds editor, and that is not the work.

import { DM_MONO, SENTIENT } from "@/lib/theme/type";
import { t } from "@/lib/theme/tokens";

export const DEFAULT_COVER = { titleSize: 22, titleLine: 28, metaSize: 13, metaLine: 16, padding: 16 } as const;

/** "1 session", "3 sessions"; null for a build whose sessions are not counted yet. */
export function sessionsLine(count: number | null | undefined): string | null {
  if (typeof count !== "number" || !Number.isFinite(count) || count <= 0) return null;
  return `${count} ${count === 1 ? "session" : "sessions"}`;
}

export interface DefaultCoverProps {
  title: string;
  sessionCount?: number | null;
  /** The picture's corner, from the surface it sits in. */
  radius: number;
}

export function DefaultCover({ title, sessionCount, radius }: DefaultCoverProps) {
  const sessions = sessionsLine(sessionCount);
  return (
    <div
      data-testid="default-cover"
      data-default-cover=""
      style={{
        boxSizing: "border-box",
        width: "100%",
        aspectRatio: "16 / 9",
        borderRadius: radius,
        background: t.module,
        padding: DEFAULT_COVER.padding,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <span
        style={{
          fontFamily: SENTIENT,
          fontSize: DEFAULT_COVER.titleSize,
          fontWeight: 400,
          lineHeight: `${DEFAULT_COVER.titleLine}px`,
          color: t.text,
          overflowWrap: "anywhere",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {title}
      </span>
      {sessions ? (
        <span style={{ fontFamily: DM_MONO, fontSize: DEFAULT_COVER.metaSize, lineHeight: `${DEFAULT_COVER.metaLine}px`, color: t.label, fontVariantNumeric: "tabular-nums" }}>{sessions}</span>
      ) : null}
    </div>
  );
}

export default DefaultCover;
