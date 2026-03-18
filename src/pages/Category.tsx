import { useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import { ContentCard } from "@/components/ContentCard";
import { ProjectCard } from "@/components/ProjectCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface CategoryDef {
  slug: string;
  name: string;
  contentType: string; // maps to content_items.content_type
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
    seoDescription: "Download ready-made prompts for ChatGPT, Claude, Gemini and any AI. Paste in and your AI becomes a specialist instantly. Free to download.",
  },
  {
    slug: "prompt-tutorial",
    name: "Prompt Tutorials",
    contentType: "Prompt Tutorial",
    description: "Step-by-step guides on how to write better prompts and get more out of AI tools.",
    seoTitle: "Prompt Tutorials — Learn AI Prompting | NeoScale AI",
    seoDescription: "Learn how to write effective prompts for ChatGPT, Claude, and other AI tools. Tutorials from beginner to advanced.",
  },
  {
    slug: "blueprint",
    name: "AI Blueprints",
    contentType: "Agent Blueprint",
    description: "Complete setup guides with exact prompts, tools, and step-by-step instructions for building AI agents.",
    seoTitle: "AI Blueprints — Complete Setup Guides | NeoScale AI",
    seoDescription: "Step-by-step AI blueprints with exact prompts, tools, and setup instructions. Works with any AI tool.",
  },
  {
    slug: "automation",
    name: "AI Automations",
    contentType: "Workflow Template",
    description: "Ready-made automation templates for Zapier, Make, and n8n that you can import and run immediately.",
    seoTitle: "AI Automations — Zapier and Make Templates | NeoScale AI",
    seoDescription: "Ready-made automation templates for Zapier, Make and n8n. Import and run immediately.",
  },
  {
    slug: "stack",
    name: "Agent Stacks",
    contentType: "Agent Stack",
    description: "Curated combinations of AI tools and configurations that work together for specific workflows.",
    seoTitle: "Agent Stacks — AI Tool Combinations | NeoScale AI",
    seoDescription: "Curated AI tool stacks for specific workflows. Tested combinations of models, prompts, and integrations.",
  },
  {
    slug: "model-guide",
    name: "Model Config Guides",
    contentType: "Model Config Guide",
    description: "Configuration guides for AI models — temperature settings, system prompts, and optimal parameters.",
    seoTitle: "Model Config Guides — AI Model Settings | NeoScale AI",
    seoDescription: "Optimal configuration guides for AI models. Temperature settings, system prompts, and parameter tuning for ChatGPT, Claude, and more.",
  },
  {
    slug: "integration-guide",
    name: "Integration Guides",
    contentType: "Integration Guide",
    description: "Guides for connecting AI tools with other platforms and services.",
    seoTitle: "Integration Guides — Connect AI Tools | NeoScale AI",
    seoDescription: "Step-by-step guides for integrating AI tools with your existing platforms and workflows.",
  },
  {
    slug: "evaluation",
    name: "Evaluation Frameworks",
    contentType: "Evaluation Framework",
    description: "Frameworks and rubrics for measuring AI output quality and comparing model performance.",
    seoTitle: "Evaluation Frameworks — Measure AI Quality | NeoScale AI",
    seoDescription: "Frameworks for evaluating AI output quality. Compare models, measure accuracy, and benchmark performance.",
  },
  {
    slug: "failure-library",
    name: "Failure Library",
    contentType: "Failure Library",
    description: "Honest post-mortems from AI builders. What went wrong, why, and exactly how it was fixed.",
    seoTitle: "AI Failure Library — What Broke and How to Fix It | NeoScale AI",
    seoDescription: "Honest post-mortems from AI builders. What went wrong, why, and exactly how it was fixed.",
  },
  {
    slug: "projects",
    name: "Projects",
    contentType: "",
    description: "Curated project bundles combining multiple resources into complete workflows.",
    seoTitle: "AI Projects — Curated Bundles | NeoScale AI",
    seoDescription: "Complete AI project bundles combining prompts, automations, and guides into ready-to-use packages.",
    isProject: true,
  },
  {
    slug: "ai-tools-llms",
    name: "AI Tools (LLMs)",
    contentType: "AI Tools (LLMs)",
    description: "Discover and share AI tools, models, and platforms. Reviews, guides, and commentary from the community.",
    seoTitle: "AI Tools & LLMs — Discover AI Models | NeoScale AI",
    seoDescription: "Explore AI tools, LLMs, and platforms. Community reviews and guides for ChatGPT, Claude, Gemini, and more.",
  },
];

