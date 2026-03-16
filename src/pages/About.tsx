import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const About = () => {
  return (
    <div className="py-16 px-6">
      <div className="mx-auto max-w-2xl space-y-12">
        {/* Main content */}
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">About NeoScale AI</h1>

          <p className="text-sm text-muted-foreground leading-relaxed">
            NeoScale AI is the community hub for people who want to use AI — not just talk about it.
            Like Football Manager tactics forums, we let experts share the AI setups they have already
            built so that anyone — technical or not — can download and use them immediately.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Everything on the platform is AI-agnostic. Whether you use ChatGPT, Gemini, Claude,
            Grok, or something else entirely, the content here is built to work with your tools.
            Every item is reviewed before it goes live. No junk, no untested prompts.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed">
            The platform is free to browse and download. Creators who invest time building
            high-quality content have five ways to earn from it: donations, subscriptions, direct
            sales, personalised commissions, and a share of ad revenue as the platform grows.
          </p>
        </div>

        {/* Get in Touch */}
        <div className="border-t border-border pt-10 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Get in Touch</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>
              Twitter:{" "}
              <a
                href="https://twitter.com/neoscaleai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                @neoscaleai
              </a>
            </li>
            <li>
              Email:{" "}
              <span className="text-foreground">hello@neoscale.ai</span>
            </li>
          </ul>
        </div>

        {/* For Creators */}
        <div className="border-t border-border pt-10 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">For Creators</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Want to share your work and earn from it? The Upload page is open
            to everyone. We review every submission before it goes live. Quality over quantity, always.
          </p>
          <Button asChild>
            <Link to="/upload">
              Upload Your Work <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default About;
