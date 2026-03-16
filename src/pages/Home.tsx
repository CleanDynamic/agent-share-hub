import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Download, Zap, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const CONTENT_TYPES = [
  {
    name: "Prompt File",
    difficulty: "Beginner",
    description: "Paste into any AI and it becomes a specialist instantly. No setup needed.",
  },
  {
    name: "Prompt Tutorial",
    difficulty: "Beginner",
    description: "Learn to write better prompts yourself. Step-by-step with examples.",
  },
  {
    name: "Agent Blueprint",
    difficulty: "Beginner",
    description: "A complete recipe: what to do, which tools, exact steps to follow.",
  },
  {
    name: "Workflow Template",
    difficulty: "Intermediate",
    description: "A ready-made automation. Import it and it runs immediately.",
  },
  {
    name: "Agent Stack",
    difficulty: "Advanced",
    description: "Multiple AI tools working together as one system. The full playbook.",
  },
  {
    name: "Model Config Guide",
    difficulty: "Beginner",
    description: "Which AI to use for which job. Closes the gap nobody explains.",
  },
  {
    name: "Integration Guide",
    difficulty: "Beginner",
    description: "Connect your AI to Gmail, Notion, Slack, and other apps you use.",
  },
  {
    name: "Evaluation Framework",
    difficulty: "Intermediate",
    description: "Test whether your AI setup is actually working. Scoring included.",
  },
  {
    name: "Failure Library",
    difficulty: "Any",
    description: "What broke, why, and exactly how to fix it. Honest and useful.",
  },
];

const FEATURED_ITEMS = [
  {
    title: "Customer Reply Assistant",
    type: "Prompt File",
    difficulty: "Beginner",
    description: "Handles common customer questions with a friendly, professional tone.",
  },
  {
    title: "Blog Post Workflow",
    type: "Workflow Template",
    difficulty: "Intermediate",
    description: "Generates SEO-optimised blog posts from a single topic keyword.",
  },
  {
    title: "How to Prompt for Research",
    type: "Prompt Tutorial",
    difficulty: "Beginner",
    description: "Step-by-step guide to getting better research results from any AI.",
  },
  {
    title: "Lead Scoring System",
    type: "Agent Stack",
    difficulty: "Advanced",
    description: "Connects your CRM, email, and AI to auto-score incoming leads.",
  },
  {
    title: "Slack + AI Notification Bot",
    type: "Integration Guide",
    difficulty: "Beginner",
    description: "Get AI-powered summaries of Slack channels delivered daily.",
  },
  {
    title: "When ChatGPT Hallucinates",
    type: "Failure Library",
    difficulty: "Any",
    description: "Real examples of AI failures with documented fixes and workarounds.",
  },
];

function difficultyColor(level: string) {
  switch (level) {
    case "Beginner":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "Intermediate":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "Advanced":
      return "bg-red-500/15 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

const STEPS = [
  {
    icon: Search,
    number: "1",
    title: "Find what you need",
    description: "Search or filter the Browse page by what you want your AI to do.",
  },
  {
    icon: Download,
    number: "2",
    title: "Download or read it",
    description: "Get the file or read the guide. Everything is plain English.",
  },
  {
    icon: Zap,
    number: "3",
    title: "Drop it into your AI",
    description: "Paste into ChatGPT, Gemini, Claude, or any AI tool. It works.",
  },
];

const fade = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.07,
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  }),
};

const Home = () => {
  return (
    <div>
      {/* ── Hero ── */}
      <section className="py-16 sm:py-24 lg:py-32 px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
          }}
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
              <Link to="/browse">
                Browse Assistants <ArrowRight className="ml-1.5 h-4 w-4" />
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
      <section className="border-t border-border py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.number}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fade}
                className="text-center space-y-3"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card">
                  <step.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="inline-block text-xs font-bold text-primary uppercase tracking-widest">
                  Step {step.number}
                </span>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9 Content Types ── */}
      <section className="border-t border-border py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            What You Can Download
          </h2>
          <p className="text-sm text-muted-foreground mb-10">
            Nine content types — from quick prompt files to full automation stacks.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${difficultyColor(ct.difficulty)}`}
                  >
                    {ct.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {ct.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured This Week ── */}
      <section className="border-t border-border py-20 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Featured This Week
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hand-picked by the community
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/browse">
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
                className="group border border-border rounded-xl p-5 bg-card hover:border-primary/40 transition-colors flex flex-col"
              >
                {/* Type badge */}
                <Badge className="self-start mb-3 text-[10px] font-medium bg-primary/15 text-primary border-primary/30">
                  {item.type}
                </Badge>

                <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-4 flex-1">
                  {item.description}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <Badge
                    variant="outline"
                    className={`text-[10px] font-medium ${difficultyColor(item.difficulty)}`}
                  >
                    {item.difficulty}
                  </Badge>
                  <Button size="sm" variant="ghost" className="text-xs text-primary hover:text-primary h-7 px-2">
                    Download Free
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
