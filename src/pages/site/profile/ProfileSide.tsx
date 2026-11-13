/* UX-10 P7 and P9: the profile's side column. PURE: typed props, no fetching.

   280 wide beside the feed. Each section is a `module` box headed with `SectionHead`, in the owner's order, and a section that is
   hidden or empty is not drawn:

     about        the About (line breaks kept, as plain text), and `Works in`: the tools and models of their published builds
     spaces       the spaces they belong to, each a PlainRow with their standing (Created, Moderator or Member), up to 5, then Show all
     others       What others did with it: up to three lines, each a count and a link, each gone at zero
     collections  the collections module, as the old profile drew it
     marks        the earned marks as plain type chips: no tiers

   YOUR PROGRESS (P9) is a module at the top for the owner only, whatever level_visible says: Level, the XP line (the one place XP
   is said), the streak when there is one, and the four tracks as a Segmented that writes where it always has. No ring, no glow.

   ON A PHONE the column is one collapsed `About` row under the head, which opens in place. */

import { useState, type CSSProperties, type ReactNode } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { PostControl } from "@/components/post/postControls";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { PlainRow } from "@/components/vision/PlainRow";
import { SectionHead } from "@/components/vision/SectionHead";
import { TypeChip } from "@/components/vision/TypeChip";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { OthersLine } from "./profileFeedModel";

export const SIDE_WIDTH = 280;

export type SideSectionKey = "about" | "spaces" | "others" | "collections" | "marks";

export interface SideCollection {
  key: string;
  to: string;
  title: string;
  /** "4 builds". */
  count: string;
  covers: readonly ReactNode[];
}

export interface SideSpace {
  slug: string;
  name: string;
  /** Created, Moderator or Member. */
  standing: string;
}

export type TrackValue = "architect" | "curator" | "mentor" | "explorer";

export interface ProgressView {
  level: number;
  /** "1,840 / 2,400 xp", or null when not known. */
  xpLine: string | null;
  /** "12-day streak", or null when there is none. */
  streak: string | null;
  track: TrackValue | null;
  tracks: readonly { value: TrackValue; label: string }[];
  onTrack: (track: TrackValue) => void;
}

export interface ProfileSideProps {
  /** The owner's order, with each section's hidden flag. */
  order: readonly { key: SideSectionKey; hidden: boolean }[];
  about: string | null;
  worksIn: readonly string[];
  spaces: readonly SideSpace[];
  others: readonly OthersLine[];
  collections: readonly SideCollection[];
  marks: readonly string[];
  /** Your own profile only. */
  progress: ProgressView | null;
}

export const SIDE_TITLES: Record<SideSectionKey, string> = {
  about: "About",
  spaces: "In spaces",
  others: "What others did with it",
  collections: "Collections",
  marks: "Marks",
};

export const PROGRESS_TITLE = "Your progress";

const MODULE: CSSProperties = {
  boxSizing: "border-box",
  background: t.module,
  border: `1px solid ${t.moduleBorder}`,
  borderRadius: 8,
  boxShadow: t.moduleShadow,
  padding: 16,
  minWidth: 0,
};

const BODY: CSSProperties = { fontFamily: FIGTREE, fontSize: 13, lineHeight: "20px", color: t.text2 };

function Module({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} data-testid={`profile-side-${id}`} style={MODULE}>
      <SectionHead title={title} headingLevel={2} />
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function CollectionTile({ tile }: { tile: SideCollection }) {
  const cells = tile.covers.slice(0, 4);
  return (
    <Link
      to={tile.to}
      data-testid="profile-collection"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: 4,
        background: t.inset,
        border: `1px solid ${t.tileBorder}`,
        borderRadius: r.card,
        boxSizing: "border-box",
        textDecoration: "none",
        color: t.text,
        minWidth: 0,
      }}
    >
      <div style={{ height: 64, borderRadius: r.media, overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2 }}>
        {cells.map((cover, index) => (
          <div key={index} style={{ position: "relative", overflow: "hidden", minHeight: 0 }}>
            {cover}
          </div>
        ))}
      </div>
      <div style={{ padding: "0 4px 4px", display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <h3 style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 500, lineHeight: 1.3, margin: 0, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tile.title}</h3>
        <div style={{ fontFamily: FIGTREE, fontSize: 11, lineHeight: "normal", color: t.text2 }}>{tile.count}</div>
      </div>
    </Link>
  );
}

