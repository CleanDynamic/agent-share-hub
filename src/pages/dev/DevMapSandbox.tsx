/* MS-00 — /dev/map-sandbox: the map sandbox's fixtures, where every MS prompt shows its work.

   For now: a fixture picker and, for the chosen fixture, its links as sentences (`tileLinksOf`) and what `mapLayoutOf`
   reads from its `making`. Later prompts add the canvas. Nothing is written.

   DEV ONLY: registered behind `import.meta.env.DEV` in App.tsx. `?fixture=<name>` opens on a fixture. */

import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { useDesignTheme } from "@/dev/useDesignTheme";
import { MAP_SANDBOX_NAMES, mapSandboxFixture, type MapSandboxName } from "@/dev/fixtures/mapSandbox";
import { mapLayoutOf } from "@/lib/build/mapLayout";
import { tileLinksOf } from "@/lib/build/sessionMap";
import { r } from "@/lib/theme/radius";
import { space } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, textStep } from "@/lib/theme/type";

export const DEV_MAP_SANDBOX_COPY = {
  fixture: "Fixture",
  links: (count: number) => (count === 1 ? "1 link" : `${count} links`),
  noLinks: "No tile uses another.",
  tiles: (tiles: number, sessions: number) => `${tiles} ${tiles === 1 ? "tile" : "tiles"} in ${sessions} ${sessions === 1 ? "session" : "sessions"}`,
  layout: "Stored layout",
  noLayout: "None stored. The map starts from the build.",
};

const isName = (value: string | null): value is MapSandboxName => MAP_SANDBOX_NAMES.includes(value as MapSandboxName);

const HEADING = { fontSize: textStep.section, fontWeight: 600, lineHeight: "24px", margin: 0, color: t.text } as const;

export default function DevMapSandbox() {
  const theme = useDesignTheme();
  const [params, setParams] = useSearchParams();
  const asked = params.get("fixture");
  const name: MapSandboxName = isName(asked) ? asked : "supportInbox";
  const fixture = useMemo(() => mapSandboxFixture(name), [name]);
  const links = useMemo(() => tileLinksOf(fixture.steps, fixture.files), [fixture]);
  const layout = useMemo(() => mapLayoutOf(fixture.making), [fixture]);
  const tiles = fixture.steps.length + fixture.results.length;

  return (
    <main
      data-design-page="map-sandbox"
      data-design-theme={theme}
      style={{ minHeight: "100vh", background: t.bg, color: t.text, fontFamily: FIGTREE, padding: space[6], boxSizing: "border-box", display: "flex", flexDirection: "column", gap: space[6] }}
    >
      <label style={{ display: "flex", alignItems: "center", gap: space[2], fontSize: textStep.body, color: t.text2 }}>
        {DEV_MAP_SANDBOX_COPY.fixture}
        <select
          data-testid="map-sandbox-fixture"
          value={name}
          onChange={(event) => setParams({ fixture: event.target.value })}
          style={{ fontFamily: FIGTREE, fontSize: textStep.body, color: t.text, background: t.control, border: `1px solid ${t.hairline}`, borderRadius: r.control, padding: `${space[1]}px ${space[2]}px` }}
        >
          {MAP_SANDBOX_NAMES.map((option) => (
            <option key={option} value={option}>
              {mapSandboxFixture(option).label}
            </option>
          ))}
        </select>
      </label>

      <section aria-labelledby="map-sandbox-links" style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
        <h1 id="map-sandbox-links" style={HEADING}>
          {DEV_MAP_SANDBOX_COPY.tiles(tiles, fixture.groups.filter((group) => !group.implicit).length)}, {DEV_MAP_SANDBOX_COPY.links(links.length)}
        </h1>
        {links.length === 0 ? (
          <p style={{ margin: 0, fontSize: textStep.body, color: t.text2 }}>{DEV_MAP_SANDBOX_COPY.noLinks}</p>
        ) : (
          <ul data-testid="map-sandbox-links" style={{ margin: 0, paddingLeft: space[4], fontSize: textStep.body, lineHeight: "22px" }}>
            {links.map((link) => (
              <li key={`${link.to}>${link.from}:${link.verb}`}>{link.sentence}</li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="map-sandbox-layout" style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
        <h2 id="map-sandbox-layout" style={HEADING}>
          {DEV_MAP_SANDBOX_COPY.layout}
        </h2>
        {layout ? (
          <pre data-testid="map-sandbox-layout" style={{ margin: 0, fontFamily: DM_MONO, fontSize: textStep.meta, lineHeight: "18px", color: t.text, background: t.well, padding: space[3], borderRadius: r.control, overflowX: "auto" }}>
            {JSON.stringify(layout, null, 2)}
          </pre>
        ) : (
          <p style={{ margin: 0, fontSize: textStep.body, color: t.text2 }}>{DEV_MAP_SANDBOX_COPY.noLayout}</p>
        )}
      </section>
    </main>
  );
}
