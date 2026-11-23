/* UX-10 P7 and P9, restyled by Synth 12 Part A: the profile's side panel. PURE: typed props, no fetching.

   One panel (Panel fill, radius 12) beside the feed: 340 from 1101, 300 from 761 to 1100; below that the sections follow the
   feed. Each section is headed by its fact, in the owner's order, and a section that is hidden or empty is not drawn:

     about        "About": the About, line breaks kept, as plain text
     spaces       "3 spaces": each space and their standing (Created, Moderator or Member), up to 5, then Show all
     others       "What others did with it": up to three lines, each a count and a link, each gone at zero
     collections  "2 collections"
     marks        "Marks": the earned marks, joined by " · "

   YOUR PROGRESS (P9) is a section at the top for the owner only: Level, the XP line, the streak and the track picker.
   The "Works in" tool list is gone. */

import { useState, type CSSProperties, type ReactNode } from "react";

import { Segmented } from "@/components/brand/Segmented";
import { PostControl } from "@/components/post/postControls";
import { PageLink as Link } from "@/lib/routing/PageLink";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { FIGTREE } from "@/lib/theme/type";

import type { OthersLine } from "./profileFeedModel";

export const SIDE_WIDTH = 340;

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
  /** Kept for callers; Synth 12 no longer draws the "Works in" list. */
  worksIn?: readonly string[];
  spaces: readonly SideSpace[];
  others: readonly OthersLine[];
  collections: readonly SideCollection[];
  marks: readonly string[];
  /** Your own profile only. */
  progress: ProgressView | null;
}

export const SIDE_TITLES: Record<SideSectionKey, string> = {
  about: "About",
  spaces: "Spaces",
  others: "What others did with it",
  collections: "Collections",
  marks: "Marks",
};

const plural = (n: number, one: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : `${one}s`}`;

/** The heading a section shows: its fact where it has a count ("3 spaces", "2 collections"). */
export function sideHeading(key: SideSectionKey, props: Pick<ProfileSideProps, "spaces" | "collections">): string {
  if (key === "spaces") return plural(props.spaces.length, "space");
  if (key === "collections") return plural(props.collections.length, "collection");
  return SIDE_TITLES[key];
}

export const PROGRESS_TITLE = "Your progress";

/** A section inside the side panel: no box of its own. */
const MODULE: CSSProperties = {
  boxSizing: "border-box",
  padding: "0 16px",
  minWidth: 0,
};

const BODY: CSSProperties = { fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px", color: t.text2 };
const HEAD: CSSProperties = { margin: 0, fontFamily: FIGTREE, fontSize: 17, fontWeight: 600, lineHeight: "24px", color: t.text };

function Module({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-label={title} data-testid={`profile-side-${id}`} style={MODULE}>
      <h2 style={HEAD}>{title}</h2>
      <div style={{ marginTop: 8 }}>{children}</div>
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
        background: t.module,
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
        <h3 style={{ fontFamily: FIGTREE, fontSize: 13, fontWeight: 600, lineHeight: "16px", margin: 0, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tile.title}</h3>
        <div style={{ fontFamily: FIGTREE, fontSize: 13, lineHeight: "16px", color: t.label }}>{tile.count}</div>
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
        {shown.map((space) => (
          <li key={space.slug} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 36, fontFamily: FIGTREE, fontSize: 15, lineHeight: "20px" }}>
            <Link to={`/openbuilds/spaces/${space.slug}`} style={{ color: t.text, textDecoration: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {space.name}
            </Link>
            <span style={{ color: t.label, fontSize: 13, flex: "none" }}>{space.standing}</span>
          </li>
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
export function sectionHasContent(key: SideSectionKey, props: Pick<ProfileSideProps, "about" | "spaces" | "others" | "collections" | "marks">): boolean {
  switch (key) {
    case "about":
      return Boolean(props.about?.trim());
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
          <p style={{ ...BODY, color: t.text, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{props.about?.trim()}</p>
        </Module>
      );
    case "spaces":
      return (
        <Module id="spaces" title={sideHeading("spaces", props)}>
          <Spaces spaces={props.spaces} />
        </Module>
      );
    case "others":
      return (
        <Module id="others" title={SIDE_TITLES.others}>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {props.others.map((line) => (
              <li key={line.key} style={{ ...BODY, fontVariantNumeric: "tabular-nums" }}>
                <Link to={line.to} style={{ color: t.text, textDecoration: "none" }}>
                  {line.text}
                </Link>
              </li>
            ))}
          </ul>
        </Module>
      );
    case "collections":
      return (
        <Module id="collections" title={sideHeading("collections", props)}>
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
          <p style={{ ...BODY, margin: 0 }}>{props.marks.join(" · ")}</p>
        </Module>
      );
  }
}

function Progress({ progress }: { progress: ProgressView }) {
  return (
    <section aria-label={PROGRESS_TITLE} data-testid="profile-progress" style={MODULE}>
      <h2 style={HEAD}>{PROGRESS_TITLE}</h2>
      <div style={{ ...BODY, marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontVariantNumeric: "tabular-nums" }}>
        <span>{`Level ${progress.level}`}</span>
        {progress.xpLine ? <span>{progress.xpLine}</span> : null}
        {progress.streak ? <span>{progress.streak}</span> : null}
      </div>
      {/* The four tracks are wider than the side panel: they scroll inside it rather than spill past its edge. */}
      <div style={{ marginTop: 12, overflowX: "auto", paddingBottom: 2 }}>
        <Segmented<TrackValue> label="Track" semantics="radio" size={28} items={progress.tracks} value={progress.track ?? ("" as TrackValue)} onChange={progress.onTrack} compact fontSize={13} />
      </div>
    </section>
  );
}

export function ProfileSide(props: ProfileSideProps) {
  const sections = props.order.filter((section) => !section.hidden && sectionHasContent(section.key, props));
  if (!props.progress && sections.length === 0) return null;
  return (
    <aside aria-label="About this person" style={{ minWidth: 0, background: t.surface, borderRadius: 12, padding: "16px 0", boxSizing: "border-box" }}>
      <div data-testid="profile-side" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        {props.progress ? <Progress progress={props.progress} /> : null}
        {sections.map((section) => (
          <Section key={section.key} id={section.key} props={props} />
        ))}
      </div>
    </aside>
  );
}

export default ProfileSide;
