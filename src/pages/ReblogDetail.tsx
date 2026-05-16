"use client";

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Repeat2, Play, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SeoHead } from "@/components/SeoHead";
import {
  EmbeddedOriginalCard,
  type EmbeddedOriginalCardPost,
} from "@/components/reblog/EmbeddedOriginalCard";
import { FeedReblogAdapter, type FeedReblogRow } from "@/components/reblog/FeedReblogAdapter";

function mapPostType(t?: string | null): EmbeddedOriginalCardPost["postType"] {
  const x = (t ?? "").toLowerCase();
  if (x === "blog" || x === "discussion") return "blog";
  if (x === "bounty") return "bounty";
  return "blueprint";
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

interface ReblogDetailProps {
  mode?: "detail" | "thread";
}

export default function ReblogDetail({ mode = "detail" }: ReblogDetailProps) {
  const { id: slug } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [row, setRow] = useState<any | null>(null);
  const [thread, setThread] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = async () => {
    if (!row?.id) return;
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-pdf", {
        body: { kind: "reblog", reblogId: row.id },
      });
      if (error) throw error;
      const url = (data as any)?.url;
      if (!url) throw new Error("No URL returned");
      window.open(url, "_blank");
      toast.success("AI-PDF ready");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't export PDF");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    (async () => {
      const { data, error } = await (supabase as any)
        .from("reblogs")
        .select(
          `id, slug, text, media_kind, media_url, thumbnail_url, created_at,
           like_count, comment_count, reblog_count, bookmark_count,
           parent_reblog_id, root_original_post_id, original_post_id, reblogger_id,
           reblogger:profiles!reblogs_reblogger_id_fkey(id, username, display_name, avatar_url),
           original:content_items!reblogs_original_post_id_fkey(
             id, slug, title, description, post_type, cover_image_url, created_at, creator_id,
             author:profiles!content_items_creator_id_fkey(username, display_name, avatar_url)
           )`
        )
        .eq("slug", slug)
        .is("deleted_at", null)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRow(data);

      if (mode === "thread" && data.root_original_post_id) {
        const { data: chain } = await (supabase as any)
          .from("reblogs")
          .select(
            `id, slug, text, created_at, reblogger_id,
             reblogger:profiles!reblogs_reblogger_id_fkey(username, display_name, avatar_url)`
          )
          .eq("root_original_post_id", data.root_original_post_id)
          .is("deleted_at", null)
          .order("created_at", { ascending: true });
        setThread(chain ?? []);
      }
      setLoading(false);
    })();
  }, [slug, mode]);

  if (loading) {
    return <div className="p-8 text-center text-white/50">Loading…</div>;
  }
  if (notFound || !row) {
    return (
      <div className="p-8 text-center text-white/60">
        <p>Reblog not found.</p>
        <Link to="/" className="text-emerald-400 underline mt-2 inline-block">
          Go home
        </Link>
      </div>
    );
  }

  const reblogger = row.reblogger ?? {};
  const original = row.original ?? null;

  if (mode === "thread") {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <SeoHead title="Reblog thread" description="" path={`/b/${row.slug}/thread`} />
        <button
          onClick={() => navigate(`/b/${row.slug}`)}
          className="flex items-center gap-1 text-sm text-white/60 hover:text-white mb-4"
        >
          <ArrowLeft size={14} /> Back to reblog
        </button>
        <h1 className="text-xl font-semibold text-white mb-4">Thread</h1>

        {original && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider text-white/40 mb-1">
              Original post
            </div>
            <EmbeddedOriginalCard
              variant="feed"
              post={{
                id: original.id,
                slug: original.slug,
                postType: mapPostType(original.post_type),
                title: original.title,
                description: original.description,
                authorDisplayName:
                  original.author?.display_name || original.author?.username || "Unknown",
                authorHandle: `@${original.author?.username || "unknown"}`,
                authorAvatarUrl: original.author?.avatar_url || "",
                publishedAt: original.created_at,
                coverUrl: original.cover_image_url ?? undefined,
              }}
              onClick={() => navigate(`/b/${original.slug}`)}
            />
          </div>
        )}

        <ol className="space-y-3 border-l border-white/10 pl-4">
          {thread.map((r) => {
            const u = r.reblogger ?? {};
            const isCurrent = r.id === row.id;
            return (
              <li
                key={r.id}
                className={`rounded-xl p-3 border ${
                  isCurrent
                    ? "border-emerald-400/40 bg-emerald-400/[0.04]"
                    : "border-white/8 bg-white/[0.03]"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={u.avatar_url || ""}
                    alt=""
                    className="w-6 h-6 rounded-full bg-white/10"
                  />
                  <span className="text-xs font-semibold text-white">
                    {u.display_name || u.username || "Unknown"}
                  </span>
                  <span className="text-xs text-white/40">{timeAgo(r.created_at)}</span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase text-emerald-400 ml-auto">
                      You are here
                    </span>
                  )}
                </div>
                {r.text && (
                  <button
                    className="text-sm text-white/85 text-left whitespace-pre-wrap"
                    onClick={() => !isCurrent && navigate(`/b/${r.slug}`)}
                  >
                    {r.text}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // Detail mode — full reblog article body
  const feedRow: FeedReblogRow = {
    ...row,
    embedded_original: original
      ? {
          id: original.id,
          slug: original.slug,
          title: original.title,
          description: original.description,
          post_type: original.post_type,
          cover_image_url: original.cover_image_url,
          created_at: original.created_at,
          creator_id: original.creator_id,
          author: original.author,
        }
      : null,
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <SeoHead
        title={`Reblog by @${reblogger.username ?? "unknown"}`}
        description={(row.text ?? "").slice(0, 160)} path={`/b/${row.slug}`}
      />

      <header className="flex items-center gap-3 mb-4">
        <img
          src={reblogger.avatar_url || ""}
          alt=""
          className="w-11 h-11 rounded-full bg-white/10 object-cover cursor-pointer"
          onClick={() => navigate(`/profile/${reblogger.username ?? row.reblogger_id}`)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="font-semibold text-white">
              {reblogger.display_name || reblogger.username || "Unknown"}
            </span>
            <span className="text-sm text-white/50">@{reblogger.username || "unknown"}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className="inline-flex items-center gap-1 rounded-full text-[10px] font-semibold uppercase tracking-wider"
              style={{
                padding: "2px 8px",
                color: "#34d399",
                background: "rgba(52, 211, 153, 0.12)",
              }}
            >
              <Repeat2 size={10} /> Reblog
            </span>
            <span className="text-xs text-white/40">{timeAgo(row.created_at)}</span>
          </div>
        </div>
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs text-white/80 transition-colors disabled:opacity-60"
          title="Export this reblog as an AI-friendly PDF"
        >
          {exporting ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
          AI-PDF
        </button>
      </header>

      {row.parent_reblog_id && (
        <Link
          to={`/b/${row.slug}/thread`}
          className="block mb-3 text-sm text-emerald-400 hover:underline"
        >
          ↳ View thread
        </Link>
      )}

      {row.text && (
        <p
          className="text-white/90 whitespace-pre-wrap mb-4"
          style={{ fontSize: 18, lineHeight: 1.55 }}
        >
          {row.text}
        </p>
      )}

      {row.media_url && (
        <div className="rounded-xl overflow-hidden border border-white/8 mb-4">
          {row.media_kind === "image" ? (
            <img src={row.media_url} alt="" className="w-full h-auto block" />
          ) : (
            <div className="relative">
              <video
                src={row.media_url}
                poster={row.thumbnail_url ?? undefined}
                controls
                className="w-full h-auto block"
              />
            </div>
          )}
        </div>
      )}

      <div className="mb-6">
        {original ? (
          <EmbeddedOriginalCard
            variant="feed"
            post={{
              id: original.id,
              slug: original.slug,
              postType: mapPostType(original.post_type),
              title: original.title,
              description: original.description,
              authorDisplayName:
                original.author?.display_name || original.author?.username || "Unknown",
              authorHandle: `@${original.author?.username || "unknown"}`,
              authorAvatarUrl: original.author?.avatar_url || "",
              publishedAt: original.created_at,
              coverUrl: original.cover_image_url ?? undefined,
            }}
            onClick={() => navigate(`/b/${original.slug}`)}
          />
        ) : (
          <div className="rounded-xl border border-white/8 bg-white/[0.04] p-4 text-sm text-white/40 text-center">
            Original post is no longer available
          </div>
        )}
      </div>

      {/* Re-use the feed card's engagement row by mounting the adapter here too. */}
      <div className="border-t border-white/10 pt-4">
        <FeedReblogAdapter row={feedRow} variant="feed" />
      </div>
    </div>
  );
}

export function ReblogThread() {
  return <ReblogDetail mode="thread" />;
}
