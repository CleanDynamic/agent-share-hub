import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerDownload } from "@/lib/download";
import { CommentsSection } from "@/components/CommentsSection";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Loader2, Eye, MessageCircle } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface BlockRow {
  id: string;
  position: number;
  block_type: string;
  text_content: string | null;
  formatting: any;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  image_url: string | null;
  image_description: string | null;
  is_preview: boolean;
}

interface VariationRow {
  id: string;
  block_id: string;
  variation_label: string;
  variation_type: string;
  text_content: string | null;
  formatting: any;
  file_url: string | null;
  file_name: string | null;
  image_url: string | null;
  image_description: string | null;
  position: number;
}

interface Props {
  contentId: string;
  contentTitle?: string;
  monetisationType: string;
  creatorId: string;
  useInstructions: string | null;
  onTriggerPaywall: () => void;
  isEligible?: boolean;
}

// ─── Ad Modal ───────────────────────────────────────────────

function AdModal({
  open,
  onComplete,
  label,
  countdownSeconds = 3,
}: {
  open: boolean;
  onComplete: () => void;
  label: string;
  countdownSeconds?: number;
}) {
  const [seconds, setSeconds] = useState(countdownSeconds);

  useEffect(() => {
    if (!open) {
      setSeconds(countdownSeconds);
      return;
    }
    if (seconds <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [open, seconds, onComplete, countdownSeconds]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 px-6 text-center">
        <div className="w-[320px] h-[100px] bg-muted/40 rounded-lg flex items-center justify-center border border-border">
          <span className="text-xs text-muted-foreground">Ad Space</span>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Advertisement</p>
        <p className="text-sm text-foreground">
          {label} <span className="font-bold text-[#2EC4B6]">{seconds}</span>…
        </p>
        <a href="/login" className="text-xs text-muted-foreground hover:text-foreground underline">
          Sign in to skip ads
        </a>
      </div>
    </div>
  );
}

// ─── Block content renderer ─────────────────────────────────

function RenderBlockContent({
  type,
  textContent,
  formatting,
  fileUrl,
  fileName,
  fileSizeBytes,
  imageUrl,
  imageDescription,
  contentId,
}: {
  type: string;
  textContent: string | null;
  formatting: any;
  fileUrl: string | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  imageUrl: string | null;
  imageDescription: string | null;
  contentId: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // For images, get a signed URL
  useEffect(() => {
    if (type === "image" && imageUrl) {
      supabase.storage
        .from("content-files")
        .createSignedUrl(imageUrl, 300)
        .then(({ data }) => {
          if (data?.signedUrl) setSignedUrl(data.signedUrl);
        });
    }
  }, [type, imageUrl]);

  if (type === "text" || type === "long_text") {
    const fmt = formatting?.type ?? "paragraph";
    const items: string[] = formatting?.items ?? [];
    const text = textContent ?? "";
    const isLong = type === "long_text";

    // Long text article rendering
    if (isLong) {
      const paragraphs = text.split("\n\n").filter(Boolean);
      return (
        <div className="max-w-prose" style={{ lineHeight: 1.8 }}>
          {paragraphs.map((p, i) => {
            // Check if it's a heading (starts with # or formatting says heading)
            if (p.startsWith("# ") || (formatting?.type === "heading" && i === 0)) {
              return <h3 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">{p.replace(/^#\s*/, "")}</h3>;
            }
            return <p key={i} className="text-sm text-muted-foreground mb-[1.2em] whitespace-pre-wrap">{p}</p>;
          })}
        </div>
      );
    }

    if (fmt === "paragraph") {
      return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{text}</p>;
    }
    if (fmt === "bullets") {
      return (
        <ul className="list-disc list-inside space-y-1">
          {(items.length > 0 ? items : text.split("\n").filter(Boolean)).map((line, i) => (
            <li key={i} className="text-sm text-muted-foreground">{line}</li>
          ))}
        </ul>
      );
    }
    if (fmt === "numbers") {
      return (
        <ol className="list-decimal list-inside space-y-1">
          {(items.length > 0 ? items : text.split("\n").filter(Boolean)).map((line, i) => (
            <li key={i} className="text-sm text-muted-foreground">{line}</li>
          ))}
        </ol>
      );
    }
    if (fmt === "sub_list") {
      const entries = items.length > 0 ? items : text.split("\n").filter(Boolean);
      return (
        <ol className="list-decimal list-inside space-y-2">
          {entries.map((entry: any, i: number) => {
            if (typeof entry === "string") {
              return <li key={i} className="text-sm text-muted-foreground">{entry}</li>;
            }
            return (
              <li key={i} className="text-sm text-muted-foreground">
                {entry.text}
                {entry.sub && (
                  <ul className="ml-6 mt-1 space-y-0.5">
                    {entry.sub.map((s: string, si: number) => (
                      <li key={si} className="text-sm text-muted-foreground list-none">
                        <span className="text-muted-foreground/60 mr-1">{i + 1}{String.fromCharCode(97 + si)}.</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      );
    }
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap">{text}</p>;
  }

  if (type === "file") {
    const handleFileDownload = async () => {
      if (!fileUrl) return;
      setDownloading(true);
      try {
        const { data } = await supabase.storage.from("content-files").createSignedUrl(fileUrl, 60);
        if (data?.signedUrl) {
          const a = document.createElement("a");
          a.href = data.signedUrl;
          a.download = fileName ?? "download";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch { /* ignore */ }
      setDownloading(false);
    };

    return (
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{fileName ?? "File"}</p>
          {fileSizeBytes != null && (
            <p className="text-xs text-muted-foreground">{(fileSizeBytes / 1024).toFixed(1)} KB</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleFileDownload} disabled={downloading} className="gap-1.5">
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Download
        </Button>
      </div>
    );
  }

  if (type === "image") {
    return (
      <div>
        {signedUrl ? (
          <img src={signedUrl} alt={imageDescription ?? ""} className="w-full rounded-lg object-contain" />
        ) : (
          <Skeleton className="w-full h-48 rounded-lg" />
        )}
        {imageDescription && (
          <p className="text-xs text-muted-foreground mt-2 italic">{imageDescription}</p>
        )}
      </div>
    );
  }

  return null;
}

// ─── Main component ─────────────────────────────────────────

export function ContentBlockViewer({
  contentId,
  contentTitle = "",
  monetisationType,
  creatorId,
  useInstructions,
  onTriggerPaywall,
  isEligible = false,
}: Props) {
  const { isLoggedIn, profile } = useAuth();
  const [unblurred, setUnblurred] = useState<Record<string, boolean>>({});
  const [adModal, setAdModal] = useState<{
    blockId: string;
    phase: 1 | 2;
  } | null>(null);

  // Fetch content blocks
  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["content_blocks", contentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_blocks")
        .select("*")
        .eq("content_id", contentId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BlockRow[];
    },
  });

  // Fetch all variations for these blocks
  const blockIds = blocks?.map((b) => b.id) ?? [];
  const { data: variations } = useQuery({
    queryKey: ["block_variations", contentId, blockIds.join(",")],
    queryFn: async () => {
      if (blockIds.length === 0) return [] as VariationRow[];
      const { data, error } = await supabase
        .from("block_variations")
        .select("*")
        .in("block_id", blockIds)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VariationRow[];
    },
    enabled: blockIds.length > 0,
  });

  // Check if user has purchased / subscribed (for paid content)
  const isFree = monetisationType === "free" || monetisationType === "donation";
  const { data: hasPurchased } = useQuery({
    queryKey: ["user_has_downloaded", contentId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("downloads")
        .select("id")
        .eq("content_id", contentId)
        .eq("user_id", user.id)
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !isFree && isLoggedIn,
  });

  const { data: hasSubscription } = useQuery({
    queryKey: ["viewer_subscription_check", creatorId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("subscriber_id", user.id)
        .eq("creator_id", creatorId)
        .eq("status", "active")
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !isFree && isLoggedIn,
  });

  const paidAndUnlocked = !isFree && (hasPurchased === true || hasSubscription === true);

  // Active variation tab per block
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [blockCommentsOpen, setBlockCommentsOpen] = useState<Record<string, boolean>>({});

  const insertAdImpression = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ad_impressions").insert({
      content_id: contentId,
      user_id: user?.id ?? null,
      shown_at: new Date().toISOString(),
    });
  }, [contentId]);

  // Guest page-level ad flag
  const guestAdKey = `neoscale_page_ad_shown_${contentId}`;
  const guestPageAdShown = () => sessionStorage.getItem(guestAdKey) === "true";
  const markGuestPageAd = () => sessionStorage.setItem(guestAdKey, "true");

  const handleViewClick = useCallback(
    (blockId: string) => {
      // State D: paid, not purchased — trigger paywall
      if (!isFree && !paidAndUnlocked) {
        onTriggerPaywall();
        return;
      }

      // State C: paid, purchased — instant unblur
      if (!isFree && paidAndUnlocked) {
        setUnblurred((p) => ({ ...p, [blockId]: true }));
        return;
      }

      // State A: guest, free — one 3s ad per PAGE (not per block)
      if (!isLoggedIn) {
        if (guestPageAdShown()) {
          // Ad already shown this page session, instant unblur
          setUnblurred((p) => ({ ...p, [blockId]: true }));
          return;
        }
        setAdModal({ blockId, phase: 1 });
        insertAdImpression();
        return;
      }

      // State B: logged in, free — 1 ad modal per block
      setAdModal({ blockId, phase: 1 });
      insertAdImpression();
    },
    [isFree, paidAndUnlocked, isLoggedIn, insertAdImpression, onTriggerPaywall, contentId]
  );

  const handleAdComplete = useCallback(() => {
    if (!adModal) return;

    // Guest: single 3s ad, then done for the page
    if (!isLoggedIn) {
      markGuestPageAd();
      setUnblurred((p) => ({ ...p, [adModal.blockId]: true }));
      setAdModal(null);
      return;
    }

    // Logged-in: single ad per block
    setUnblurred((p) => ({ ...p, [adModal.blockId]: true }));
    setAdModal(null);
  }, [adModal, isLoggedIn, contentId]);

  // ─── Fallback: no blocks, show use_instructions ─────────

  if (blocksLoading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">How to Use This</h2>
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!blocks || blocks.length === 0) {
    if (!useInstructions) return null;
    return (
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">How to Use This</h2>
        <div className="border border-[#1E1E2A] rounded-xl p-5 bg-[#111118]">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-[inherit] leading-relaxed">
            {useInstructions}
          </pre>
        </div>
      </div>
    );
  }

  // ─── Block viewer ─────────────────────────────────────────

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-4">How to Use This</h2>

      {/* Ad Modal */}
      <AdModal
        open={!!adModal}
        onComplete={handleAdComplete}
        label={adModal?.phase === 1 ? "Your content unblurs in" : "Almost there..."}
      />

      <div className="relative pl-8">
        {/* Vertical timeline line */}
        <div
          className="absolute left-[15px] top-4 bottom-4 w-[2px]"
          style={{ backgroundColor: "#2EC4B6" }}
        />

        <div className="space-y-4">
          {blocks.map((block, index) => {
            const blockVariations = (variations ?? []).filter((v) => v.block_id === block.id);
            const hasVars = blockVariations.length > 0;
            const currentTab = activeTab[block.id] ?? "A";
            const isUnblurred = !!unblurred[block.id];

            // Determine which content to show
            const showingVariation = currentTab !== "A"
              ? blockVariations.find((v) => v.variation_label === currentTab)
              : null;

            return (
              <div key={block.id} className="relative">
                {/* Position circle */}
                <div
                  className="absolute -left-8 top-4 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white z-10"
                  style={{ backgroundColor: "#E8571A" }}
                >
                  {block.position}
                </div>

                <div className="border border-[#1E1E2A] rounded-xl bg-[#111118] overflow-hidden">
                  {/* Variation tabs */}
                  {hasVars && (
                    <div className="flex gap-1 px-4 pt-3 pb-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab((p) => ({ ...p, [block.id]: "A" }))}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${
                          currentTab === "A"
                            ? "font-medium border-b-2"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        style={currentTab === "A" ? { color: "#E8571A", borderColor: "#E8571A" } : {}}
                      >
                        A
                      </button>
                      {blockVariations.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setActiveTab((p) => ({ ...p, [block.id]: v.variation_label }))}
                          className={`text-xs px-3 py-1 rounded-md transition-colors ${
                            currentTab === v.variation_label
                              ? "font-medium border-b-2"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                          style={
                            currentTab === v.variation_label
                              ? { color: "#E8571A", borderColor: "#E8571A" }
                              : {}
                          }
                        >
                          {v.variation_label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Block content with blur */}
                  <div className="p-5 relative min-h-[80px]">
                    <div
                      className={isUnblurred ? "" : "blur-[8px] pointer-events-none select-none"}
                      style={{ transition: "filter 0.3s ease" }}
                    >
                      {showingVariation ? (
                        <RenderBlockContent
                          type={showingVariation.variation_type}
                          textContent={showingVariation.text_content}
                          formatting={showingVariation.formatting}
                          fileUrl={showingVariation.file_url}
                          fileName={showingVariation.file_name}
                          fileSizeBytes={null}
                          imageUrl={showingVariation.image_url}
                          imageDescription={showingVariation.image_description}
                          contentId={contentId}
                        />
                      ) : (
                        <RenderBlockContent
                          type={block.block_type}
                          textContent={block.text_content}
                          formatting={block.formatting}
                          fileUrl={block.file_url}
                          fileName={block.file_name}
                          fileSizeBytes={block.file_size_bytes}
                          imageUrl={block.image_url}
                          imageDescription={block.image_description}
                          contentId={contentId}
                        />
                      )}
                    </div>

                    {/* View button overlay */}
                    {!isUnblurred && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button
                          onClick={() => handleViewClick(block.id)}
                          className="gap-2 rounded-full px-6 text-sm font-medium text-white"
                          style={{ backgroundColor: "#2EC4B6" }}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    )}

                    {/* Block-level comments toggle */}
                    {isUnblurred && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <button
                          onClick={() => setBlockCommentsOpen((p) => ({ ...p, [block.id]: !p[block.id] }))}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <MessageCircle className="h-3 w-3" />
                          {blockCommentsOpen[block.id] ? "Hide comments" : "Comment on this block"}
                        </button>
                        {blockCommentsOpen[block.id] && (
                          <div className="mt-3">
                            <CommentsSection
                              contentId={contentId}
                              contentTitle={contentTitle}
                              blockId={block.id}
                              commentCount={0}
                              isEligible={isEligible}
                              compact
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
