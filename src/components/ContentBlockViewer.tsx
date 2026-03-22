import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerDownload } from "@/lib/download";
import { CommentsSection } from "@/components/CommentsSection";
import { MentionText } from "@/components/MentionText";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Download, Loader2, Eye, MessageCircle, ChevronRight, ClipboardList, Github, Cloud, ExternalLink } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────

interface BlockRow {
  id: string;
  position: number;
  block_type: string;
  text_content: string | null;
  formatting: any;
  formatting_type: string | null;
  sub_blocks: any;
  use_instructions: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  image_url: string | null;
  image_description: string | null;
  is_preview: boolean;
  external_file_url: string | null;
  github_url: string | null;
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
  contentType?: string;
}

// ─── Ad Modal ───────────────────────────────────────────────

function AdModal({ open, onComplete, label, countdownSeconds = 3 }: {
  open: boolean; onComplete: () => void; label: string; countdownSeconds?: number;
}) {
  const [seconds, setSeconds] = useState(countdownSeconds);
  useEffect(() => {
    if (!open) { setSeconds(countdownSeconds); return; }
    if (seconds <= 0) { onComplete(); return; }
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
        <a href="/login" className="text-xs text-muted-foreground hover:text-foreground underline">Sign in to skip ads</a>
      </div>
    </div>
  );
}

// ─── External host detection ────────────────────────────────

function detectHostName(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("drive.google.com")) return "Google Drive";
    if (hostname.includes("dropbox.com")) return "Dropbox";
    if (hostname.includes("mega.nz")) return "Mega";
    if (hostname.includes("onedrive.live.com")) return "OneDrive";
    if (hostname.includes("wetransfer.com")) return "WeTransfer";
    if (hostname.includes("github.com")) return "GitHub";
    return "External host";
  } catch {
    return "External host";
  }
}

// ─── GitHub block renderer ──────────────────────────────────

function RenderGitHubBlock({ textContent, subBlocks }: { textContent: string | null; subBlocks: any }) {
  if (!textContent) return null;
  const desc = Array.isArray(subBlocks) && subBlocks[0]?.description ? subBlocks[0].description : null;
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(36, 41, 47, 0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <a
        href={textContent}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors"
        style={{ backgroundColor: "#2EC4B6", color: "#fff" }}
      >
        <Github className="h-4 w-4" />
        View on GitHub →
      </a>
      {desc && <p className="text-[13px] text-muted-foreground mt-2">{desc}</p>}
    </div>
  );
}

// ─── Large File block renderer ──────────────────────────────

function RenderLargeFileBlock({ textContent, subBlocks }: { textContent: string | null; subBlocks: any }) {
  if (!textContent) return null;
  const meta = Array.isArray(subBlocks) && subBlocks[0] ? subBlocks[0] : {};
  const platform = meta.platform || detectHostName(textContent);
  const customPlatform = meta.custom_platform;
  const description = meta.description;
  const sizeHint = meta.file_size_hint;
  const displayPlatform = platform === "Other" && customPlatform ? customPlatform : platform;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid hsl(var(--border))" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">{displayPlatform}</span>
        {sizeHint && <span className="text-xs text-muted-foreground">{sizeHint}</span>}
      </div>
      {description && <p className="text-sm font-medium text-foreground mb-3">{description}</p>}
      <a
        href={textContent}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full h-10 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <Download className="h-4 w-4" />
        Download from {displayPlatform} →
      </a>
    </div>
  );
}

// ─── Block content renderer ─────────────────────────────────