function Spaces({ spaces }: { spaces: readonly SideSpace[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? spaces : spaces.slice(0, 5);
  return (
    <>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {shown.map((space, index) => (
          <PlainRow
            key={space.slug}
            as="li"
            last={index === shown.length - 1}
            label={
              <Link to={`/openbuilds/spaces/${space.slug}`} style={{ color: t.text, textDecoration: "none" }}>
                {space.name}
              </Link>
            }
            value={<span style={{ fontWeight: 400, color: t.label, fontSize: 12 }}>{space.standing}</span>}
          />
        ))}
      </ul>
      {spaces.length > 5 && !all ? (
        <div style={{ marginTop: 8 }}>
          <PostControl onClick={() => setAll(true)}>Show all</PostControl>
        </div>
      ) : null}
    </>
  );
}

/** Whether a section has anything to draw. */
export function sectionHasContent(key: SideSectionKey, props: Pick<ProfileSideProps, "about" | "worksIn" | "spaces" | "others" | "collections" | "marks">): boolean {
  switch (key) {
    case "about":
      return Boolean(props.about?.trim()) || props.worksIn.length > 0;
    case "spaces":
      return props.spaces.length > 0;
    case "others":
      return props.others.length > 0;
    case "collections":
      return props.collections.length > 0;
    case "marks":
      return props.marks.length > 0;
  }
}

function Section({ id, props }: { id: SideSectionKey; props: ProfileSideProps }) {
  switch (id) {
    case "about":
      return (
        <Module id="about" title={SIDE_TITLES.about}>
          {props.about?.trim() ? <p style={{ ...BODY, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{props.about.trim()}</p> : null}
          {props.worksIn.length > 0 ? (
            <div data-testid="profile-works-in" style={{ marginTop: props.about?.trim() ? 12 : 0 }}>
              <div style={{ fontFamily: FIGTREE, fontSize: 12, color: t.label }}>Works in</div>
              <div style={{ ...BODY, color: t.text }}>{props.worksIn.join(" · ")}</div>
            </div>
          ) : null}
        </Module>
      );
    case "spaces":
      return (
        <Module id="spaces" title={SIDE_TITLES.spaces}>
          <Spaces spaces={props.spaces} />
        </Module>
      );
    case "others":
      return (
        <Module id="others" title={SIDE_TITLES.others}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {props.others.map((line) => (
              <li key={line.key} style={{ ...BODY, fontVariantNumeric: "tabular-nums" }}>
                <Link to={line.to} style={{ color: t.text2, textDecoration: "none" }}>
                  {line.text}
                </Link>
              </li>
            ))}
          </ul>
        </Module>
      );
    case "collections":
      return (
        <Module id="collections" title={SIDE_TITLES.collections}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {props.collections.map((tile) => (
              <CollectionTile key={tile.key} tile={tile} />
            ))}
          </div>
        </Module>
      );
    case "marks":
      return (
        <Module id="marks" title={SIDE_TITLES.marks}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {props.marks.map((mark) => (
              <TypeChip key={mark}>{mark}</TypeChip>
            ))}
          </div>
        </Module>
      );
  }
}

function Progress({ progress }: { progress: ProgressView }) {
  return (
    <section aria-label={PROGRESS_TITLE} data-testid="profile-progress" style={MODULE}>
      <SectionHead title={PROGRESS_TITLE} meta={`Level ${progress.level}`} headingLevel={2} />
      <div style={{ ...BODY, marginTop: 12, display: "flex", flexDirection: "column", gap: 4, fontVariantNumeric: "tabular-nums" }}>
        {progress.xpLine ? <span>{progress.xpLine}</span> : null}
        {progress.streak ? <span>{progress.streak}</span> : null}
      </div>
      {/* The four tracks need about 260 of the column's 248: the picker runs into the module's padding rather than past its edge. */}
      <div style={{ marginTop: 12, marginLeft: -12, marginRight: -12 }}>
        <Segmented<TrackValue> label="Track" semantics="radio" size={28} items={progress.tracks} value={progress.track ?? ("" as TrackValue)} onChange={progress.onTrack} fullWidth compact fontSize={11} />
      </div>
    </section>
  );
}

export function ProfileSide(props: ProfileSideProps) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const sections = props.order.filter((section) => !section.hidden && sectionHasContent(section.key, props));
  const column = (
    <div data-testid="profile-side" style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
      {props.progress ? <Progress progress={props.progress} /> : null}
      {sections.map((section) => (
        <Section key={section.key} id={section.key} props={props} />
      ))}
    </div>
  );
  if (!props.progress && sections.length === 0) return null;
  // Up to 280, and no wider than the page grid's side track (264 at 1280).
  if (!phone) return <aside aria-label="About this person" style={{ width: "100%", maxWidth: SIDE_WIDTH, flex: "none", minWidth: 0 }}>{column}</aside>;
  return (
    <aside aria-label="About this person" style={{ minWidth: 0 }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="profile-side-panel"
        onClick={() => setOpen((was) => !was)}
        style={{ ...MODULE, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: 44, padding: "0 16px", cursor: "pointer", fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, color: t.text }}
      >
        <span>{SIDE_TITLES.about}</span>
        <span aria-hidden="true" style={{ color: t.label }}>
          {open ? "−" : "+"}
        </span>
      </button>
      <div id="profile-side-panel" hidden={!open} style={{ marginTop: 12 }}>
        {open ? column : null}
      </div>
    </aside>
  );
}

export default ProfileSide;
