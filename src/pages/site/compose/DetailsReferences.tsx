/* CA-18b P3: colour and references at the foot of Details (board "Details: colour and references").

   READ ONLY. Open group, a component's row and Go to it open, select or scroll; nothing here edits. The page gives what it
   knows through `DetailsReferencesProvider`; with no provider (a dev page without references) there is no section. */

import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";

import { Button } from "@/components/brand/Button";
import { refPaint, refWordsStyle } from "@/components/post/RefLinks";
import { useResolvedTheme } from "@/contexts/ThemeContext";
import type { RefEntry } from "@/lib/build/postRefs";
import type { ColourModel } from "@/lib/build/referenceGroups";
import { nameColourFor } from "@/lib/theme/partColour";
import { t } from "@/lib/theme/tokens";

import { DETAILS_REFS_COPY as COPY, referenceSectionOf, alsoUsedByLine, type LinkedWords, type MemberRow, type ReferenceSection } from "./detailsReferences";
import { REFS_BLOCK_ABOVE, REFS_BUTTON_PAD, REFS_LABEL_TO_TEXT, REFS_NOTES_ABOVE, REFS_PANEL, REFS_READ_ALL_ABOVE, REFS_ROW_GAP, REFS_ROW_HEIGHT, SECTION_BREAK, SECTION_COUNT, SECTION_LABEL, VALUE } from "./detailsRecipes";
import { TextLink } from "./modalRecipes";
import { Badge, SquareSwatch, data, words, ELLIPSIS } from "./referencePieces";

export interface DetailsReferencesValue {
  model: ColourModel;
  lookup: ReadonlyMap<string, RefEntry>;
  /** The words in the post that link to a target. */
  linked: (to: string) => LinkedWords | null;
  /** Selects a component. */
  onSelect?: (to: string) => void;
  /** Scrolls to the linked words of a target and outlines them. */
  onGoTo?: (to: string) => void;
  /** Opens the reference group's window (read only for a reader). Absent: no Open group. */
  onOpenGroup?: (groupId: string) => void;
}

const Context = createContext<DetailsReferencesValue | null>(null);

