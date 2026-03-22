import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { FeedItem } from "@/components/FeedItem";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Upload } from "lucide-react";
import { SLUG_TO_TYPE, displayContentType } from "@/lib/content-types";
import { useQuery } from "@tanstack/react-query";

/* ---- Category definitions ---- */
interface CategoryDef {
  slug: string;
  name: string;
  contentType: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  isProject?: boolean;
}

const CATEGORIES: CategoryDef[] = [
  {
    slug: "prompt-file",
    name: "Prompt(s)",
    contentType: "Prompt File",
    description: "Ready-made prompts you can paste directly into any AI tool to get specialist results instantly.",
    seoTitle: "Prompts — Download AI Prompts | NeoScale AI",
    seoDescription: "Download ready-made prompts for ChatGPT, Claude, Gemini and any AI. Free to download.",
  },
  {
    slug: "prompt-tutorial",
    name: "Prompt Tutorials",
    contentType: "Prompt Tutorial",
    description: "Step-by-step guides on how to write better prompts and get more out of AI tools.",
    seoTitle: "Prompt Tutorials — Learn AI Prompting | NeoScale AI",
    seoDescription: "Learn how to write effective prompts for ChatGPT, Claude, and other AI tools.",
  },
  {
    slug: "agent-blueprint",
    name: "Agent(s)",
    contentType: "Agent Blueprint",
    description: "Complete setup guides with exact prompts, tools, and step-by-step instructions for building AI agents.",
    seoTitle: "Agent(s) — Setup Guides | NeoScale AI",
    seoDescription: "Step-by-step AI blueprints with exact prompts, tools, and setup instructions.",
  },
  {
    slug: "model-config-guide",
    name: "Model Config Guides",
    contentType: "Model Config Guide",
    description: "Configuration guides for AI models — temperature settings, system prompts, and optimal parameters.",
    seoTitle: "Model Config Guides — AI Model Settings | NeoScale AI",
    seoDescription: "Optimal configuration guides for AI models.",
  },
  {
    slug: "integration-guide",
    name: "Integration Guides",
    contentType: "Integration Guide",
    description: "Guides for connecting AI tools with other platforms and services.",
    seoTitle: "Integration Guides — Connect AI Tools | NeoScale AI",
    seoDescription: "Step-by-step guides for integrating AI tools with your existing platforms.",
  },
  {
    slug: "workflow-template",
    name: "AI Automations",
    contentType: "Workflow Template",
    description: "Ready-made automation templates for Zapier, Make, and n8n that you can import and run immediately.",
    seoTitle: "AI Automations — Zapier and Make Templates | NeoScale AI",
    seoDescription: "Ready-made automation templates for Zapier, Make and n8n.",
  },
  {
    slug: "evaluation-framework",
    name: "Evaluation Frameworks",
    contentType: "Evaluation Framework",
    description: "Frameworks and rubrics for measuring AI output quality and comparing model performance.",
    seoTitle: "Evaluation Frameworks — Measure AI Quality | NeoScale AI",
    seoDescription: "Frameworks for evaluating AI output quality.",
  },
  {
    slug: "agent-stack",
    name: "Agent Stacks",
    contentType: "Agent Stack",
    description: "Curated combinations of AI tools and configurations that work together for specific workflows.",
    seoTitle: "Agent Stacks — AI Tool Combinations | NeoScale AI",
    seoDescription: "Curated AI tool stacks for specific workflows.",
  },
  {
    slug: "failure-library",
    name: "Failure Library",
    contentType: "Failure Library",
    description: "Honest post-mortems from AI builders. What went wrong, why, and exactly how it was fixed.",
    seoTitle: "AI Failure Library — What Broke and How to Fix It | NeoScale AI",
    seoDescription: "Honest post-mortems from AI builders.",
  },
  {
    slug: "ai-tools-llms",
    name: "AI Tools (LLMs)",
    contentType: "AI Tools (LLMs)",
    description: "Discover and share AI tools, models, and platforms. Reviews, guides, and commentary from the community.",
    seoTitle: "AI Tools & LLMs — Discover AI Models | NeoScale AI",
    seoDescription: "Explore AI tools, LLMs, and platforms. Community reviews and guides.",
  },
  {
    slug: "projects",
    name: "Projects",
    contentType: "",
    description: "Complete collections of blueprints — multi-step AI systems built to work together.",
    seoTitle: "Projects — AI Blueprint Collections | NeoScale AI",
    seoDescription: "Complete collections of blueprints. Multi-step AI systems built to work together.",
    isProject: true,
  },
];

const PAGE_SIZE = 20;
const TABS = ["Popular", "Recent"] as const;
type Tab = typeof TABS[number];

