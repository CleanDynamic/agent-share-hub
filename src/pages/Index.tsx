import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, Users, Copy, Download, Globe } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const FEATURED_AGENTS = [
  {
    title: "Content Strategist",
    creator: "sarah_ai",
    description: "Generates weekly content calendars with SEO-optimized topic clusters.",
    models: ["ChatGPT", "Claude", "Gemini"],
    price: 0,
    downloads: 2340,
  },
  {
    title: "Code Reviewer Pro",
    creator: "devtools",
    description: "Reviews pull requests with security analysis and performance suggestions.",
    models: ["Claude", "Gemini"],
    price: 499,
    downloads: 1820,
  },
  {
    title: "Email Copywriter",
    creator: "marketingmax",
    description: "Writes conversion-focused email sequences for SaaS onboarding.",
    models: ["ChatGPT", "Grok"],
    price: 0,
    downloads: 3100,
  },
  {
    title: "Data Analyst",
    creator: "analytics_co",
    description: "Interprets CSV data and produces executive summary reports with charts.",
    models: ["ChatGPT", "Claude", "Gemini", "Grok"],
    price: 999,
    downloads: 950,
  },
  {
    title: "Legal Brief Drafter",
    creator: "legalai",
    description: "Drafts contract clauses and NDA templates from plain-language instructions.",
    models: ["Claude"],
    price: 1499,
    downloads: 620,
  },
  {
    title: "Lesson Plan Builder",
    creator: "edu_toolkit",
    description: "Creates structured lesson plans aligned to curriculum standards.",
    models: ["ChatGPT", "Gemini"],
    price: 0,
    downloads: 4200,
  },
];

const MODELS = ["ChatGPT", "Claude", "Gemini", "Grok"];

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="text-base font-bold tracking-tight text-foreground">
            NeoScale<span className="text-primary">.</span>
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <Link to="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link to="/submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Submit
            </Link>
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign in
            </Link>
            <Button size="sm" asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Badge variant="secondary" className="mb-6 text-xs font-medium tracking-wide uppercase">
              AI-Agnostic Agent Marketplace
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1]">
              Share AI agents that work{" "}
              <span className="text-primary">everywhere</span>.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Upload agent instructions, prompts, and configurations. Download and use them
              with ChatGPT, Claude, Gemini, Grok, or any AI tool.
            </p>
          </motion.div>

          <motion.div
            className="mt-8 flex items-center justify-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Button size="lg" asChild>
              <Link to="/explore">
                Browse Agents <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/submit">Submit Yours</Link>
            </Button>
          </motion.div>

          {/* Model pills */}
          <motion.div
            className="mt-10 flex items-center justify-center gap-2 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <span className="text-xs text-muted-foreground mr-1">Works with</span>
            {MODELS.map((m) => (
              <Badge key={m} variant="outline" className="text-xs font-normal">
                {m}
              </Badge>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Value props */}
      <section className="border-t border-border py-16 px-6">
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-10">
          {[
            { icon: Globe, title: "AI-Agnostic", desc: "Every agent works across all major AI platforms. No vendor lock-in." },
            { icon: Shield, title: "Community Reviewed", desc: "All submissions reviewed before publishing. Quality over quantity." },
            { icon: Users, title: "Creator Economy", desc: "Sell premium agents or share for free. Build your reputation." },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fade}
              className="space-y-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-secondary">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Agents */}
      <section className="border-t border-border py-16 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Featured Agents</h2>
              <p className="mt-1 text-sm text-muted-foreground">Curated by the community</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/explore">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURED_AGENTS.map((agent, i) => (
              <motion.div
                key={agent.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="group border border-border rounded-sm p-5 hover:border-primary/30 transition-colors bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {agent.title}
                  </h3>
                  {agent.price === 0 ? (
                    <Badge variant="secondary" className="text-[10px] font-medium">Free</Badge>
                  ) : (
                    <span className="text-xs font-semibold text-foreground">
                      ${(agent.price / 100).toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {agent.description}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 flex-wrap">
                    {agent.models.map((m) => (
                      <Badge key={m} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                        {m}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Download className="h-3 w-3" />
                    <span className="text-[10px]">{agent.downloads.toLocaleString()}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="text-[11px] text-muted-foreground">by @{agent.creator}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20 px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Ready to share your AI agents?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Join creators who are building the open AI agent ecosystem.
          </p>
          <Button className="mt-6" size="lg" asChild>
            <Link to="/auth">
              Create Account <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            © 2026 NeoScale AI. All rights reserved.
          </span>
          <div className="flex gap-6">
            <Link to="/explore" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link to="/submit" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Submit
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
