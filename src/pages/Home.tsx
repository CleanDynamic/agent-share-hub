import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SeoHead } from "@/components/SeoHead";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Zap, ArrowRight, Star, StarHalf, Eye } from "lucide-react";
import { motion } from "framer-motion";

const CONTENT_TYPES = [
  { name: "Prompt File", difficulty: "Beginner", description: "Paste into any AI and it becomes a specialist instantly. No setup needed." },
  { name: "Prompt Tutorial", difficulty: "Beginner", description: "Learn to write better prompts yourself. Step-by-step with examples." },
  { name: "Agent Blueprint", difficulty: "Beginner", description: "A complete recipe: what to do, which tools, exact steps to follow." },
  { name: "Workflow Template", difficulty: "Intermediate", description: "A ready-made automation. Import it and it runs immediately." },
  { name: "Agent Stack", difficulty: "Advanced", description: "Multiple AI tools working together as one system. The full playbook." },
  { name: "Model Config Guide", difficulty: "Beginner", description: "Which AI to use for which job. Closes the gap nobody explains." },
  { name: "Integration Guide", difficulty: "Beginner", description: "Connect your AI to Gmail, Notion, Slack, and other apps you use." },
  { name: "Evaluation Framework", difficulty: "Intermediate", description: "Test whether your AI setup is actually working. Scoring included." },
  { name: "Failure Library", difficulty: "Any", description: "What broke, why, and exactly how to fix it. Honest and useful." },
];

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced": return "bg-red-500/15 text-red-400 border-red-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
}

const TYPE_COLORS: Record<string, string> = {
  "Prompt File": "bg-[#E8571A]/15 text-[#E8571A] border-[#E8571A]/30",
  "Prompt Tutorial": "bg-[#2EC4B6]/15 text-[#2EC4B6] border-[#2EC4B6]/30",
  "Agent Blueprint": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "Workflow Template": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "Agent Stack": "bg-red-500/15 text-red-400 border-red-500/30",
  "Model Config Guide": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "Integration Guide": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  "Evaluation Framework": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "Failure Library": "bg-muted text-muted-foreground border-border",
};

const STEPS = [
  { icon: Search, number: "1", title: "Find what you need", description: "Search or filter the Browse page by what you want your AI to do." },
  { icon: Download, number: "2", title: "Download or read it", description: "Get the file or read the guide. Everything is plain English." },
  { icon: Zap, number: "3", title: "Drop it into your AI", description: "Paste into ChatGPT, Gemini, Claude, or any AI tool. It works." },
];

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

function roundedStars(avg: number, count: number): number {
  if (count === 0) return 0;
  if (avg >= 4.5) return 5;
  if (avg >= 4.1) return 4.5;
  if (avg >= 3.5) return 4;
  if (avg >= 3.1) return 3.5;
  if (avg >= 2.5) return 3;
  if (avg >= 2.1) return 2.5;
  if (avg >= 1.5) return 2;
  if (avg >= 1.1) return 1.5;
  return 1;
}

function MiniStars({ value }: { value: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(value)) {
      stars.push(<Star key={i} className="h-3 w-3 fill-primary text-primary" />);
    } else if (i - 0.5 === value) {
      stars.push(<StarHalf key={i} className="h-3 w-3 fill-primary text-primary" />);
    } else {
      stars.push(<Star key={i} className="h-3 w-3 text-muted-foreground/30" />);
    }
  }
  return <div className="flex gap-0.5">{stars}</div>;
}

interface TrendingItem {
  id: string;
  title: string;
  description: string | null;
  content_type: string;
  difficulty: string;
  ai_tools: string[] | null;
  avg_rating: number;
  rating_count: number;
  download_count: number;
  created_at: string;
  creator_display_name: string | null;
  creator_username: string | null;
  is_fallback?: boolean;
}

function useTrending() {
  return useQuery({
    queryKey: ["trending_home"],
    queryFn: async () => {
      const now = new Date();
      const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch last 24h
      const { data: recent } = await supabase
        .from("content_items")
        .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, created_at, profiles(display_name, username)")
        .eq("status", "approved")
        .gte("created_at", h24)
        .order("avg_rating", { ascending: false })
        .order("rating_count", { ascending: false })
        .limit(5);

      const items: TrendingItem[] = ((recent as any[]) ?? []).map((r: any) => ({
        id: r.id, title: r.title, description: r.description, content_type: r.content_type,
        difficulty: r.difficulty, ai_tools: r.ai_tools,
        avg_rating: Number(r.avg_rating) || 0, rating_count: r.rating_count ?? 0,
        download_count: r.download_count, created_at: r.created_at,
        creator_display_name: r.profiles?.display_name, creator_username: r.profiles?.username,
      }));

      if (items.length < 5) {
        const existingIds = items.map((i) => i.id);
        const remaining = 5 - items.length;
        const { data: fallback } = await supabase
          .from("content_items")
          .select("id, title, description, content_type, difficulty, ai_tools, avg_rating, rating_count, download_count, created_at, profiles(display_name, username)")
          .eq("status", "approved")
          .gte("created_at", d7)
          .lt("created_at", h24)
          .order("avg_rating", { ascending: false })
          .order("rating_count", { ascending: false })
          .limit(remaining);

        ((fallback as any[]) ?? [])
          .filter((r: any) => !existingIds.includes(r.id))
          .forEach((r: any) => {
            items.push({
              id: r.id, title: r.title, description: r.description, content_type: r.content_type,
              difficulty: r.difficulty, ai_tools: r.ai_tools,
              avg_rating: Number(r.avg_rating) || 0, rating_count: r.rating_count ?? 0,
              download_count: r.download_count, created_at: r.created_at,
              creator_display_name: r.profiles?.display_name, creator_username: r.profiles?.username,
              is_fallback: true,
            });
          });
      }

      return items.slice(0, 5);
    },
    staleTime: 2 * 60 * 1000,
  });
}

