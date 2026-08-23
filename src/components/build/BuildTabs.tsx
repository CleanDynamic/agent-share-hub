// The five tabs of a build page. Only Anatomy is live.
//
// The other four are rendered and visibly disabled rather than omitted: the
// strip is the map of what a build record is going to hold, and a reader
// seeing "Watch it get built" greyed out learns more than a reader seeing
// nothing at all. NS-P06 turns Run it yourself on.

import type { CSSProperties, ReactNode } from "react";
import { HAIRLINE, ORANGE, TEXT_MUTED, TEXT_SECONDARY, labelText } from "./tokens";

interface BuildTabsProps {
  /** The Anatomy panel. The only tab with content in this prompt. */
  children: ReactNode;
}

interface TabDef {
  id: string;
  label: string;
  /** One line, shown under the label, for the four that are not built yet. */
  placeholder?: string;
}

const TABS: TabDef[] = [
  { id: "anatomy", label: "Anatomy" },
  { id: "watch", label: "Watch it get built", placeholder: "Event sequence — soon" },
  { id: "run", label: "Run it yourself", placeholder: "Build file — soon" },
  { id: "broke", label: "Where it broke", placeholder: "Breakages — soon" },
  { id: "forks", label: "Forks", placeholder: "Derived builds — soon" },
];

const tabBase: CSSProperties = {
  ...labelText,
  background: "transparent",
  border: "none",
  borderBottom: "2px solid transparent",
  padding: "10px 2px",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  alignItems: "flex-start",
  textAlign: "left",
  whiteSpace: "nowrap",
};

export function BuildTabs({ children }: BuildTabsProps) {
  return (
    <section data-visual-slot="build-tabs">
      <div
        role="tablist"
        aria-label="Build sections"
        style={{
          display: "flex",
          gap: 24,
          borderBottom: `1px solid ${HAIRLINE}`,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
          const active = tab.id === "anatomy";
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`build-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={active ? "build-panel-anatomy" : undefined}
              aria-disabled={!active}
              disabled={!active}
              style={{
                ...tabBase,
                color: active ? ORANGE : TEXT_MUTED,
                borderBottom: active ? `2px solid ${ORANGE}` : "2px solid transparent",
                cursor: active ? "default" : "not-allowed",
              }}
            >
              <span>{tab.label}</span>
              {tab.placeholder ? (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 300,
                    letterSpacing: 0,
                    color: TEXT_MUTED,
                  }}
                >
                  {tab.placeholder}
                </span>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 300, color: TEXT_SECONDARY }}>
                  &nbsp;
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="build-panel-anatomy"
        aria-labelledby="build-tab-anatomy"
        style={{ paddingTop: 24 }}
      >
        {children}
      </div>
    </section>
  );
}

export default BuildTabs;
