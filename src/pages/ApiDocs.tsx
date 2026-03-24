import { SeoHead } from "@/components/SeoHead";

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

export default function ApiDocs() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <SeoHead title="API Documentation — NeoScale AI" description="Public API documentation for the NeoScale Blueprint library." />

      <h1 className="text-2xl font-bold text-foreground mb-2">NeoScale Public API</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Read-only access to the NeoScale Blueprint library. No authentication required. Rate limited to 60 requests per minute per IP.
      </p>

      <div className="mb-6 p-4 rounded-xl border border-border bg-card">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base URL</h2>
        <code className="text-sm text-primary break-all">{BASE_URL}</code>
      </div>

      <div className="space-y-8">
        {endpoints.map((ep) => (
          <div key={ep.path} className="border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-muted/20 flex items-center gap-3">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/15 text-primary">{ep.method}</span>
              <code className="text-sm text-foreground">{ep.path}</code>
            </div>
            <div className="px-4 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">{ep.description}</p>

              {ep.params.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Parameters</h3>
                  <div className="space-y-1">
                    {ep.params.map((p) => (
                      <div key={p.name} className="flex gap-3 text-xs">
                        <code className="text-primary font-medium min-w-[80px]">{p.name}</code>
                        <span className="text-muted-foreground/60">{p.type}</span>
                        <span className="text-muted-foreground">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Example</h3>
                <pre className="text-xs bg-muted/30 p-3 rounded-lg overflow-x-auto text-muted-foreground">
                  {ep.example}
                </pre>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-4 rounded-xl border border-border bg-card">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Response Format</h2>
        <p className="text-sm text-muted-foreground mb-3">All responses are JSON. List endpoints return:</p>
        <pre className="text-xs bg-muted/30 p-3 rounded-lg overflow-x-auto text-muted-foreground">{`{
  "data": [...],
  "page": 1,
  "per_page": 20,
  "total": 150
}`}</pre>
      </div>
    </div>
  );
}
