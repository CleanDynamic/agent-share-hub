/**
 * BlogView — public read-only renderer for a blog (post_type === 'blog').
 *
 * Routing: per Phase 4 we use **Approach A** — the existing /content/:id
 * route serves all post types, and ContentDetail branches on `post_type`
 * to mount the appropriate viewer. Slugs (and ids) are unique app-wide.
 *
 * This component renders just the article surface; the host page handles
 * data fetching, SEO, and the back button.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import ImageExtension from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { Heart, MessageSquare, Bookmark, Share2, Clock } from "lucide-react";
import { BlogReferenceExtension } from "./BlogReferenceExtension";
import { validateReferences } from "@/lib/blog/validateReferences";
import { absoluteUrl, copyToClipboard } from "@/lib/deepLink";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookmarkButton } from "@/components/BookmarkButton";

const lowlight = createLowlight(common);

interface BlogViewProps {
  item: any; // content_items row, with `profiles` join
}

interface CreatorProfile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url?: string | null;
}

function formatDate(s?: string | null) {
  if (!s) return "";
  return new Date(s).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function estimateReadingMinutes(item: any): number {
  if (item.estimated_reading_minutes && item.estimated_reading_minutes > 0)
    return item.estimated_reading_minutes;
  const wc = item.word_count ?? 0;
  return Math.max(1, Math.round(wc / 220));
}

export function BlogView({ item }: BlogViewProps) {
  const navigate = useNavigate();
  const creator = (item?.profiles as CreatorProfile | null) ?? null;
  const [validatedBody, setValidatedBody] = useState<any>(item?.article_body ?? null);
  const [likeCount, setLikeCount] = useState<number>(item?.view_count ?? 0); // safe fallback
  const [liked, setLiked] = useState(false);
  const validationCacheRef = useRef<string | null>(null);

  // Validate references once on mount (and whenever the article body changes).
  useEffect(() => {
    let cancelled = false;
    const body = item?.article_body;
    if (!body || typeof body !== "object") {
      setValidatedBody(body);
      return;
    }
    const fingerprint = JSON.stringify(body);
    if (validationCacheRef.current === fingerprint) return;

    (async () => {
      try {
        // Deep-clone so we never mutate the React Query cache entry.
        const clone = JSON.parse(fingerprint);
        const { body: next } = await validateReferences(clone);
        if (cancelled) return;
        validationCacheRef.current = fingerprint;
        setValidatedBody(next);
      } catch (err) {
        console.warn("[BlogView] reference validation failed", err);
        if (!cancelled) setValidatedBody(body);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.article_body]);

  const editor = useEditor(
    {
      editable: false,
      // Blog mode: no StageGridExtension; readers don't navigate canvases.
      // Inline references are first-class via BlogReferenceExtension.
      extensions: [
        StarterKit.configure({
          codeBlock: false,
          heading: { levels: [1, 2, 3] },
        }),
        ImageExtension.configure({ inline: false }),
        CodeBlockLowlight.configure({ lowlight }),
        BlogReferenceExtension,
      ],
      content: validatedBody || { type: "doc", content: [{ type: "paragraph" }] },
    },
    [validatedBody],
  );

  // Like button — best-effort (uses content_views increment as a placeholder
  // when no dedicated likes table is wired for blogs yet).
  const onLike = () => {
    setLiked((v) => !v);
    setLikeCount((n) => (liked ? Math.max(0, n - 1) : n + 1));
  };

  const onShare = async () => {
    const ok = await copyToClipboard(absoluteUrl(`/content/${item.id}`));
    toast[ok ? "success" : "error"](ok ? "Link copied" : "Could not copy link");
  };

  const onComment = () => {
    const el = document.getElementById("blog-comments");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tags: string[] = useMemo(() => {
    const t = item?.tags ?? item?.custom_tags ?? [];
    return Array.isArray(t) ? t : [];
  }, [item]);

  const readingMinutes = estimateReadingMinutes(item);
  const authorName = creator?.display_name || creator?.username || "Anonymous";
  const authorHandle = creator?.username ? `@${creator.username}` : "";
  const cover = item?.cover_image_url as string | null;

  return (
    <article className="w-full">
      {/* Cover hero (edge to edge, max-h 360) */}
      {cover && (
        <div
          className="w-full overflow-hidden"
          style={{ maxHeight: 360, borderRadius: 0 }}
        >
          <img
            src={cover}
            alt={item.title}
            loading="eager"
            className="w-full object-cover"
            style={{ maxHeight: 360, display: "block" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div
        className="mx-auto"
        style={{ maxWidth: 720, padding: "48px 24px" }}
      >
        {/* Author byline */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => creator && navigate(`/u/${creator.username}`)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            style={{ background: "transparent", border: 0, padding: 0, cursor: creator ? "pointer" : "default" }}
            aria-label={`Author: ${authorName}`}
          >
            <div
              className="rounded-full overflow-hidden flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {creator?.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={authorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {authorName}
              </span>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  fontWeight: 400,
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {authorHandle}
                {authorHandle && (item.published_at || item.created_at) ? " · " : ""}
                {formatDate(item.published_at || item.created_at)}
                {" · "}
                <Clock size={10} className="inline -mt-0.5 mr-0.5" />
                {readingMinutes} min read
              </span>
            </div>
          </button>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.15,
            color: "rgba(255,255,255,0.96)",
            margin: 0,
          }}
        >
          {item.title}
        </h1>

        {/* Subtitle */}
        {item.subtitle && (
          <p
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 18,
              fontStyle: "italic",
              fontWeight: 400,
              color: "rgba(255,255,255,0.60)",
              margin: "12px 0 0 0",
              lineHeight: 1.4,
            }}
          >
            {item.subtitle}
          </p>
        )}

        {/* Body */}
        <div style={{ height: 32 }} />
        <div className="blog-view-prose">
          <EditorContent editor={editor} />
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-12 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span
                key={t}
                className="px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(46,196,182,0.08)",
                  border: "0.5px solid rgba(46,196,182,0.20)",
                  color: "rgba(46,196,182,0.95)",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* Engagement controls */}
        <div
          className="mt-10 flex items-center gap-3"
          style={{
            paddingTop: 16,
            borderTop: "0.5px solid rgba(255,255,255,0.06)",
          }}
        >
          <EngagementButton
            label="Like"
            icon={Heart}
            active={liked}
            count={likeCount}
            onClick={onLike}
          />
          <EngagementButton
            label="Comment"
            icon={MessageSquare}
            count={item.comment_count ?? 0}
            onClick={onComment}
          />
          <BookmarkButton contentId={item.id} variant="ghost" />
          <EngagementButton
            label="Share"
            icon={Share2}
            onClick={onShare}
          />
        </div>

        {/* Author card */}
        {creator && (
          <div
            className="mt-10 p-5 rounded-xl flex items-start gap-4"
            style={{
              background: "rgba(22,22,30,0.40)",
              border: "0.5px solid rgba(255,255,255,0.06)",
            }}
          >
            <div
              className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                background: "rgba(255,255,255,0.06)",
                border: "0.5px solid rgba(255,255,255,0.08)",
              }}
            >
              {creator.avatar_url ? (
                <img
                  src={creator.avatar_url}
                  alt={authorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                >
                  {authorName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`/u/${creator.username}`)}
                style={{
                  background: "transparent",
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                {authorName}
              </button>
              {authorHandle && (
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.45)",
                    marginLeft: 6,
                  }}
                >
                  {authorHandle}
                </span>
              )}
              {creator.bio && (
                <p
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "rgba(255,255,255,0.65)",
                    lineHeight: 1.55,
                    margin: "6px 0 0 0",
                  }}
                >
                  {creator.bio}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Anchor for the comment scroll target — actual comments UI is
            rendered by the host page (ContentDetail) below the article. */}
        <div id="blog-comments" />
      </div>

      {/* Blog body styles — match the editor's writing surface. */}
      <style>{`
        .blog-view-prose .ProseMirror {
          font-family: Inter, sans-serif;
          font-size: 16px;
          line-height: 1.85;
          color: rgba(255,255,255,0.86);
          outline: none;
        }
        .blog-view-prose .ProseMirror > * + * { margin-top: 1.1em; }
        .blog-view-prose .ProseMirror h1,
        .blog-view-prose .ProseMirror h2 {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          color: rgba(255,255,255,0.94);
          line-height: 1.25;
        }
        .blog-view-prose .ProseMirror h1 { font-size: 28px; margin-top: 1.6em; }
        .blog-view-prose .ProseMirror h2 { font-size: 22px; margin-top: 1.4em; }
        .blog-view-prose .ProseMirror h3 {
          font-family: Inter, sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
          margin-top: 1.2em;
        }
        .blog-view-prose .ProseMirror a {
          color: rgba(46,196,182,0.95);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .blog-view-prose .ProseMirror blockquote {
          border-left: 3px solid rgba(46,196,182,0.45);
          padding-left: 14px;
          color: rgba(255,255,255,0.72);
          font-style: italic;
        }
        .blog-view-prose .ProseMirror code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 13px;
          background: rgba(255,255,255,0.06);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .blog-view-prose .ProseMirror pre {
          background: rgba(15,15,22,0.7);
          border: 0.5px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          padding: 14px 16px;
          overflow-x: auto;
        }
        .blog-view-prose .ProseMirror pre code { background: transparent; padding: 0; }
        .blog-view-prose .ProseMirror img {
          max-width: 100%;
          border-radius: 8px;
        }
        .blog-view-prose .ProseMirror ul,
        .blog-view-prose .ProseMirror ol { padding-left: 1.4em; }
      `}</style>
    </article>
  );
}

/* ── Helpers ─────────────────────────────────────── */

function EngagementButton({
  label,
  icon: Icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  count?: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full transition-colors"
      style={{
        background: active ? "rgba(232,87,26,0.10)" : "rgba(255,255,255,0.03)",
        border: active
          ? "0.5px solid rgba(232,87,26,0.40)"
          : "0.5px solid rgba(255,255,255,0.08)",
        color: active ? "#E8571A" : "rgba(255,255,255,0.75)",
        fontFamily: "Inter, sans-serif",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      <Icon size={13} />
      <span>{label}</span>
      {typeof count === "number" && count > 0 && (
        <span style={{ opacity: 0.7 }}>{count}</span>
      )}
    </button>
  );
}

export default BlogView;
