import { BookOpen, Compass, PenTool } from "lucide-react";
import { Link } from "react-router-dom";

interface LibraryEmptyStateProps {
  isSearching: boolean;
}

export function LibraryEmptyState({ isSearching }: LibraryEmptyStateProps) {
  if (isSearching) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div
          className="flex items-center justify-center mb-5"
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Compass
            className="h-7 w-7"
            style={{ color: "rgba(255,255,255,0.28)" }}
          />
        </div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "rgba(255,255,255,0.90)",
            marginBottom: 6,
          }}
        >
          No matching items
        </p>
        <p
          style={{
            fontSize: 13,
            fontWeight: 300,
            color: "rgba(255,255,255,0.45)",
          }}
        >
          Try adjusting your search or filters
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        style={{
          background: "rgba(16,16,24,0.72)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 20,
          padding: "48px 40px",
          maxWidth: 420,
          width: "100%",
        }}
      >
        <div
          className="mx-auto mb-6 flex items-center justify-center"
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "rgba(31,122,109,0.08)",
            border: "1px solid rgba(31,122,109,0.2)",
          }}
        >
          <BookOpen className="h-8 w-8" style={{ color: "#1F7A6D" }} />
        </div>

        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.90)",
            marginBottom: 8,
          }}
        >
          Your Library Is Empty
        </h3>
        <p
          style={{
            fontSize: 13,
            fontWeight: 300,
            color: "rgba(255,255,255,0.45)",
            marginBottom: 28,
            lineHeight: 1.6,
          }}
        >
          Start saving content to build your personal library.
          <br />
          Hit the bookmark icon on any content to save it here.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/browse"
            className="flex items-center gap-2 transition-all"
            style={{
              background: "rgba(31,122,109,0.12)",
              border: "1px solid rgba(31,122,109,0.3)",
              borderRadius: 10,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "#1F7A6D",
            }}
          >
            <Compass className="h-4 w-4" />
            Browse Content
          </Link>
          <Link
            to="/upload"
            className="flex items-center gap-2 transition-all"
            style={{
              background: "rgba(139,69,19,0.10)",
              border: "1px solid rgba(139,69,19,0.25)",
              borderRadius: 10,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "#8B4513",
            }}
          >
            <PenTool className="h-4 w-4" />
            Create Content
          </Link>
        </div>
      </div>
    </div>
  );
}