export function DetailsReferencesProvider({ value, children }: { value: DetailsReferencesValue; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** The section for a component, or null: none provided, or nothing to say. */
export function useReferenceSection(to: string | null | undefined): { section: ReferenceSection; value: DetailsReferencesValue } | null {
  const value = useContext(Context);
  return useMemo(() => {
    if (!value || !to) return null;
    const section = referenceSectionOf({ to, model: value.model, lookup: value.lookup, linked: value.linked });
    return section ? { section, value } : null;
  }, [value, to]);
}

const PANEL = REFS_PANEL;
const SMALL_LABEL: CSSProperties = words(12, 400, t.label, 18);

function LinkedBlock({ linked, colour, number, label, onGoTo, top }: { linked: LinkedWords & { to: string }; colour: string | null; number: string; label: boolean; onGoTo?: (to: string) => void; top: number }) {
  const theme = useResolvedTheme();
  return (
    <div data-testid="details-refs-linked" style={{ marginTop: top, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      {label ? <span style={SMALL_LABEL}>{COPY.linkedText}</span> : null}
      <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <span data-testid="details-refs-words" style={{ ...words(13, 400, t.text), ...refWordsStyle(refPaint({ colour, number }, theme)), ...ELLIPSIS, cursor: "default" }}>
          {linked.words}
        </span>
        <span style={{ ...data(11, t.label), flexGrow: 1, whiteSpace: "nowrap" }}>{`Post ${linked.post}`}</span>
        {onGoTo ? <TextLink onClick={() => onGoTo(linked.to)}>{COPY.goTo}</TextLink> : null}
      </span>
    </div>
  );
}

function Rows({ rows, onSelect }: { rows: readonly MemberRow[]; onSelect?: (to: string) => void }) {
  return (
    <div role="list" style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      {rows.map((row, at) => (
        <div key={row.to} role="listitem" style={{ minWidth: 0 }}>
          <button
            type="button"
            data-testid="details-refs-member"
            data-current={row.current ? "true" : undefined}
            onClick={() => onSelect?.(row.to)}
            style={{ appearance: "none", background: "none", borderWidth: at > 0 ? "1px 0 0" : 0, borderStyle: "solid", borderColor: t.hairline, margin: 0, padding: 0, width: "100%", height: REFS_ROW_HEIGHT, boxSizing: "border-box", display: "flex", alignItems: "center", gap: REFS_ROW_GAP, textAlign: "left", cursor: onSelect ? "pointer" : "default", color: "inherit", minWidth: 0 }}
          >
            <Badge>{row.badge}</Badge>
            <span style={{ ...words(13, 500, t.text), ...ELLIPSIS, flexGrow: 1 }}>{row.name}</span>
            <span style={{ ...words(12.5, 400, t.text2), whiteSpace: "nowrap" }}>{row.kind}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h4 style={SECTION_LABEL}>{title}</h4>
      {sub ? <p data-testid="details-refs-sub" style={SECTION_COUNT}>{sub}</p> : null}
    </div>
  );
}

/** The section: a rule with 22 above and below unless it is first in its column, then its head and its one panel. `clamp` cuts the notes. */
export function ColourReferences({ section, value, first = false, clamp }: { section: ReferenceSection; value: DetailsReferencesValue; first?: boolean; clamp?: number }) {
  const theme = useResolvedTheme();
  const frame: CSSProperties = { position: "relative", minWidth: 0, ...(first ? null : SECTION_BREAK) };
  if (section.state === "linked") {
    return (
      <section data-testid="details-refs" data-state="linked" aria-label={COPY.linkedText} style={frame}>
        <Head title={COPY.linkedText} />
        <div style={VALUE}>
          <LinkedBlock linked={section.linked} colour={null} number="" label={false} onGoTo={value.onGoTo} top={0} />
        </div>
      </section>
    );
  }
  if (section.state === "single") {
    return (
      <section data-testid="details-refs" data-state="single" aria-label={COPY.colourHead} style={frame}>
        <Head title={COPY.colourHead} sub={COPY.setOn(section.word)} />
        <div style={VALUE}>
          <div data-testid="details-refs-panel" style={PANEL}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <SquareSwatch colour={section.colour} size={10} />
              <span style={words(13, 500, t.text)}>{COPY.single}</span>
              <span style={{ ...data(11.5, t.label), marginLeft: -4 }}>{` · ${section.colour.toUpperCase()}`}</span>
            </span>
            {section.linked ? <LinkedBlock linked={section.linked} colour={section.colour} number="" label top={REFS_BLOCK_ABOVE} onGoTo={value.onGoTo} /> : null}
            {section.alsoUsedBy.length > 0 ? <span data-testid="details-refs-also" style={{ ...SMALL_LABEL, marginTop: REFS_BLOCK_ABOVE }}>{alsoUsedByLine(section.alsoUsedBy)}</span> : null}
          </div>
        </div>
      </section>
    );
  }
  const { group } = section;
  const ink = nameColourFor(group.colour, theme, "tile");
  return (
    <section data-testid="details-refs" data-state="group" aria-label={COPY.groupHead} style={frame}>
      <Head title={COPY.groupHead} sub={COPY.sharesWith(section.others)} />
      <div style={VALUE}>
        <div data-testid="details-refs-panel" style={{ ...PANEL, boxShadow: `inset 3px 0 0 ${group.colour}` }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <SquareSwatch colour={group.colour} size={10} />
            <span data-testid="details-refs-name" style={{ ...words(13, 500, group.name ? ink : t.text2), ...ELLIPSIS }}>{group.name ?? COPY.noName}</span>
            <span style={{ ...words(12.5, 400, t.label), whiteSpace: "nowrap", marginLeft: -4, flexGrow: 1 }}>{` · ${COPY.components(group.members.length)}`}</span>
            {value.onOpenGroup ? (
              <Button variant="secondary" size={28} fontSize={12} onClick={() => value.onOpenGroup?.(group.id)} style={{ padding: REFS_BUTTON_PAD, flexShrink: 0 }}>
                {COPY.openGroup}
              </Button>
            ) : null}
          </span>
          {section.notes ? (
            <>
              <span style={{ ...SMALL_LABEL, marginTop: REFS_NOTES_ABOVE }}>{COPY.notes}</span>
              <p data-testid="details-refs-notes" data-prose="true" style={{ ...words(13, 400, t.text, 20), margin: 0, marginTop: REFS_LABEL_TO_TEXT, whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...(clamp ? { maxHeight: clamp, overflow: "hidden" } : null) }}>
                {section.notes}
              </p>
              {clamp && value.onOpenGroup ? (
                <div style={{ marginTop: REFS_READ_ALL_ABOVE }}>
                  <Button variant="secondary" size={28} fontSize={12} onClick={() => value.onOpenGroup?.(group.id)} style={{ padding: REFS_BUTTON_PAD }}>
                    {COPY.readAll}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
          <span style={{ ...SMALL_LABEL, marginTop: REFS_BLOCK_ABOVE }}>{COPY.componentsLabel}</span>
          <div style={{ marginTop: REFS_LABEL_TO_TEXT }}>
            <Rows rows={section.members} onSelect={value.onSelect} />
          </div>
          {section.linked ? <LinkedBlock linked={section.linked} colour={group.colour} number={group.name ?? "Group"} label top={REFS_BLOCK_ABOVE} onGoTo={value.onGoTo} /> : null}
        </div>
      </div>
    </section>
  );
}
