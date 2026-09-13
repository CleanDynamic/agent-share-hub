// The build header. The running artefact comes first, not the title.
//
// Resolution order for the hero slot:
//   1. builds.live_url, when the build is shaped 'app' — an iframe behind a
//      click-to-load poster, so nothing third-party runs until a reader asks.
//   2. the `hero` prop, when the page has resolved and signed one. A video
//      arrives here as a video and renders as a player (NS-P31); before that
//      every hero was flattened to a still and a recording could not be
//      watched from the top of its own build.
//   3. hero_node_id, when its payload already carries a loadable URL.
//   4. nothing at all, and the title leads.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Build, BuildNode, NodeTree, NodeType } from "@/lib/build";
import { CategoryChip } from "@/components/brand/CategoryChip";
import { Plaque } from "@/components/brand/Plaque";
import { categoryColour } from "@/lib/theme/category";
import { buttonStyle } from "@/lib/theme/controls";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { measure, tabular, type } from "@/lib/theme/type";

/* ── BG-P21 — the hero is a media well, not a card ────────────────────────────

   It was `cardGlass`: a translucent fill, a 1px ring all the way round and a
   12px radius, drawn around whatever the build's hero happened to be. That is a
   frame, and a gallery does not frame the work — the wall recedes and the piece
   stands on it. So the ring is gone, the ground is `--recess` (the token for a
   surface the page is cut INTO, which is what a media well is), and the only
   line left is a `--line` hairline along the top, where the header meets the
   record above it.

   `--r-media` on the media ITSELF and on the well around it, so the corners
   agree at every slot width: an image that fills the well and an image that
   letterboxes inside it are the same shape. All three variants take the same
   treatment — the live embed, the screenshot and the video with its poster —
   because they are one slot holding three kinds of thing, not three slots.
   ─────────────────────────────────────────────────────────────────────────── */

/** The well the hero sits in. Ground and hairline; no frame. */
const heroWell: CSSProperties = {
  background: t.recess,
  borderTop: `1px solid ${t.line}`,
  borderRadius: r.media,
  overflow: "hidden",
};

/** The media inside it. Its own radius, so it is right when it does not fill. */
const heroMedia: CSSProperties = {
  display: "block",
  width: "100%",
  height: "auto",
  borderRadius: r.media,
};

/**
 * The build's title.
 *
 * `type.hero` is the display role, and it is RE-CLAMPED here rather than taken
 * whole: the scale's own bound is 44–78px, struck for a page whose title is the
 * only thing above the fold. This one sits under a running artefact, and 78px
 * of Bodoni beneath a screenshot fights the screenshot for the reader's first
 * look — which `visual-hierarchy` says the artefact wins on this page. 40–64
 * keeps the face, the weight and the balance and gives the hero the room. The
 * lower bound is 40, twice the 20px floor the display face is held to.
 */
const buildTitle: CSSProperties = {
  ...type.hero,
  fontSize: "clamp(40px, 4.6vw, 64px)",
  margin: 0,
  color: t.text,
};

interface BuildHeaderProps {
  build: Build;
  tree: NodeTree[];
  nodeTypes: NodeType[];
  /** Header controls. NS-P06 passes the portable export pair. */
  actions?: ReactNode;
  /**
   * The reproduction and freshness block. Supplied by the page rather than
   * built here, because it writes: the header is a read-only surface and stays
   * one. Omitted, the slot falls back to the state NS-P04 shipped.
   */
  reproduction?: ReactNode;
  /**
   * The rebuild count, beside the reproduction block (NS-P40).
   *
   * A SEPARATE SLOT RATHER THAN PART OF THE ONE ABOVE, because the two numbers
   * are earned in different ways and are owned by different components: the
   * reproduction block writes, and this one only ever navigates. Passing it
   * here rather than folding it into `reproduction` also means it renders on
   * the fallback path too — a caller that has not supplied a reproduction
   * block still gets the second number in the same strip.
   *
   * Omitted, or rendering nothing, the strip is exactly what it was.
   */
  rebuilds?: ReactNode;
  /**
   * The hero, resolved and signed by the page.
   *
   * The header knows nothing about build_media and does not need to; what it
   * needs to know is whether the thing it is about to render MOVES, which a
   * payload URL cannot tell it. Omitted, the payload path below still runs, so
   * a caller that has not resolved a hero renders exactly what it used to.
   */
  hero?: HeroMedia;
}

/** A hero the page has already resolved: what it is, and where to get it. */
export interface HeroMedia {
  kind: "image" | "video";
  src: string;
  /** A video's still. Shown before play, and while it buffers. */
  poster?: string | null;
  alt: string;
}