/* ---- Projects feed ---- */
function ProjectsFeed({ activeTab }: { activeTab: Tab }) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["category_projects", activeTab],
    queryFn: async () => {
      const orderCol = activeTab === "Popular" ? "view_count" : "created_at";
      const { data, error } = await supabase
        .from("projects")
        .select("*, profiles(id, username, display_name), project_components(id, component_type, linked_content_id, inline_content_id)")
        .eq("status", "approved")
        .order(orderCol, { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const projContentIds = (projects ?? []).flatMap((p: any) =>
    (p.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean)
  );
  const { data: projContentTypes } = useQuery({
    queryKey: ["category_proj_content_types", projContentIds.join(",")],
    queryFn: async () => {
      if (projContentIds.length === 0) return [];
      const { data } = await supabase.from("content_items").select("id, content_type").in("id", projContentIds);
      return data ?? [];
    },
    enabled: projContentIds.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 pt-4">
        {[1, 2, 3, 4].map((n) => <Skeleton key={n} className="h-28 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <p className="text-sm text-muted-foreground">No projects published yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 pt-4">
      {projects.map((proj: any) => {
        const creator = proj.profiles as any;
        const compIds = (proj.project_components ?? []).map((c: any) => c.linked_content_id || c.inline_content_id).filter(Boolean);
        const types = [...new Set(
          compIds.map((cid: string) => projContentTypes?.find((ci: any) => ci.id === cid)?.content_type).filter(Boolean)
        )] as string[];
        return (
          <ProjectCard
            key={proj.id}
            id={proj.id}
            title={proj.title}
            description={proj.description}
            coverImageUrl={proj.cover_image_url}
            creatorDisplayName={creator?.display_name || creator?.username || "Unknown"}
            creatorUsername={creator?.username ?? ""}
            componentTypes={types}
            componentCount={(proj.project_components ?? []).length}
            viewCount={proj.view_count}
          />
        );
      })}
    </div>
  );
}

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("Popular");

  const cat = CATEGORIES.find((c) => c.slug === slug);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["category_feed", slug, activeTab],
    enabled: !!cat && !cat.isProject,
    queryFn: async ({ pageParam = 0 }) => {
      const query = supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, use_cases, custom_use_case_description, avg_rating, rating_count, download_count, view_count, comment_count, cover_image_url, created_at, approved_at, what_to_expect_blocks, what_to_expect, other_tool_name, custom_tags, profiles!content_items_creator_id_fkey(display_name, username)")
        .eq("status", "approved")
        .eq("content_type", cat!.contentType);

      if (activeTab === "Recent") {
        query.order("approved_at", { ascending: false });
      } else {
        query.order("created_at", { ascending: false });
      }

      const { data: rows, error } = await query.range(pageParam, pageParam + (activeTab === "Popular" ? 49 : PAGE_SIZE - 1));
      if (error) throw error;

      if (activeTab === "Popular") {
        const scored = (rows ?? []).map((item: any) => {
          const hoursOld = (Date.now() - new Date(item.approved_at || item.created_at).getTime()) / 3600000;
          const score = (item.download_count * 1.5 + item.view_count + item.rating_count * 2 + (item.comment_count || 0) * 1.2)
            / Math.pow(hoursOld + 2, 1.5);
          return { ...item, _score: score };
        });
        return scored.sort((a: any, b: any) => b._score - a._score).slice(0, PAGE_SIZE);
      }

      return rows ?? [];
    },
    getNextPageParam: (last, all) => last.length < PAGE_SIZE ? undefined : all.flat().length,
    initialPageParam: 0,
  });

  if (!cat) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Category not found</h1>
        <Link to="/browse" className="text-primary hover:underline">Back to Discover</Link>
      </div>
    );
  }

  const items = data?.pages.flat() ?? [];

  return (
    <>
      <SeoHead title={cat.seoTitle} description={cat.seoDescription} path={`/category/${cat.slug}`} />

      {/* Compact header */}
      <div className="px-4 pt-5 pb-1">
        <h1 className="text-[22px] font-bold text-foreground leading-tight">{cat.name}</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">{cat.description}</p>
      </div>

      {/* Tab bar — sticky */}
      <div className="sticky top-0 z-10 bg-background border-b border-border" style={{ height: 48 }}>
        <div className="flex h-full">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-center text-[14px] font-medium transition-colors relative h-full ${
                activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[2px] bg-primary" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Projects feed */}
      {cat.isProject ? (
        <ProjectsFeed activeTab={activeTab} />
      ) : (
        <>
          {/* Content feed */}
          {isLoading ? (
            <div className="space-y-0">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-24 animate-pulse bg-card/30 border-b border-border" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <p className="text-sm text-muted-foreground">No {cat.name.toLowerCase()} posts yet.</p>
              <p className="text-xs text-muted-foreground">Be the first to share one.</p>
              <Button size="sm" onClick={() => navigate("/upload")}>
                <Upload className="h-4 w-4 mr-1.5" />Upload
              </Button>
            </div>
          ) : (
            <div>
              {items.map((item: any) => (
                <FeedItem key={item.id} item={item} context="category" navState={{ from: "category", name: cat.name }} />
              ))}
            </div>
          )}

          {hasNextPage && (
            <div className="flex justify-center py-6">
              <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Load more
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
