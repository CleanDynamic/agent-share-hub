import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background py-10 px-6">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        {/* Left */}
        <div>
          <span className="text-sm font-bold text-primary">NeoScale AI</span>
          <p className="text-xs text-muted-foreground mt-1">
            The AI Tactics Forum. For Builders and Normies.
          </p>
        </div>

        {/* Right */}
        <div className="flex items-center gap-5">
          <Link to="/browse" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Browse
          </Link>
          <Link to="/upload" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Upload
          </Link>
          <Link to="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <a
            href="https://twitter.com/neoscaleai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            @neoscaleai
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-6xl mt-8 pt-6 border-t border-border">
        <p className="text-[11px] text-muted-foreground">© 2026 NeoScale AI. All rights reserved.</p>
      </div>
    </footer>
  );
}
