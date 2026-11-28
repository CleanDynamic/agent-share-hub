/* MS-00 — /dev/map-sandbox: the map sandbox's fixtures, where every MS prompt shows its work.

   A fixture picker; the canvas (MS-05) for the chosen fixture, for the maker or a reader, at a width; its links as sentences
   (`tileLinksOf`); and what `mapLayoutOf` reads from its `making`. Nothing is written.

   DEV ONLY: registered behind `import.meta.env.DEV` in App.tsx. `?fixture=<name>` opens on a fixture, `?mode=reader` as a
   reader, `?width=<px>` at a width. */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useDesignTheme } from "@/dev/useDesignTheme";
import { MAP_SANDBOX_NAMES, mapSandboxFixture, type MapSandboxName } from "@/dev/fixtures/mapSandbox";
import { MAP_WIDTH } from "@/lib/build/mapGeometry";
import { mapLayoutOf } from "@/lib/build/mapLayout";
import { startFromBuild } from "@/lib/build/mapStart";
import { tileLinksOf } from "@/lib/build/sessionMap";
import { r } from "@/lib/theme/radius";
import { space } from "@/lib/theme/space";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, textStep } from "@/lib/theme/type";
import { MapCanvas } from "@/pages/site/compose/MapCanvas";

export const DEV_MAP_SANDBOX_COPY = {
  fixture: "Fixture",
  links: (count: number) => (count === 1 ? "1 link" : `${count} links`),
  noLinks: "No tile uses another.",
  tiles: (tiles: number, sessions: number) => `${tiles} ${tiles === 1 ? "tile" : "tiles"} in ${sessions} ${sessions === 1 ? "session" : "sessions"}`,
  layout: "Stored layout",
  canvas: "Canvas",
  mode: "Drawn for",
  maker: "The maker",
  reader: "A reader",
  width: "Width",
  noLayout: "None stored. The map starts from the build.",
};

/** The widths the picker offers: the minimum, narrow, standard, wide and the maximum, and two between. */
const WIDTHS = [MAP_WIDTH.min, MAP_WIDTH.narrow, 840, MAP_WIDTH.standard, 1080, MAP_WIDTH.wide, MAP_WIDTH.max];

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
  const mode = params.get("mode") === "reader" ? "reader" : "maker";
  const asWidth = Number(params.get("width"));
  const width = Number.isFinite(asWidth) && asWidth >= MAP_WIDTH.min ? Math.min(MAP_WIDTH.max, asWidth) : MAP_WIDTH.standard;
  const drawn = useMemo(() => ({ ...(layout ?? startFromBuild(fixture.steps, fixture.groups, fixture.making, fixture.results)), width }), [layout, fixture, width]);
  const [selected, setSelected] = useState<string | null>(null);
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };

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
          onChange={(event) => set("fixture", event.target.value)}
          style={{ fontFamily: FIGTREE, fontSize: textStep.body, color: t.text, background: t.control, border: `1px solid ${t.hairline}`, borderRadius: r.control, padding: `${space[1]}px ${space[2]}px` }}
        >
          {MAP_SANDBOX_NAMES.map((option) => (
            <option key={option} value={option}>
              {mapSandboxFixture(option).label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: space[4], fontSize: textStep.body, color: t.text2 }}>
        <label style={{ display: "flex", alignItems: "center", gap: space[2] }}>
          {DEV_MAP_SANDBOX_COPY.mode}
          <select data-testid="map-sandbox-mode" value={mode} onChange={(event) => set("mode", event.target.value)} style={{ fontFamily: FIGTREE, fontSize: textStep.body, color: t.text, background: t.control, border: `1px solid ${t.hairline}`, borderRadius: r.control, padding: `${space[1]}px ${space[2]}px` }}>
            <option value="maker">{DEV_MAP_SANDBOX_COPY.maker}</option>
            <option value="reader">{DEV_MAP_SANDBOX_COPY.reader}</option>
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: space[2] }}>
          {DEV_MAP_SANDBOX_COPY.width}
          <select data-testid="map-sandbox-width" value={width} onChange={(event) => set("width", event.target.value)} style={{ fontFamily: FIGTREE, fontSize: textStep.body, color: t.text, background: t.control, border: `1px solid ${t.hairline}`, borderRadius: r.control, padding: `${space[1]}px ${space[2]}px` }}>
            {[...new Set([...WIDTHS, width])].sort((a, b) => a - b).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section aria-labelledby="map-sandbox-canvas" style={{ display: "flex", flexDirection: "column", gap: space[2], minWidth: 0 }}>
        <h2 id="map-sandbox-canvas" style={HEADING}>
          {DEV_MAP_SANDBOX_COPY.canvas}
        </h2>
        <div style={{ overflowX: "auto", maxWidth: mode === "reader" ? width : undefined }}>
          <MapCanvas key={`${name}-${mode}`} layout={drawn} steps={fixture.steps} groups={fixture.groups} files={fixture.files} making={fixture.making} results={fixture.results} mode={mode} selected={selected} onSelect={setSelected} />
        </div>
      </section>

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
