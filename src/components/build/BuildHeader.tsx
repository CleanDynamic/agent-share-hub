// The build header. The running artefact comes first, not the title.
//
// Resolution order for the hero slot:
//   1. builds.live_url, when the build is shaped 'app' — an iframe behind a
//      click-to-load poster, so nothing third-party runs until a reader asks.
//   2. hero_node_id, when it resolves to a placed node carrying media.
//   3. nothing at all, and the title leads.

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Build, BuildNode, NodeTree, NodeType } from "@/lib/build";
import {
  HAIRLINE,
  ORANGE,
  TEAL,
  TEXT_MUTED,
  TEXT_SECONDARY,
  bodyText,
  cardGlass,
  labelText,
  pageHeadingText,
} from "./tokens";

interface BuildHeaderProps {
  build: Build;
  tree: NodeTree[];
  nodeTypes: NodeType[];
  /** Header controls. NS-P06 passes the portable export pair. */
  actions?: ReactNode;
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

function Chip({ text, colour }: { text: string; colour: string }) {
  return (
    <span
      style={{
        ...labelText,
        color: colour,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
      }}
    >
      {text}
    </span>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ ...bodyText, fontWeight: 400 }}>{children}</span>
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
    ...cardGlass,
    overflow: "hidden",
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
          style={{ width: "100%", height: "100%", border: "none", background: "#fff" }}
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
          <span style={{ ...labelText, color: TEAL, fontSize: 11, textTransform: "uppercase" }}>
            The running build
          </span>
          <button
            type="button"
            onClick={() => setLoaded(true)}
            data-visual-slot="build-hero-load-button"
            style={{
              ...labelText,
              color: "#08080C",
              background: ORANGE,
              border: "none",
              borderRadius: 8,
              padding: "9px 18px",
              cursor: "pointer",
            }}
          >
            Load it here
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            style={{ ...bodyText, color: TEXT_SECONDARY, textDecoration: "none" }}
          >
            {url}
          </a>
          {credentialsNote ? (
            <p style={{ ...bodyText, color: TEXT_MUTED, margin: 0, maxWidth: 520 }}>
              {credentialsNote}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function BuildHeader({ build, tree, nodeTypes, actions }: BuildHeaderProps) {
  const placed = flatten(tree);
  const heroNode = build.hero_node_id
    ? placed.find((node) => node.id === build.hero_node_id)
    : undefined;

  const showLiveApp = Boolean(build.live_url) && build.shape === "app";
  const heroMediaSrc = showLiveApp ? null : resolveMediaSrc(heroNode);

  const prerequisites = placed.filter((node) => node.type === "prerequisite");
  const typesByKey = new Map(nodeTypes.map((type) => [type.key, type]));

  const hasCost = build.cost_setup !== null || build.cost_monthly !== null;
  const confirmed = (build.reproduction_count ?? 0) > 0 || Boolean(build.last_confirmed_at);

  return (
    <header style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showLiveApp ? (
        <LiveAppHero
          url={build.live_url as string}
          credentialsNote={payloadString(heroNode, "credentials_note")}
        />
      ) : heroMediaSrc ? (
        <div data-visual-slot="build-hero" style={{ ...cardGlass, overflow: "hidden" }}>
          <img
            src={heroMediaSrc}
            alt={heroNode?.title ?? build.title}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <h1 style={{ ...pageHeadingText, margin: 0 }}>{build.title}</h1>
        {build.outcome ? (
          <p style={{ ...bodyText, margin: 0, color: TEXT_SECONDARY, maxWidth: 680 }}>
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
              <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>Made for</span>
              {build.made_for.map((item) => (
                <Chip key={item} text={item} colour={TEAL} />
              ))}
            </div>
          ) : null}
          {(build.made_with?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED }}>Made with</span>
              {build.made_with.map((item) => (
                <Chip key={item} text={item} colour={ORANGE} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 28,
          padding: "16px 0",
          borderTop: `1px solid ${HAIRLINE}`,
          borderBottom: `1px solid ${HAIRLINE}`,
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

        <div data-visual-slot="build-reproduction" style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
            Reproduction
          </span>
          {confirmed ? (
            <span style={{ ...bodyText, fontWeight: 400 }}>
              reproduced {build.reproduction_count}{" "}
              {build.reproduction_count === 1 ? "time" : "times"}
              {build.last_confirmed_at
                ? ` · last confirmed ${new Date(build.last_confirmed_at).toLocaleDateString()}`
                : null}
            </span>
          ) : (
            <span style={{ ...bodyText, fontWeight: 400, color: TEXT_MUTED }}>
              not yet confirmed by anyone
            </span>
          )}
        </div>
      </div>

      {prerequisites.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ ...labelText, fontSize: 11, color: TEXT_MUTED, textTransform: "uppercase" }}>
            Before you start
          </span>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            {prerequisites.map((node) => {
              const requirement = payloadString(node, "requirement");
              return (
                <li key={node.id} style={{ ...bodyText, display: "flex", gap: 8 }}>
                  <span style={{ color: typesByKey.get(node.type)?.colour ?? TEXT_MUTED }}>—</span>
                  <span>
                    {node.title}
                    {requirement ? (
                      <span style={{ color: TEXT_SECONDARY }}> · {requirement}</span>
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
