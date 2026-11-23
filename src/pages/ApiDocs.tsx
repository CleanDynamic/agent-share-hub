/* The public API's page. Synth 15 Part C: one panel at 680. The h1 "API Documentation" at 31/36, then one Card per endpoint
   (Card fill, radius 12, no edge): the method as a chip in mono 13 on Raised, the path in mono 15, the one-line description
   at 15, "Parameters" at 13 in Text 3 and a row per parameter (its name in mono 13 in a 120 column, its description at 15 in
   Text 2). The words and the endpoints are the page's own. */

import type { CSSProperties, ReactNode } from "react";

import { SeoHead } from "@/components/SeoHead";
import { ReadingPanel } from "@/components/shell/ReadingPanel";
import { SITE_NAME } from "@/lib/site";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, hero, textStep } from "@/lib/theme/type";

const BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-api`;

const endpoints = [
  {
    method: "GET",
    path: "/blueprints",
    description: "List approved blueprints with pagination and filters.",
    params: [
      { name: "page", type: "integer", desc: "Page number (default: 1)" },
      { name: "per_page", type: "integer", desc: "Results per page (max 50, default: 20)" },
      { name: "type", type: "string", desc: "Filter by content_type (e.g. 'Prompt File', 'Agent Blueprint')" },
      { name: "tool", type: "string", desc: "Filter by AI tool name (e.g. 'ChatGPT', 'Claude')" },
      { name: "difficulty", type: "string", desc: "Filter by difficulty ('Beginner', 'Intermediate', 'Advanced')" },
      { name: "topic", type: "string", desc: "Filter by topic (e.g. 'Prompt Engineering', 'CI/CD & DevOps')" },
    ],
    example: `curl "${BASE_URL}/blueprints?type=Agent%20Blueprint&per_page=5"`,
  },
  {
    method: "GET",
    path: "/blueprints/:id",
    description: "Get a single blueprint with its content blocks.",
    params: [{ name: "id", type: "uuid", desc: "Blueprint ID" }],
    example: `curl "${BASE_URL}/blueprints/YOUR_BLUEPRINT_ID"`,
  },
  {
    method: "GET",
    path: "/tools",
    description: "List all approved AI tools from the registry.",
    params: [],
    example: `curl "${BASE_URL}/tools"`,
  },
];

const text = (size: number, color: string, extra: CSSProperties = {}): CSSProperties => ({ margin: 0, fontFamily: FIGTREE, fontSize: size, lineHeight: "20px", color, ...extra });
const code = (size: number, color: string): CSSProperties => ({ fontFamily: DM_MONO, fontSize: size, lineHeight: "20px", color });
const card: CSSProperties = { background: t.module, border: 0, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12, minWidth: 0 };
const well: CSSProperties = { ...code(textStep.meta, t.text2), margin: 0, background: t.control, border: 0, borderRadius: 8, padding: 12, overflowX: "auto", whiteSpace: "pre" };
const chip: CSSProperties = { ...code(textStep.meta, t.text), display: "inline-flex", alignItems: "center", height: 24, padding: "0 8px", borderRadius: r.chip, background: t.control, flexShrink: 0 };

/** A card's heading: 15/600. */
function CardHeading({ children }: { children: ReactNode }) {
  return <h2 style={text(textStep.body, t.text, { fontWeight: 600 })}>{children}</h2>;
}

/** A label inside a card: "Parameters", "Example", 13 in Text 3. */
function Label({ children }: { children: ReactNode }) {
  return <h3 style={text(textStep.meta, t.label, { fontWeight: 400 })}>{children}</h3>;
}

export default function ApiDocs() {
  return (
    <>
      <SeoHead title="API Documentation" description={`Public API documentation for the ${SITE_NAME} Blueprint library.`} path="/api-docs" />
      <ReadingPanel data-testid="api-docs">
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <h1 style={{ ...hero, margin: 0, color: t.text }}>API Documentation</h1>
            <p style={text(textStep.body, t.text2)}>
              Read-only access to the {SITE_NAME} Blueprint library. No authentication required. Rate limited to 60 requests per minute per IP.
            </p>
          </div>

          <section style={card}>
            <CardHeading>Base URL</CardHeading>
            <code style={{ ...code(textStep.body, t.text), overflowWrap: "anywhere" }}>{BASE_URL}</code>
          </section>

          {endpoints.map((ep) => (
            <section key={ep.path} aria-label={`${ep.method} ${ep.path}`} data-testid="api-endpoint" style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <span style={chip}>{ep.method}</span>
                <code style={{ ...code(textStep.body, t.text), overflowWrap: "anywhere" }}>{ep.path}</code>
              </div>
              <p style={text(textStep.body, t.text)}>{ep.description}</p>

              {ep.params.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Label>Parameters</Label>
                  {ep.params.map((p) => (
                    <div key={p.name} style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", columnGap: 12, alignItems: "baseline", minHeight: 28 }}>
                      <code style={{ ...code(textStep.meta, t.text), overflowWrap: "anywhere" }}>{p.name}</code>
                      <span style={text(textStep.body, t.text2)}>{p.desc}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Label>Example</Label>
                <pre style={well}>{ep.example}</pre>
              </div>
            </section>
          ))}

          <section style={card}>
            <CardHeading>Response format</CardHeading>
            <p style={text(textStep.body, t.text2)}>All responses are JSON. List endpoints return:</p>
            <pre style={well}>{`{
  "data": [...],
  "page": 1,
  "per_page": 20,
  "total": 150
}`}</pre>
          </section>
        </div>
      </ReadingPanel>
    </>
  );
}
