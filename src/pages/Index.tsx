import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Download, Globe, Shield, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const CONTENT_TYPES = [
  { name: "Prompt File", level: "Beginner", color: "hsl(142, 71%, 45%)" },
  { name: "Prompt Tutorial", level: "Beginner-Mid", color: "hsl(130, 60%, 44%)" },
  { name: "Agent Blueprint", level: "Beginner-Mid", color: "hsl(100, 55%, 45%)" },
  { name: "Workflow Template", level: "Intermediate", color: "hsl(45, 93%, 47%)" },
  { name: "Agent Stack", level: "Advanced", color: "hsl(0, 72%, 51%)" },
  { name: "Model Config Guide", level: "Beginner", color: "hsl(142, 71%, 45%)" },
  { name: "Integration Guide", level: "Beginner-Mid", color: "hsl(100, 55%, 45%)" },
  { name: "Evaluation Framework", level: "Intermediate", color: "hsl(35, 90%, 50%)" },
  { name: "Failure Library", level: "Any", color: "hsl(240, 8%, 63%)" },
];

const FEATURED_ITEMS = [
  {
    title: "Customer Support Automation",
    creator: "sarah_ai",
    description: "A ready-made setup that handles common customer questions across email and chat.",
    contentType: "Workflow Template",
    tools: ["ChatGPT", "Zapier"],
    level: "Intermediate",
    price: 0,
    downloads: 2340,
  },
  {
    title: "Code Review Assistant",
    creator: "devtools",
    description: "Reviews your pull requests with security analysis and performance tips.",
    contentType: "Agent Blueprint",
    tools: ["Claude", "Gemini"],
    level: "Beginner-Mid",
    price: 499,
    downloads: 1820,
  },
  {
    title: "Weekly Newsletter Writer",
    creator: "marketingmax",
    description: "Writes conversion-focused email sequences for SaaS onboarding.",
    contentType: "Prompt File",
    tools: ["ChatGPT", "Grok"],
    level: "Beginner",
    price: 0,
    downloads: 3100,
  },
  {
    title: "Sales Pipeline Tracker",
    creator: "analytics_co",
    description: "Connect your apps to automatically track and score incoming leads.",
    contentType: "Agent Stack",
    tools: ["ChatGPT", "Make", "n8n"],
    level: "Advanced",
    price: 999,
    downloads: 950,
  },
  {
    title: "Contract Clause Drafter",
    creator: "legalai",
    description: "Generates NDA templates and contract clauses from plain-language instructions.",
    contentType: "Prompt Tutorial",
    tools: ["Claude"],
    level: "Beginner-Mid",
    price: 1499,
    downloads: 620,
  },
  {
    title: "Lesson Plan Builder",
    creator: "edu_toolkit",
    description: "Creates structured lesson plans aligned to curriculum standards.",
    contentType: "Model Config Guide",
    tools: ["ChatGPT", "Gemini"],
    level: "Beginner",
    price: 0,
    downloads: 4200,
  },
];

const AI_TOOLS = ["ChatGPT", "Claude", "Gemini", "Grok", "Zapier", "Make", "n8n"];

function getContentTypeColor(typeName: string): string {
  const ct = CONTENT_TYPES.find((c) => c.name === typeName);
  return ct?.color ?? "hsl(240, 8%, 63%)";
}

const fade = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
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
            transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] }}
          >
            <Badge className="mb-6 text-xs font-medium tracking-wide uppercase bg-primary/15 text-primary border-primary/30">
              The AI Tactics Forum
            </Badge>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.1]">
              AI setups that work{" "}
              <span className="text-primary">everywhere</span>.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Download ready-made AI automations, prompt files, and blueprints. 
              Use them with ChatGPT, Claude, Gemini, Grok, or any tool you like.
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
                Browse Library <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-secondary text-secondary hover:bg-secondary/10" asChild>
              <Link to="/submit">Submit Yours</Link>
            </Button>
          </motion.div>

          {/* AI Tool pills */}
          <motion.div
            className="mt-10 flex items-center justify-center gap-2 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <span className="text-xs text-muted-foreground mr-1">Works with</span>
            {AI_TOOLS.map((m) => (
              <Badge key={m} variant="outline" className="text-xs font-normal text-muted-foreground">
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
            { icon: Globe, title: "Works With Any AI", desc: "Every download works across all major AI tools. No vendor lock-in, ever." },
            { icon: Shield, title: "Community Reviewed", desc: "All submissions reviewed before publishing. Quality over quantity." },
            { icon: Users, title: "For Builders & Normies", desc: "Sell premium setups or share for free. From beginners to advanced creators." },
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
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Content Types */}
      <section className="border-t border-border py-16 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">9 Content Types</h2>
          <p className="text-sm text-muted-foreground mb-8">From simple prompt files to advanced automation stacks</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {CONTENT_TYPES.map((ct, i) => (
              <motion.div
                key={ct.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="border border-border rounded-lg p-4 bg-card"
              >
                <div
                  className="h-1.5 w-8 rounded-full mb-3"
                  style={{ backgroundColor: ct.color }}
                />
                <p className="text-xs font-semibold text-foreground">{ct.name}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{ct.level}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Items */}
      <section className="border-t border-border py-16 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Featured</h2>
              <p className="mt-1 text-sm text-muted-foreground">Curated by the community</p>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
              <Link to="/explore">
                View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURED_ITEMS.map((item, i) => (
              <motion.div
                key={item.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="group border border-border rounded-lg p-5 hover:border-primary/40 transition-colors bg-card"
              >
                {/* Type badge + price */}
                <div className="flex items-start justify-between mb-3">
                  <Badge
                    className="text-[10px] font-medium border-0"
                    style={{
                      backgroundColor: `${getContentTypeColor(item.contentType)}20`,
                      color: getContentTypeColor(item.contentType),
                    }}
                  >
                    {item.contentType}
                  </Badge>
                  {item.price === 0 ? (
                    <Badge variant="outline" className="text-[10px] font-medium text-secondary border-secondary/40">
                      Free
                    </Badge>
                  ) : (
                    <span className="text-xs font-semibold text-foreground">
                      ${(item.price / 100).toFixed(2)}
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                  {item.description}
                </p>

                {/* Difficulty + tools */}
                <div className="flex items-center justify-between mb-3">
                  <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                    {item.level}
                  </Badge>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {item.tools.map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px] font-normal px-1.5 py-0 text-muted-foreground">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">by @{item.creator}</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Download className="h-3 w-3" />
                    <span className="text-[10px]">{item.downloads.toLocaleString()}</span>
                  </div>
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
            Ready to share your AI setups?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Join creators who are building the open AI automation ecosystem.
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
