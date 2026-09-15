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
            background: "var(--recess)",
            border: "1px solid var(--line)",
          }}
        >
          <Compass
            className="h-7 w-7"
            style={{ color: "var(--text2)" }}
          />
        </div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          No matching items
        </p>
        <p
          style={{
            fontSize: 13,
            fontWeight: 300,
            color: "var(--text2)",
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
          background: "var(--recess)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
          border: "1px solid var(--line)",
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
            background: "color-mix(in srgb, var(--evidence) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--evidence) 20%, transparent)",
          }}
        >
          <BookOpen className="h-8 w-8" style={{ color: "var(--evidence)" }} />
        </div>

        <h3
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 8,
          }}
        >
          Your Library Is Empty
        </h3>
        <p
          style={{
            fontSize: 13,
            fontWeight: 300,
            color: "var(--text2)",
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
              background: "color-mix(in srgb, var(--evidence) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--evidence) 30%, transparent)",
              borderRadius: 10,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--evidence)",
            }}
          >
            <Compass className="h-4 w-4" />
            Browse Content
          </Link>
          <Link
            to="/upload"
            className="flex items-center gap-2 transition-all"
            style={{
              background: "color-mix(in srgb, var(--action) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--action) 25%, transparent)",
              borderRadius: 10,
              padding: "10px 24px",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--action)",
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
