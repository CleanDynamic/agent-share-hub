import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

const TOOL_CATEGORIES: { label: string; key: string; tools: string[] }[] = [
  {
    label: "All", key: "all", tools: [],
  },
  {
    label: "Chat & Writing", key: "chat",
    tools: [
      "Any Tool", "ChatGPT", "Claude", "Gemini", "Grok", "Perplexity AI",
      "Microsoft Copilot", "Meta AI", "Mistral Le Chat", "DeepSeek",
      "Coze", "Poe", "You.com", "Pi", "Character.ai", "OpenRouter",
      "Qwen", "Jasper", "Copy.ai", "Writesonic",
    ],
  },
  {
    label: "Image", key: "image",
    tools: [
      "Midjourney", "DALL-E 3", "Stable Diffusion", "Adobe Firefly",
      "Ideogram", "Flux", "Leonardo AI", "Kling", "Canva AI",
      "NightCafe", "Playground AI",
    ],
  },
  {
    label: "Video & Audio", key: "video",
    tools: [
      "Runway", "Sora", "Pika", "ElevenLabs", "Suno", "Udio",
      "HeyGen", "Synthesia", "Descript", "Adobe Podcast",
    ],
  },
  {
    label: "Coding", key: "coding",
    tools: [
      "Cursor", "GitHub Copilot", "Claude Code", "Windsurf",
      "Codeium", "Replit AI", "Tabnine", "Continue", "Aider",
      "Devin", "v0 by Vercel", "Bolt", "Lovable",
    ],
  },
  {
    label: "Search", key: "search",
    tools: [
      "Perplexity AI", "You.com", "Phind", "Elicit", "Consensus",
      "Semantic Scholar", "SciSpace", "Tavily",
    ],
  },
  {
    label: "Automation", key: "automation",
    tools: [
      "Zapier", "Make", "n8n", "Dify", "Flowise", "Langflow",
      "Relevance AI", "Lindy AI", "Gumloop", "Bardeen",
      "Activepieces", "Pipedream", "Botpress", "Voiceflow",
      "IFTTT", "Stack AI", "Typebot",
    ],
  },
  {
    label: "Local / Self-hosted", key: "local",
    tools: [
      "Ollama", "LM Studio", "AnythingLLM", "Open WebUI",
      "Jan.ai", "GPT4All", "LocalAI", "llama.cpp", "llamafile",
      "Text Generation WebUI", "Msty", "KoboldCpp", "vLLM",
      "LibreChat",
    ],
  },
  {
    label: "API Access", key: "api",
    tools: [
      "OpenAI API", "Anthropic API", "Google AI Studio",
      "OpenRouter", "Groq", "Together AI", "Replicate",
      "Hugging Face", "AWS Bedrock", "Azure OpenAI",
      "Vertex AI", "Mistral API",
    ],
  },
];

// Deduplicated flat list
const ALL_TOOLS = Array.from(
  new Set(TOOL_CATEGORIES.filter((c) => c.key !== "all").flatMap((c) => c.tools))
);

interface WorksWithPickerProps {
  value: string[];
  onChange: (tools: string[]) => void;
  onSubmitToolClick?: () => void;
}

export function WorksWithPicker({ value, onChange, onSubmitToolClick }: WorksWithPickerProps) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredTools = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) {
      return ALL_TOOLS.filter((t) => t.toLowerCase().includes(q));
    }
    if (activeTab === "all") return ALL_TOOLS;
    const cat = TOOL_CATEGORIES.find((c) => c.key === activeTab);
    return cat ? cat.tools : ALL_TOOLS;
  }, [search, activeTab]);

  const toggle = (tool: string) => {
    onChange(
      value.includes(tool) ? value.filter((v) => v !== tool) : [...value, tool]
    );
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (val.trim()) setActiveTab("all");
  };

  return (
    <div className="space-y-3">
      {/* Label */}
      <div>
        <p className="text-sm font-semibold text-foreground">
          Works with <span className="text-xs text-muted-foreground font-normal ml-1">(optional)</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Select every tool you've tested this with.</p>
      </div>

      {/* Selected pills */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tool) => (
            <button
              key={tool}
              type="button"
              onClick={() => toggle(tool)}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{
                borderColor: "hsl(var(--primary-container))",
                color: "hsl(var(--primary-container))",
                background: "hsl(var(--primary-container) / 0.08)",
              }}
            >
              {tool}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search AI tools..."
          className="w-full h-10 pl-9 pr-3 text-sm rounded-xl border border-border bg-card/60 backdrop-blur-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ring-offset-background"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TOOL_CATEGORIES.map((cat) => {
          const isActive = activeTab === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => { setActiveTab(cat.key); setSearch(""); }}
              className="shrink-0 text-[11px] px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap"
              style={
                isActive
                  ? {
                      background: "hsl(var(--primary-container))",
                      color: "hsl(var(--on-primary-container, 0 0% 100%))",
                      borderColor: "hsl(var(--primary-container))",
                    }
                  : {
                      background: "transparent",
                      color: "hsl(var(--muted-foreground))",
                      borderColor: "hsl(var(--border))",
                    }
              }
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
        {filteredTools.map((tool) => {
          const selected = value.includes(tool);
          return (
            <button
              key={tool}
              type="button"
              onClick={() => toggle(tool)}
              className="text-xs px-3 py-2 rounded-lg border text-left transition-all"
              style={
                selected
                  ? {
                      borderColor: "hsl(var(--primary-container))",
                      color: "hsl(var(--primary-container))",
                      background: "hsl(var(--primary-container) / 0.1)",
                      boxShadow: "0 0 8px hsl(var(--primary-container) / 0.15)",
                    }
                  : {
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--muted-foreground))",
                      background: "hsl(var(--card) / 0.5)",
                    }
              }
            >
              {tool}
            </button>
          );
        })}
        {filteredTools.length === 0 && (
          <p className="col-span-2 text-xs text-muted-foreground text-center py-6">No tools match "{search}"</p>
        )}
      </div>

      {/* Footer */}
      {onSubmitToolClick && (
        <button type="button" onClick={onSubmitToolClick} className="text-xs hover:underline" style={{ color: "hsl(var(--primary-container))" }}>
          Don't see your AI tool? Submit it →
        </button>
      )}
    </div>
  );
}