/** Depth-first, in render order. The tree is three levels at most. */
function flatten(nodes: NodeTree[]): NodeTree[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

/**
 * A src the browser can actually load.
 *
 * A media_id is an opaque handle with no resolver in the data layer yet, so
 * only a payload that already carries a URL renders. Anything else falls
 * through to the title, which is the correct outcome until NS-P06 adds media
 * resolution.
 */
function resolveMediaSrc(node: BuildNode | undefined): string | null {
  if (!node?.payload || typeof node.payload !== "object") return null;
  const payload = node.payload as Record<string, unknown>;
  for (const key of ["media_url", "url", "media_id", "poster_url"]) {
    const value = payload[key];
    if (typeof value === "string" && /^(https?:\/\/|\/)/.test(value)) return value;
  }
  return null;
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function payloadString(node: BuildNode | undefined, key: string): string | null {
  if (!node?.payload || typeof node.payload !== "object") return null;
  const value = (node.payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function formatMoney(amount: number, currency: string | null): string {
  const code = (currency ?? "GBP").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

/**
 * A "made for" or "made with" chip.
 *
 * BG-P11: THESE WERE NOT CATEGORY CHIPS AND NOW THEY ARE. Each was a hairline
 * outline at `border-radius: 999` — the capsule the theme dropped by decision —
 * in a hardcoded teal or orange, which meant "made for founders" was painted
 * the same green the platform reserves for a configuration part and "made with
 * Claude" the same rust it reserves for an instruction. Both now resolve
 * through CategoryChip, which lands them on the measured FALLBACK pair: a role
 * and a tool are not part categories, the nine hues mean something specific,
 * and borrowing one for either would be the same untrue claim in a quieter
 * voice. The two rows stay apart by their labels, which is what the labels are
 * for.
 */
function Chip({ text }: { text: string }) {
  return <CategoryChip category={text} label={text} />;
}

/**
 * One fact in the strip: a mono label over a mono figure.
 *
 * EVENLY WEIGHTED, which is the correction BG-P21 makes. The label sat on the
 * third text rung and the figure on the first, so the strip read as four
 * headings with four captions — a hierarchy inside a row whose whole point is
 * that its members are peers. Both rungs are legal now, one step apart:
 * `--text2` names the fact, `--text` states it, and no fact out-weighs another.
 *
 * `tabular` is on the figure and not on the label, because only one of them has
 * digits that have to line up when a number changes under the reader.
 */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ ...type.eyebrow, color: t.text2 }}>{label}</span>
      <span style={{ ...type.data, ...tabular, color: t.text }}>{children}</span>
    </div>
  );
}

/** The click-to-load poster and, once asked for, the sandboxed frame. */
function LiveAppHero({
  url,
  credentialsNote,
}: {
  url: string;
  credentialsNote: string | null;
}) {
  const [loaded, setLoaded] = useState(false);

  const frame: CSSProperties = {
    ...heroWell,
    height: 420,
    position: "relative",
  };

  return (
    <div data-visual-slot="build-hero" style={frame}>
      {loaded ? (
        <iframe
          src={url}
          title="The running build"
          sandbox="allow-scripts allow-same-origin"
          loading="lazy"
          /* `--chrome-hi` rather than `#fff`: a third-party page arrives with
             its own ground and this is only what shows through where it has
             none. The token is white on Exhibition and a pale lavender on
             Dusk, so an embed with a transparent body does not flash a white
             rectangle into the dark room. */
          style={{ width: "100%", height: "100%", border: "none", background: t.chromeHi }}
        />
      ) : (
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <span style={{ ...type.eyebrow, color: t.evidence }}>The running build</span>
          {/* SECONDARY, NOT PRIMARY. Loading the embed is the hero's own
              affordance and the page already spends its one primary on
              "Rebuild this" — two filled `--action` buttons in one view is the
              rule the theme states as one per view, and the reader would be
              asked twice which thing matters most. */}
          <button
            type="button"
            onClick={() => setLoaded(true)}
            data-visual-slot="build-hero-load-button"
            style={{
              ...buttonStyle("secondary"),
              ...type.label,
              padding: "9px 18px",
            }}
          >
            Load it here
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ ...type.data, color: t.text2, textDecoration: "none" }}
          >
            {url}
          </a>
          {credentialsNote ? (
            <p style={{ ...type.body, ...measure, color: t.text2, margin: 0 }}>
              {credentialsNote}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function BuildHeader({
  build,
  tree,
  nodeTypes,
  actions,
  reproduction,
  rebuilds,
  hero,
}: BuildHeaderProps) {
  const placed = flatten(tree);
  const heroNode = build.hero_node_id
    ? placed.find((node) => node.id === build.hero_node_id)
    : undefined;

  const showLiveApp = Boolean(build.live_url) && build.shape === "app";
  const heroMediaSrc = showLiveApp ? null : hero?.src ?? resolveMediaSrc(heroNode);
  const heroAlt = hero?.alt ?? nonEmpty(heroNode?.title) ?? nonEmpty(build.title) ?? "Build hero";

  const prerequisites = placed.filter((node) => node.type === "prerequisite");
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));

  const hasCost = build.cost_setup !== null || build.cost_monthly !== null;

  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showLiveApp ? (
        <LiveAppHero
          url={build.live_url as string}
          credentialsNote={payloadString(heroNode, "credentials_note")}
        />
      ) : heroMediaSrc ? (
        <div data-visual-slot="build-hero" style={heroWell}>
          {hero?.kind === "video" ? (
            // Muted by default and never autoplaying: a build page opens in
            // silence, and preload="metadata" means the frames are fetched
            // when a reader asks for them rather than on arrival.
            //
            // `--porthole` behind the frames rather than `#000`: it is the
            // token for a media well's ground in each room, and a recording
            // that letterboxes should sit in the page's own dark rather than
            // in a black rectangle the light room has nowhere else.
            <video
              src={heroMediaSrc}
              poster={hero.poster ?? undefined}
              controls
              muted
              playsInline
              preload="metadata"
              aria-label={heroAlt}
              style={{ ...heroMedia, background: t.porthole }}
            >
              {heroAlt}
            </video>
          ) : (
            <img src={heroMediaSrc} alt={heroAlt} style={heroMedia} />
          )}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={buildTitle}>{build.title}</h1>
        {build.outcome ? (
          /* The outcome LEADS the prose, so it takes `bodyLarge` and the 68ch
             measure rather than the 680px the header carried — a cap in `ch`
             tracks the face, so the line stays inside the theme's 60–75
             characters at every size the clamp above can render. */
          <p style={{ ...type.bodyLarge, ...measure, margin: 0, color: t.text2 }}>
            {build.outcome}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div data-visual-slot="build-header-actions" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {actions}
        </div>
      ) : null}

      {(build.made_for?.length ?? 0) > 0 || (build.made_with?.length ?? 0) > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(build.made_for?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...type.eyebrow, color: t.text2 }}>Made for</span>
              {build.made_for.map((item) => (
                <Chip key={item} text={item} />
              ))}
            </div>
          ) : null}
          {(build.made_with?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...type.eyebrow, color: t.text2 }}>Made with</span>
              {build.made_with.map((item) => (
                <Chip key={item} text={item} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* The facts strip. Two `--line` rules and nothing else holding it: the
          row is a set of peers, and a fill or a card around it would make it
          an object competing with the hero above it. It already wraps, which
          is what carries it down to 390 — four facts become two rows of two
          rather than a strip that scrolls sideways. */}
      <div
        data-visual-slot="build-facts"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          padding: "16px 0",
          borderTop: `1px solid ${t.line}`,
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        {hasCost ? (
          <Fact label="Cost">
            {formatMoney(build.cost_setup ?? 0, build.currency)} to set up
            {build.cost_monthly !== null
              ? `, ${formatMoney(build.cost_monthly, build.currency)} a month`
              : null}
          </Fact>
        ) : null}

        {build.time_to_first_result !== null ? (
          <Fact label="Speed">
            first result in {build.time_to_first_result} minutes
          </Fact>
        ) : null}

        {/* BG-P11: the fallback is the shared plaque. It used to be this file's
            own rendering, and it had already drifted — it printed a raw
            toLocaleDateString and never named the model, so the same build said
            "on Sonnet 4.5" on its card and said nothing about the model on its
            own page. The model always travels with the claim. */}
        {reproduction ?? (
          <div data-visual-slot="build-reproduction" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ ...type.eyebrow, color: t.text2 }}>Reproduction</span>
            <Plaque build={build} size="header" />
          </div>
        )}

        {rebuilds}
      </div>

      {prerequisites.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...type.eyebrow, color: t.text2 }}>Before you start</span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {prerequisites.map((node) => {
              const requirement = payloadString(node, "requirement");
              return (
                <li
                  key={node.id}
                  style={{ ...type.body, ...measure, color: t.text, display: "flex", gap: 8 }}
                >
                  {/* BG-P05: the dash is the prerequisite's category, resolved
                      through the theme, not the registry row's stored colour. */}
                  <span style={{ color: categoryColour(typesByKey.get(node.type)?.category ?? "") }}>
                    —
                  </span>
                  <span>
                    {node.title}
                    {requirement ? (
                      <span style={{ color: t.text2 }}> · {requirement}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </header>
  );
}

export default BuildHeader;