function RenderBlockContent({
  type, textContent, formatting, formattingType, subBlocks,
  fileUrl, fileName, fileSizeBytes, imageUrl, imageDescription, contentId, isBlogContent,
}: {
  type: string; textContent: string | null; formatting: any; formattingType: string | null;
  subBlocks: any; fileUrl: string | null; fileName: string | null; fileSizeBytes: number | null;
  imageUrl: string | null; imageDescription: string | null; contentId: string; isBlogContent?: boolean;
}) {
  const [downloading, setDownloading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (type === "image" && imageUrl) {
      supabase.storage.from("content-files").createSignedUrl(imageUrl, 300).then(({ data }) => {
        if (data?.signedUrl) setSignedUrl(data.signedUrl);
      });
    }
  }, [type, imageUrl]);

  // GitHub block
  if (type === "github") return <RenderGitHubBlock textContent={textContent} subBlocks={subBlocks} />;

  // Large File block
  if (type === "large_file") return <RenderLargeFileBlock textContent={textContent} subBlocks={subBlocks} />;

  if (type === "text" || type === "long_text") {
    const fmt = formattingType ?? formatting?.type ?? "paragraph";
    const items: string[] = formatting?.items ?? [];
    const text = textContent ?? "";
    const isLong = type === "long_text";

    if (isLong) {
      const paragraphs = text.split("\n\n").filter(Boolean);
      return (
        <div className="max-w-full" style={{ lineHeight: isBlogContent ? 1.85 : 1.8 }}>
          {paragraphs.map((p, i) => {
            if (p.startsWith("# ") || (formatting?.type === "heading" && i === 0))
              return <h3 key={i} className={`font-bold text-foreground mt-4 mb-2 ${isBlogContent ? "text-xl" : "text-lg"}`}>{p.replace(/^#\s*/, "")}</h3>;
            return <p key={i} className={`text-muted-foreground whitespace-pre-wrap ${isBlogContent ? "text-base mb-[1.4em]" : "text-sm mb-[1.2em]"}`}><MentionText text={p} /></p>;
          })}
        </div>
      );
    }

    if (fmt === "paragraph") return <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"><MentionText text={text} /></p>;
    if (fmt === "bullets") return (
      <ul className="list-disc list-inside space-y-1">
        {(items.length > 0 ? items : text.split("\n").filter(Boolean)).map((line, i) => <li key={i} className="text-sm text-muted-foreground"><MentionText text={line} /></li>)}
      </ul>
    );
    if (fmt === "numbers") return (
      <ol className="list-decimal list-inside space-y-1">
        {(items.length > 0 ? items : text.split("\n").filter(Boolean)).map((line, i) => <li key={i} className="text-sm text-muted-foreground"><MentionText text={line} /></li>)}
      </ol>
    );
    if (fmt === "sub_list") {
      const parentLabel = text;
      const subs: string[] = Array.isArray(subBlocks) ? subBlocks : [];
      return (
        <div className="space-y-1">
          <p className="text-sm text-foreground font-medium"><MentionText text={parentLabel} /></p>
          {subs.length > 0 && (
            <div className="ml-6 space-y-0.5">
              {subs.map((s, si) => <p key={si} className="text-sm text-muted-foreground"><span className="text-muted-foreground/60 mr-1.5">↳</span>{s}</p>)}
            </div>
          )}
        </div>
      );
    }
    return <p className="text-sm text-muted-foreground whitespace-pre-wrap"><MentionText text={text} /></p>;
  }

  if (type === "file") {
    const handleFileDownload = async () => {
      if (!fileUrl) return;
      setDownloading(true);
      try {
        const { data } = await supabase.storage.from("content-files").createSignedUrl(fileUrl, 60);
        if (data?.signedUrl) {
          const a = document.createElement("a"); a.href = data.signedUrl; a.download = fileName ?? "download";
          document.body.appendChild(a); a.click(); a.remove();
        }
      } catch { /* ignore */ }
      setDownloading(false);
    };
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
        <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{fileName ?? "File"}</p>
          {fileSizeBytes != null && <p className="text-xs text-muted-foreground">{(fileSizeBytes / 1024).toFixed(1)} KB</p>}
        </div>
        <Button variant="outline" size="sm" onClick={handleFileDownload} disabled={downloading} className="gap-1.5">
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}Download
        </Button>
      </div>
    );
  }

  if (type === "image") {
    return (
      <div>
        {signedUrl ? <img src={signedUrl} alt={imageDescription ?? ""} className="w-full rounded-lg object-contain" /> : <Skeleton className="w-full h-48 rounded-lg" />}
        {imageDescription && <p className="text-xs text-muted-foreground mt-2 italic">{imageDescription}</p>}
      </div>
    );
  }

  return null;
}

// ─── Main component ─────────────────────────────────────────

