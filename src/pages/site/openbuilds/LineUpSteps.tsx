/* UX-06 Part 6: Line up steps, the Wall's optional comparison. PURE: typed props in.

   The control is a labelled checkbox on the Wall's row, drawn by the page only when two or more builds in replies rebuild the post's
   build, and only 760 wide and up. When on, a module box under the switch: `Where the builds differ` (14/500), its meta line, then a
   real table with a caption: a row per build (the post's first), a column per step number. A cell is a tile with the step's title;
   a changed step (its kind or words differ from the post's build at that number) takes 1px `--selected-edge` and `--selected-fill`
   and a visually hidden `changed`; a still-open step is a `DashedSlot`; no step there, an empty cell. Eight step columns fit the
   box; more scroll sideways inside it. Under the table, the one fact the table holds. */

import type { CSSProperties } from "react";

import { Avatar } from "@/components/brand/Avatar";
import { Checkbox } from "@/components/brand/Checkbox";
import { VisuallyHidden } from "@/components/brand/VisuallyHidden";
import { DashedSlot } from "@/components/vision/DashedSlot";
import { tileBox } from "@/components/vision/StepStripTiles";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { LineCell, LineUp } from "./postModel";

export const LINE_UP_TITLE = "Where the builds differ";
export const LINE_UP_META = "Each row is a build. Steps that changed are outlined.";

/** The width of a build's column and of each step's, so eight steps fit the main column before the box scrolls. */
const BUILD_COLUMN = 120;
const STEP_COLUMN = 96;

const text = (size: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: "16px", color, ...extra });

export function LineUpToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label style={{ ...text(12.5, t.text2), display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
      <Checkbox checked={on} onChange={(event) => onChange(event.target.checked)} />
      Line up steps
    </label>
  );
}

function Cell({ cell }: { cell: LineCell | null }) {
  if (!cell) return <td style={{ padding: 4 }} />;
  const words = <span style={{ ...text(12, t.text), overflowWrap: "anywhere" }}>{cell.title}</span>;
  return (
    <td style={{ padding: 4, verticalAlign: "top" }}>
      {cell.open ? (
        <DashedSlot style={{ padding: "8px", minHeight: 40 }}>
          {words}
          <VisuallyHidden> still open</VisuallyHidden>
        </DashedSlot>
      ) : (
        <div data-changed={cell.changed} style={{ ...tileBox, padding: 8, minHeight: 40, ...(cell.changed ? { background: t.selectedFill, border: `1px solid ${t.selectedEdge}` } : null) }}>
          {words}
          {cell.changed ? <VisuallyHidden> changed</VisuallyHidden> : null}
        </div>
      )}
    </td>
  );
}

export function LineUpTable({ lineUp }: { lineUp: LineUp }) {
  const numbers = Array.from({ length: lineUp.steps }, (_, at) => at + 1);
  return (
    <section aria-label={LINE_UP_TITLE} style={{ marginTop: 24, background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16 }}>
      <h3 style={text(14, t.text, { fontWeight: 500, lineHeight: 1.3 })}>{LINE_UP_TITLE}</h3>
      <p style={{ ...text(12, t.label), marginTop: 2 }}>{LINE_UP_META}</p>
      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%", minWidth: BUILD_COLUMN + lineUp.steps * STEP_COLUMN }}>
          <caption style={{ captionSide: "top", textAlign: "left" }}>
            <VisuallyHidden>{`${LINE_UP_TITLE}. ${LINE_UP_META}`}</VisuallyHidden>
          </caption>
          <colgroup>
            <col style={{ width: BUILD_COLUMN }} />
            {numbers.map((number) => (
              <col key={number} style={{ width: STEP_COLUMN }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" style={{ ...text(12, t.label, { fontWeight: 400 }), textAlign: "left", padding: 4 }}>
                Build
              </th>
              {numbers.map((number) => (
                <th key={number} scope="col" style={{ ...text(12, t.label, { fontWeight: 400 }), textAlign: "left", padding: 4 }}>{`Step ${number}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineUp.rows.map((row) => (
              <tr key={row.key}>
                <th scope="row" style={{ padding: 4, textAlign: "left", verticalAlign: "top", fontWeight: 400 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, ...text(12.5, t.text) }}>
                    {row.author ? <Avatar size={20} userId={row.author.id} name={row.author.name} src={row.author.avatarUrl} /> : null}
                    {row.name}
                  </span>
                </th>
                {row.cells.map((cell, at) => (
                  <Cell key={at} cell={cell} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lineUp.sentence ? <p style={{ ...text(12.5, t.text2, { lineHeight: "20px" }), marginTop: 12 }}>{lineUp.sentence}</p> : null}
    </section>
  );
}