const PAGE_SIZE = 24;

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const microtagParam = searchParams.get("microtag") || "";
  const [limit, setLimit] = useState(PAGE_SIZE);
  const cat = CATEGORIES.find((c) => c.slug === slug);

  // Content items query
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["category_content", slug, limit, microtagParam],
    enabled: !!cat && !cat.isProject,
    queryFn: async () => {
      if (microtagParam) {
        // Filter by microtag: join content_microtags
        const { data } = await supabase
          .from("content_microtags")
          .select("content_id, content_items!content_microtags_content_id_fkey(*, profiles!content_items_creator_id_fkey(username))")
          .eq("tag", microtagParam)
          .limit(limit);
        return (data ?? [])
          .map((r: any) => r.content_items)
          .filter((i: any) => i && i.status === "approved" && i.content_type === cat!.contentType)
          .sort((a: any, b: any) => b.download_count - a.download_count)
          .slice(0, limit);
      }
      const { data } = await supabase
        .from("content_items")
        .select("*, profiles!content_items_creator_id_fkey(username)")
        .eq("status", "approved")
        .eq("content_type", cat!.contentType)
        .order("download_count", { ascending: false })
        .limit(limit);
      return data || [];
    },
  });

  // Projects query
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["category_projects", limit],
    enabled: !!cat?.isProject,
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("*, profiles!projects_creator_id_fkey(username, display_name), project_components(id, component_type)")
        .eq("status", "approved")
        .order("view_count", { ascending: false })
        .limit(limit);
      return data || [];
    },
  });

  if (!cat) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Category not found</h1>
        <Link to="/browse" className="text-primary hover:underline">Back to Browse</Link>
      </div>
    );
  }

  const isLoading = cat.isProject ? projectsLoading : itemsLoading;
  const dataList = cat.isProject ? projects : items;
  const hasMore = (dataList?.length ?? 0) >= limit;

  return (
    <>
      <SeoHead title={cat.seoTitle} description={cat.seoDescription} path={`/category/${cat.slug}`} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">{cat.name}</h1>
        <p className="text-muted-foreground mb-6">{cat.description}</p>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
          </div>
        ) : cat.isProject ? (
          <div className="space-y-4">
            {(projects || []).map((p: any) => {
              const types = [...new Set((p.project_components || []).map((c: any) => c.component_type))];
              return (
                <ProjectCard
                  key={p.id}
                  id={p.id}
                  title={p.title}
                  description={p.description}
                  coverImageUrl={p.cover_image_url}
                  creatorDisplayName={p.profiles?.display_name || p.profiles?.username || "Unknown"}
                  creatorUsername={p.profiles?.username || ""}
                  componentTypes={types as string[]}
                  componentCount={(p.project_components || []).length}
                  viewCount={p.view_count}
                />
              );
            })}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(items || []).map((item: any) => (
              <ContentCard
                key={item.id}
                id={item.id}
                content_type={item.content_type}
                title={item.title}
                description={item.description || ""}
                difficulty={item.difficulty}
                ai_tools={item.ai_tools || []}
                download_count={item.download_count}
                monetisation_type={item.monetisation_type}
                price_gbp={item.price_gbp}
                file_url={item.file_url}
                creator_username={item.profiles?.username}
                avg_rating={item.avg_rating}
                rating_count={item.rating_count}
                view_count={item.view_count}
                is_fork={!!item.fork_of_content_id}
              />
            ))}
          </div>
        )}

        {(dataList?.length ?? 0) === 0 && !isLoading && (
          <p className="text-center text-muted-foreground py-12">No items in this category yet.</p>
        )}

        {hasMore && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" onClick={() => setLimit((l) => l + PAGE_SIZE)}>Load more</Button>
          </div>
        )}
      </div>
    </>
  );
}