export function ContentBlockViewer({
  contentId, contentTitle = "", monetisationType, creatorId,
  useInstructions, onTriggerPaywall, isEligible = false, contentType,
}: Props) {
  const { isLoggedIn, profile } = useAuth();
  const isBlog = contentType === "Blog";
  const [unblurred, setUnblurred] = useState<Record<string, boolean>>({});
  const [adModal, setAdModal] = useState<{ blockId: string; phase: 1 | 2 } | null>(null);

  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["content_blocks", contentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("content_blocks").select("*").eq("content_id", contentId).order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BlockRow[];
    },
  });

  const blockIds = blocks?.map((b) => b.id) ?? [];
  const { data: variations } = useQuery({
    queryKey: ["block_variations", contentId, blockIds.join(",")],
    queryFn: async () => {
      if (blockIds.length === 0) return [] as VariationRow[];
      const { data, error } = await supabase.from("block_variations").select("*").in("block_id", blockIds).order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as VariationRow[];
    },
    enabled: blockIds.length > 0,
  });

  const isFree = monetisationType === "free" || monetisationType === "donation";
  const { data: hasPurchased } = useQuery({
    queryKey: ["user_has_downloaded", contentId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("downloads").select("id").eq("content_id", contentId).eq("user_id", user.id).limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !isFree && isLoggedIn,
  });

  const { data: hasSubscription } = useQuery({
    queryKey: ["viewer_subscription_check", creatorId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase.from("subscriptions").select("id").eq("subscriber_id", user.id).eq("creator_id", creatorId).eq("status", "active").limit(1);
      return (data?.length ?? 0) > 0;
    },
    enabled: !isFree && isLoggedIn,
  });

  const paidAndUnlocked = !isFree && (hasPurchased === true || hasSubscription === true);

  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [blockCommentsOpen, setBlockCommentsOpen] = useState<Record<string, boolean>>({});
  const [blockInstrOpen, setBlockInstrOpen] = useState<Record<string, boolean>>({});

  const insertAdImpression = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("ad_impressions").insert({ content_id: contentId, user_id: user?.id ?? null, shown_at: new Date().toISOString() });
  }, [contentId]);

  const guestAdKey = `neoscale_page_ad_shown_${contentId}`;
  const guestPageAdShown = () => sessionStorage.getItem(guestAdKey) === "true";
  const markGuestPageAd = () => sessionStorage.setItem(guestAdKey, "true");

  const handleViewClick = useCallback(
    (blockId: string) => {
      if (!isFree && !paidAndUnlocked) { onTriggerPaywall(); return; }
      if (!isFree && paidAndUnlocked) { setUnblurred((p) => ({ ...p, [blockId]: true })); return; }
      if (!isLoggedIn) {
        if (guestPageAdShown()) { setUnblurred((p) => ({ ...p, [blockId]: true })); return; }
        setAdModal({ blockId, phase: 1 }); insertAdImpression(); return;
      }
      setAdModal({ blockId, phase: 1 }); insertAdImpression();
    },
    [isFree, paidAndUnlocked, isLoggedIn, insertAdImpression, onTriggerPaywall, contentId]
  );

  const handleAdComplete = useCallback(() => {
    if (!adModal) return;
    if (!isLoggedIn) { markGuestPageAd(); setUnblurred((p) => ({ ...p, [adModal.blockId]: true })); setAdModal(null); return; }
    setUnblurred((p) => ({ ...p, [adModal.blockId]: true })); setAdModal(null);
  }, [adModal, isLoggedIn, contentId]);

  if (blocksLoading) {
    return (
      <div>
        <div className="space-y-3"><Skeleton className="h-28 w-full rounded-xl" /><Skeleton className="h-28 w-full rounded-xl" /></div>
      </div>
    );
  }

  if (!blocks || blocks.length === 0) {
    if (!useInstructions) return null;
    return (
      <div>
        <div className="border border-[#1E1E2A] rounded-xl p-5 bg-[#111118]">
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-[inherit] leading-relaxed">{useInstructions}</pre>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AdModal open={!!adModal} onComplete={handleAdComplete} label="Your content unblurs in" countdownSeconds={3} />

      <div className="relative pl-8">
        <div className="absolute left-[15px] top-4 bottom-4 w-[2px]" style={{ backgroundColor: "#2EC4B6" }} />
        <div className="space-y-4">
          {blocks.map((block, index) => {
            const blockVariations = (variations ?? []).filter((v) => v.block_id === block.id);
            const hasVars = blockVariations.length > 0;
            const currentTab = activeTab[block.id] ?? "A";
            const isPreview = !!block.is_preview;
            const isGitHub = block.block_type === "github";
            // GitHub blocks are NEVER blurred
            const isUnblurred = isBlog || isPreview || isGitHub || !!unblurred[block.id];

            const showingVariation = currentTab !== "A" ? blockVariations.find((v) => v.variation_label === currentTab) : null;

            return (
              <div key={block.id} className="relative">
                <div
                  className="absolute -left-8 top-4 w-[30px] h-[30px] rounded-full flex items-center justify-center text-xs font-bold text-white z-10"
                  style={{ backgroundColor: "#E8571A" }}
                >
                  {block.position}
                </div>

                <div className={`border rounded-xl overflow-hidden ${isPreview ? "border-[#2EC4B6]/40 bg-[#111118]" : "border-[#1E1E2A] bg-[#111118]"}`}>
                  {/* Variation tabs */}
                  {hasVars && (
                    <div className="flex gap-1 px-4 pt-3 pb-1">
                      <button type="button" onClick={() => setActiveTab((p) => ({ ...p, [block.id]: "A" }))}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${currentTab === "A" ? "font-medium border-b-2" : "text-muted-foreground hover:text-foreground"}`}
                        style={currentTab === "A" ? { color: "#E8571A", borderColor: "#E8571A" } : {}}>A</button>
                      {blockVariations.map((v) => (
                        <button key={v.id} type="button" onClick={() => setActiveTab((p) => ({ ...p, [block.id]: v.variation_label }))}
                          className={`text-xs px-3 py-1 rounded-md transition-colors ${currentTab === v.variation_label ? "font-medium border-b-2" : "text-muted-foreground hover:text-foreground"}`}
                          style={currentTab === v.variation_label ? { color: "#E8571A", borderColor: "#E8571A" } : {}}>{v.variation_label}</button>
                      ))}
                    </div>
                  )}

                  {/* Block content with blur */}
                  <div className="p-5 relative min-h-[80px]">
                    <div className={isUnblurred ? "" : "blur-[6px] pointer-events-none select-none"} style={{ transition: "filter 0.3s ease" }}>
                      {showingVariation ? (
                        <RenderBlockContent type={showingVariation.variation_type} textContent={showingVariation.text_content} formatting={showingVariation.formatting}
                          formattingType={null} subBlocks={null} fileUrl={showingVariation.file_url} fileName={showingVariation.file_name} fileSizeBytes={null}
                          imageUrl={showingVariation.image_url} imageDescription={showingVariation.image_description} contentId={contentId} isBlogContent={isBlog} />
                      ) : (
                        <RenderBlockContent type={block.block_type} textContent={block.text_content} formatting={block.formatting}
                          formattingType={block.formatting_type} subBlocks={block.sub_blocks} fileUrl={block.file_url} fileName={block.file_name}
                          fileSizeBytes={block.file_size_bytes} imageUrl={block.image_url} imageDescription={block.image_description} contentId={contentId} isBlogContent={isBlog} />
                      )}
                    </div>

                    {/* External file download button */}
                    {isUnblurred && block.external_file_url && (
                      <div className="mt-3 px-1">
                        <a href={block.external_file_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors hover:bg-accent/60"
                          style={{ borderColor: "#2EC4B6", color: "#2EC4B6" }}>
                          <Download className="h-3.5 w-3.5" />Download from {detectHostName(block.external_file_url)} →
                        </a>
                      </div>
                    )}

                    {/* Legacy GitHub pill (for old blocks that still have github_url) */}
                    {isUnblurred && block.github_url && block.block_type !== "github" && (
                      <div className="mt-2 px-1">
                        <a href={block.github_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:underline" style={{ color: "#2EC4B6" }}>
                          🐙 View on GitHub →
                        </a>
                      </div>
                    )}

                    {/* View button overlay — not shown for preview blocks, blogs, or GitHub blocks */}
                    {!isUnblurred && !isPreview && !isBlog && !isGitHub && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button onClick={() => handleViewClick(block.id)} className="gap-2 rounded-full px-5 h-8 text-[13px] font-medium text-white bg-secondary hover:bg-secondary/90">
                          <Eye className="h-3.5 w-3.5" />Reveal
                        </Button>
                      </div>
                    )}

                    {/* Block-level comments toggle */}
                    {isUnblurred && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {block.use_instructions && (
                          <div>
                            <button onClick={() => setBlockInstrOpen((p) => ({ ...p, [block.id]: !p[block.id] }))}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                              <ClipboardList className="h-3 w-3" />
                              <ChevronRight className={`h-3 w-3 transition-transform ${blockInstrOpen[block.id] ? "rotate-90" : ""}`} />
                              📋 How to use this step
                            </button>
                            {blockInstrOpen[block.id] && (
                              <p className="text-sm text-muted-foreground italic mt-2 ml-5 whitespace-pre-wrap">{block.use_instructions}</p>
                            )}
                          </div>
                        )}
                        <button onClick={() => setBlockCommentsOpen((p) => ({ ...p, [block.id]: !p[block.id] }))}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          <MessageCircle className="h-3 w-3" />
                          {blockCommentsOpen[block.id] ? "Hide comments" : "Comment on this block"}
                        </button>
                        {blockCommentsOpen[block.id] && (
                          <div className="mt-3">
                            <CommentsSection contentId={contentId} contentTitle={contentTitle} blockId={block.id} commentCount={0} isEligible={isEligible} compact />
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