const Home = () => {
  const { data: trending, isLoading: trendingLoading } = useTrending();

  return (
    <div>
      <SeoHead
        title="NeoScale AI — The AI Agent Tactics Forum"
        description="Download AI assistants, blueprints and workflows. Works with ChatGPT, Claude, Gemini and any AI tool. Free to browse. Built by experts. Usable by anyone."
        path="/"
      />
      {/* ── Hero ── */}
      <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          className="mx-auto max-w-3xl"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.1]">
            The AI Agent Tactics Forum
          </h1>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Download. Use. Build. Works with ChatGPT, Claude, Gemini, and any AI.
          </p>

          <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row items-center justify-center gap-3">
            <Button size="lg" className="w-full xs:w-auto min-h-[44px]" asChild>
              <Link to="/recent">
                See What's New <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full xs:w-auto min-h-[44px] border-secondary text-secondary hover:bg-secondary/10"
              asChild
            >
              <Link to="/upload">Upload Your Setup</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-t border-border py-16 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-center mb-10 sm:mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="absolute left-6 top-12 bottom-12 w-px bg-border md:hidden" />
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="text-center md:text-center relative flex flex-col items-center md:items-center"
              >
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest mt-3">
                  Step {step.number}
                </span>
                <h3 className="text-base font-semibold text-foreground mt-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto mt-1">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9 Content Types ── */}
      <section className="border-t border-border py-16 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            What You Can Download
          </h2>
          <p className="text-sm text-muted-foreground mb-8 sm:mb-10">
            Nine content types — from quick prompt files to full automation stacks.
          </p>

          <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-3 gap-4">
            {CONTENT_TYPES.map((ct, i) => (
              <motion.div
                key={ct.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="border border-border rounded-xl p-5 bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{ct.name}</h3>
                  <Badge variant="outline" className={`text-[10px] font-medium ${difficultyColor(ct.difficulty)}`}>
                    {ct.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{ct.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trending in the last 24 hours ── */}
      <section className="border-t border-border py-16 sm:py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-2.5 mb-8">
            {/* Pulsing live dot */}
            <span className="relative flex h-[6px] w-[6px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-primary" />
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Trending in the last 24 hours
            </h2>
          </div>

          {trendingLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-16 bg-card rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !trending || trending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent uploads yet. Check back soon!</p>
          ) : (
            <div className="divide-y divide-border">
              {trending.map((item, i) => {
                const tools = item.ai_tools ?? [];
                const displayTools = tools.slice(0, 3);
                const moreCount = tools.length - 3;
                const starVal = roundedStars(item.avg_rating, item.rating_count);

                return (
                  <motion.div
                    key={item.id}
                    custom={i}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={fade}
                    className="flex items-center gap-3 sm:gap-5 py-4 first:pt-0 last:pb-0"
                  >
                    {/* Position number */}
                    <span className="text-2xl sm:text-3xl font-extrabold text-primary w-8 sm:w-10 text-center flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>

                    {/* Badges column */}
                    <div className="hidden sm:flex flex-col gap-1 flex-shrink-0 w-28">
                      <Badge variant="outline" className={`text-[10px] font-medium w-fit ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                        {item.content_type}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] font-medium w-fit ${difficultyColor(item.difficulty)}`}>
                        {item.difficulty}
                      </Badge>
                    </div>

                    {/* Title / description */}
                    <div className="flex-1 min-w-0">
                      <div className="sm:hidden flex flex-wrap gap-1 mb-1">
                        <Badge variant="outline" className={`text-[9px] font-medium ${TYPE_COLORS[item.content_type] ?? TYPE_COLORS["Failure Library"]}`}>
                          {item.content_type}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        by {item.creator_display_name || item.creator_username || "Unknown"}
                        {item.is_fallback && <span className="ml-2 text-[10px] text-secondary">From the last 7 days</span>}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate hidden sm:block mt-0.5">{item.description}</p>
                      )}
                    </div>

                    {/* AI tools pills */}
                    <div className="hidden lg:flex flex-wrap gap-1 flex-shrink-0 max-w-[180px]">
                      {displayTools.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">{t}</span>
                      ))}
                      {moreCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">+{moreCount}</span>
                      )}
                    </div>

                    {/* Rating + downloads */}
                    <div className="hidden sm:flex flex-col items-end gap-0.5 flex-shrink-0">
                      {item.rating_count > 0 ? (
                        <>
                          <MiniStars value={starVal} />
                          <span className="text-[10px] text-muted-foreground">{item.rating_count} ratings</span>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">No ratings</span>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Download className="h-2.5 w-2.5" /> {item.download_count}
                      </span>
                    </div>

                    {/* View button */}
                    <Button variant="outline" size="sm" className="flex-shrink-0 border-secondary text-secondary hover:bg-secondary/10 text-xs h-8" asChild>
                      <Link to={`/content/${item.id}`}>View</Link>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* See all link */}
          <div className="flex justify-end mt-6">
            <Link to="/recent" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              See all recent uploads <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
