// SV-26 P2: the reblog window and everything it needs to post. ReblogComposeContext keeps the context and the open target;
// this file loads the first time a reader reblogs, or at idle.

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import type { ReblogTargetInput } from "@/contexts/ReblogComposeContext";
import ReblogComposeSheet, {
  type MediaAttachment,
  type OriginalPost,
} from "@/components/reblog/ReblogComposeSheet";
import { createReblog } from "@/lib/reblog/createReblog";
import { ReblogValidationError } from "@/lib/reblog/media";

function classifyPostType(target: ReblogTargetInput): "Blueprint" | "Blog" | "Bounty" {
  const pt = (target.post_type ?? target.content_type ?? "").toLowerCase();
  if (pt === "blog" || pt === "discussion") return "Blog";
  if (pt === "bounty") return "Bounty";
  return "Blueprint";
}

function toOriginalPost(target: ReblogTargetInput): OriginalPost {
  const author = target.author ?? {};
  const displayName = author.display_name || author.username || "Unknown";
  const handle = author.username ? `@${author.username}` : "@unknown";
  return {
    id: target.id,
    slug: target.slug ?? target.id,
    postType: classifyPostType(target),
    title: target.title,
    description: target.description ?? undefined,
    authorDisplayName: displayName,
    authorHandle: handle,
    authorAvatarUrl: author.avatar_url ?? undefined,
    publishedAt: target.created_at ?? new Date().toISOString(),
    coverUrl: target.cover_image_url ?? undefined,
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

export default function ReblogComposeHost({
  target,
  onClose,
}: {
  target: ReblogTargetInput;
  onClose: () => void;
}) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [media, setMedia] = useState<MediaAttachment | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [variant, setVariant] = useState<"desktop" | "mobile">("desktop");

  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setVariant(mq.matches ? "desktop" : "mobile");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleClose = useCallback(() => {
    if (media?.url?.startsWith("blob:")) URL.revokeObjectURL(media.url);
    setText("");
    setMedia(null);
    setIsPosting(false);
    onClose();
  }, [media, onClose]);

  const onAttachImage = useCallback(() => imageInputRef.current?.click(), []);
  const onAttachVideo = useCallback(() => videoInputRef.current?.click(), []);

  const onFileSelected = useCallback(
    (kind: "image" | "video") => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const maxBytes = kind === "image" ? 8 * 1024 * 1024 : 50 * 1024 * 1024;
      if (file.size > maxBytes) {
        toast.error(`${kind === "image" ? "Image" : "Video"} too large (max ${kind === "image" ? "8MB" : "50MB"})`);
        return;
      }
      if (media?.url?.startsWith("blob:")) URL.revokeObjectURL(media.url);
      setMedia({ kind, url: URL.createObjectURL(file), file });
    },
    [media]
  );

  const onRemoveMedia = useCallback(() => {
    if (media?.url?.startsWith("blob:")) URL.revokeObjectURL(media.url);
    setMedia(null);
  }, [media]);

  const handlePost = useCallback(async () => {
    if (!target || !user) return;
    setIsPosting(true);
    try {
      const parentReblogId = target.parent_reblog_id ?? null;
      const originalPostId = parentReblogId
        ? (target.root_original_post_id ?? target.id)
        : target.id;

      const excerpt = target.excerptContext;
      await createReblog({
        rebloggerId: user.id,
        originalPostId,
        parentReblogId,
        text: text.trim() || null,
        mediaFile: media?.file ?? null,
        excerptText: excerpt?.text ?? null,
        excerptSourceBlockId: excerpt?.sourceBlockId ?? null,
        excerptSourceBlockTypeLabel: excerpt?.sourceBlockTypeLabel ?? null,
      });

      toast.success("Reblogged");
      // Refresh counts on the originating post.
      queryClient.invalidateQueries({ queryKey: ["reblog_count", originalPostId] });
      queryClient.invalidateQueries({ queryKey: ["user_has_reblogged", originalPostId] });
      queryClient.invalidateQueries({ queryKey: ["reblogs"] });
      queryClient.invalidateQueries({ queryKey: ["feed"] });
      handleClose();
    } catch (err: any) {
      if (err instanceof ReblogValidationError) {
        toast.error(err.message);
      } else {
        const msg = err?.message || "Failed to reblog";
        if (msg.includes("once per 24 hours")) {
          toast.error("You can only reblog the same post once per 24 hours");
        } else if (msg.includes("Reblog rate limit")) {
          toast.error("Reblog rate limit reached (50 / 24h)");
        } else {
          toast.error(msg);
        }
      }
      setIsPosting(false);
    }
  }, [target, user, text, media, queryClient, handleClose]);

  const currentUser = profile
    ? {
        displayName: profile.display_name || profile.username || "You",
        handle: profile.username ? `@${profile.username}` : "@you",
        avatarUrl: profile.avatar_url ?? undefined,
        initials: getInitials(profile.display_name || profile.username || "?"),
      }
    : { displayName: "You", handle: "@you", initials: "?" };

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
        onChange={onFileSelected("image")}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        style={{ display: "none" }}
        onChange={onFileSelected("video")}
      />
      <ReblogComposeSheet
          isOpen
          variant={variant}
          onClose={handleClose}
          currentUser={currentUser}
          originalPost={toOriginalPost(target)}
          excerptContext={target.excerptContext ?? null}
          text={text}
          onTextChange={setText}
          mediaAttachment={media}
          onAttachImage={onAttachImage}
          onAttachVideo={onAttachVideo}
          onRemoveMedia={onRemoveMedia}
          onPost={handlePost}
          isPosting={isPosting}
          charCount={text.length}
      />
    </>
  );
}
