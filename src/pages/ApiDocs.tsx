/* The public API's page, on the site's own pieces: the shared page header, the reading column (the page grid's columns 4 to
   9), the seven type sizes and the tone tokens. A card is the module recipe at the card radius, code sits in a well, and an
   endpoint's method is a type chip. The words and the endpoints are the page's own, unchanged. */

import type { CSSProperties, ReactNode } from "react";

import { SeoHead } from "@/components/SeoHead";
import { PageHeader } from "@/components/shell/PageHeader";
import { ReadingColumn } from "@/components/shell/ReadingColumn";
import { TypeChip } from "@/components/vision/TypeChip";
import { SITE_NAME } from "@/lib/site";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, measure } from "@/lib/theme/type";

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
const card: CSSProperties = { background: t.module, border: `1px solid ${t.moduleBorder}`, borderRadius: r.card, padding: 16, display: "flex", flexDirection: "column", gap: 12 };
const well: CSSProperties = { ...code(12, t.text2), margin: 0, background: t.well, border: `1px solid ${t.wellBorder}`, borderRadius: r.control, padding: 12, overflowX: "auto", whiteSpace: "pre" };

/** A card's heading: a section heading, 14 / 500. */
function CardHeading({ children }: { children: ReactNode }) {
  return <h2 style={text(14, t.text, { fontWeight: 500 })}>{children}</h2>;
}

/** A label inside a card: "Parameters", "Example". */
function Label({ children }: { children: ReactNode }) {
  return <h3 style={text(12, t.label, { fontWeight: 500 })}>{children}</h3>;
}

export default function ApiDocs() {
  return (
    <>
      <SeoHead title="API Documentation" description={`Public API documentation for the ${SITE_NAME} Blueprint library.`} path="/api-docs" />
      <PageHeader title={`${SITE_NAME} Public API`} />
      <ReadingColumn>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <p style={{ ...text(13, t.text2), ...measure }}>
            Read-only access to the {SITE_NAME} Blueprint library. No authentication required. Rate limited to 60 requests per minute per IP.
          </p>

          <section style={card}>
            <CardHeading>Base URL</CardHeading>
            <code style={{ ...code(13, t.text), overflowWrap: "anywhere" }}>{BASE_URL}</code>
          </section>

          {endpoints.map((ep) => (
            <section key={ep.path} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <TypeChip>{ep.method}</TypeChip>
                <code style={code(13, t.text)}>{ep.path}</code>
              </div>
              <p style={text(13, t.text2)}>{ep.description}</p>

              {ep.params.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Label>Parameters</Label>
                  {ep.params.map((p) => (
                    <div key={p.name} style={{ display: "flex", gap: 12 }}>
                      <code style={{ ...code(12, t.text), minWidth: 80 }}>{p.name}</code>
                      <span style={text(12, t.label)}>{p.type}</span>
                      <span style={text(12, t.text2)}>{p.desc}</span>
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
            <CardHeading>Response Format</CardHeading>
            <p style={text(13, t.text2)}>All responses are JSON. List endpoints return:</p>
            <pre style={well}>{`{
  "data": [...],
  "page": 1,
  "per_page": 20,
  "total": 150
}`}</pre>
          </section>
        </div>
      </ReadingColumn>
    </>
  );
}
