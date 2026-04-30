import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Image as ImageIcon, Mic, Smile, Heart, Send, X, Loader2, Square, AtSign, FileText, Layers, Box } from "lucide-react";
import { ThreadReferencePicker, type ReferenceItem, type ReferenceType, type ReferencePickerCounts } from "@/components/messages/ThreadReferencePicker";
import { sendContentShareMessage } from "@/lib/messaging";
import { queryBlueprints } from "@/lib/discover/queryBlueprints";
import { queryStages } from "@/lib/discover/queryStages";
import { queryBlocks } from "@/lib/discover/queryBlocks";

interface MessageInputBarProps {
  threadId: string;
  otherDisplayName: string;
  replyToId: string | null;
  onClearReply: () => void;
  onMessageSent: () => void;
}

interface PendingShare {
  type: "blueprint" | "stage" | "block";
  contentId: string; // for blueprint = id; for stage/block = parent blueprint content_items.id
  label: string;
  subtitle?: string;
  thumbnail?: string;
}

function variantIcon(t: ReferenceType) {
  if (t === "blueprints") return <FileText className="h-3 w-3" />;
  if (t === "stages") return <Layers className="h-3 w-3" />;
  return <Box className="h-3 w-3" />;
}

export function MessageInputBar({
  threadId,
  otherDisplayName,
  replyToId,
  onClearReply,
  onMessageSent,
}: MessageInputBarProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reference picker state
  const atButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerType, setPickerType] = useState<ReferenceType>("blueprints");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerDebouncedQuery, setPickerDebouncedQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<ReferenceItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [counts, setCounts] = useState<ReferencePickerCounts>({ blueprints: 0, stages: 0, blocks: 0 });
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(null);
  const atTriggerActiveRef = useRef<boolean>(false); // when picker opened via typing `@`

  const COMMON_EMOJIS = ["😀", "😂", "😍", "🤔", "👍", "🎉", "🔥", "💯", "😎", "🙌", "💪", "✨", "🚀", "❤️", "😊", "👏", "🤩", "😭", "🫡", "💀"];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dm_messages", threadId] });
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
  };

  // Debounce picker query
  useEffect(() => {
    const t = setTimeout(() => setPickerDebouncedQuery(pickerQuery), 200);
    return () => clearTimeout(t);
  }, [pickerQuery]);

  // Run search when picker opens / type / query changes
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setPickerLoading(true);
    (async () => {
      try {
        if (pickerType === "blueprints") {
          const res = await queryBlueprints({ query: pickerDebouncedQuery, limit: 12 });
          if (cancelled) return;
          const items: ReferenceItem[] = (res.rows ?? []).map((r: any) => ({
            id: r.id,
            name: r.title ?? "Untitled",
            subtitle: r.author?.username ? `@${r.author.username}` : (r.profiles?.username ? `@${r.profiles.username}` : undefined),
            type: "blueprints",
            avatar: r.cover_image_url || undefined,
          }));
          setPickerResults(items);
          setCounts((c) => ({ ...c, blueprints: res.total ?? items.length }));
        } else if (pickerType === "stages") {
          const res = await queryStages({ query: pickerDebouncedQuery, limit: 12 } as any);
          if (cancelled) return;
          const items: ReferenceItem[] = (res.rows ?? []).map((r) => ({
            id: r.parent.blueprintId, // use parent blueprint id as shared_content_id
            name: r.stage.name,
            subtitle: `from ${r.parent.blueprintTitle}`,
            type: "stages",
          }));
          setPickerResults(items);
          setCounts((c) => ({ ...c, stages: res.total ?? items.length }));
        } else {
          const res = await queryBlocks({ query: pickerDebouncedQuery, limit: 12 } as any);
          if (cancelled) return;
          const items: ReferenceItem[] = (res.rows ?? []).map((r) => ({
            id: r.parent.blueprintId,
            name: r.block.name || r.block.type || "Block",
            subtitle: `${r.block.type} · ${r.parent.stageName}`,
            type: "blocks",
          }));
          setPickerResults(items);
          setCounts((c) => ({ ...c, blocks: res.total ?? items.length }));
        }
      } catch (e) {
        if (!cancelled) setPickerResults([]);
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pickerOpen, pickerType, pickerDebouncedQuery]);

  const openPicker = (initialQuery = "") => {
    setPickerQuery(initialQuery);
    setPickerDebouncedQuery(initialQuery);
    setPickerOpen(true);
  };

  const closePicker = () => {
    setPickerOpen(false);
    atTriggerActiveRef.current = false;
  };

  const handlePickerSelect = (item: ReferenceItem) => {
    const variant: PendingShare["type"] =
      item.type === "blueprints" ? "blueprint" : item.type === "stages" ? "stage" : "block";
    setPendingShare({
      type: variant,
      contentId: item.id,
      label: item.name,
      subtitle: item.subtitle,
      thumbnail: item.avatar,
    });
    // If opened via `@`, strip the `@query` token from the textarea
    if (atTriggerActiveRef.current) {
      setText((prev) => prev.replace(/@\S*$/, "").replace(/@$/, ""));
    }
    closePicker();
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // Detect `@` trigger while typing
  const handleTextChange = (val: string) => {
    setText(val.slice(0, 2000));
    // Find `@token` at the end
    const match = val.match(/(^|\s)@(\S*)$/);
    if (match) {
      atTriggerActiveRef.current = true;
      setPickerType("blueprints");
      openPicker(match[2] || "");
    } else if (atTriggerActiveRef.current && pickerOpen) {
      // user typed past trigger or deleted `@`
      atTriggerActiveRef.current = false;
      setPickerOpen(false);
    }
  };

  // Send text message (or content-share when pending)
  const sendText = async () => {
    if (!user || sending) return;
    if (!text.trim() && !pendingShare) return;
    setSending(true);
    try {
      if (pendingShare) {
        await sendContentShareMessage(threadId, pendingShare.type, pendingShare.contentId, text.trim() || undefined);
        setPendingShare(null);
      } else {
        const insertData: any = {
          thread_id: threadId,
          sender_id: user.id,
          message_type: "text",
          kind: "text",
          text_content: text.trim(),
          body: text.trim(),
        };
        if (replyToId) insertData.reply_to_message_id = replyToId;
        await supabase.from("dm_messages").insert(insertData);
      }
      setText("");
      onClearReply();
      invalidate();
      onMessageSent();
    } finally {
      setSending(false);
    }
  };

  // Send heart
  const sendHeart = async () => {
    if (!user || sending) return;
    setSending(true);
    await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      message_type: "like",
      is_liked: true,
    });
    invalidate();
    onMessageSent();
    setSending(false);
  };

  // Send image
  const sendImage = async () => {
    if (!imageFile || !user || sending) return;
    setSending(true);
    const ext = imageFile.name.split(".").pop() || "jpg";
    const path = `${threadId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("dm-images")
      .upload(path, imageFile, { contentType: imageFile.type });
    if (uploadErr) { setSending(false); return; }
    const { data: urlData } = supabase.storage.from("dm-images").getPublicUrl(path);
    const { data: signedData } = await supabase.storage.from("dm-images").createSignedUrl(path, 60 * 60 * 24 * 365);
    const imageUrl = signedData?.signedUrl || urlData?.publicUrl || "";

    await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      message_type: "image",
      image_url: imageUrl,
      ...(replyToId ? { reply_to_message_id: replyToId } : {}),
    });
    setImageFile(null);
    setImagePreviewUrl(null);
    onClearReply();
    invalidate();
    onMessageSent();
    setSending(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } catch {
      // Mic not available
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setVoiceBlob(null);
    setRecordingDuration(0);
    clearInterval(recordingTimerRef.current);
  };

  const sendVoice = async () => {
    if (!voiceBlob || !user || sending) return;
    setSending(true);
    const path = `${threadId}/${crypto.randomUUID()}.webm`;
    await supabase.storage.from("dm-voice").upload(path, voiceBlob, { contentType: "audio/webm" });
    const { data: signedData } = await supabase.storage.from("dm-voice").createSignedUrl(path, 60 * 60 * 24 * 365);
    const voiceUrl = signedData?.signedUrl || "";

    await supabase.from("dm_messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      message_type: "voice",
      voice_url: voiceUrl,
      voice_duration_seconds: recordingDuration,
    });
    setVoiceBlob(null);
    setRecordingDuration(0);
    invalidate();
    onMessageSent();
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !pickerOpen) {
      e.preventDefault();
      if (imageFile) sendImage();
      else sendText();
    }
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const fmtDur = `${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, "0")}`;

  // Voice preview state
  if (voiceBlob && !recording) {
    return (
      <div className="px-3 py-2 border-t border-border flex items-center gap-3 shrink-0" style={{ backgroundColor: "#0A0A0F" }}>
        <button onClick={cancelRecording} className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm text-foreground">🎤 Voice message</span>
          <span className="text-xs text-muted-foreground">{fmtDur}</span>
        </div>
        <button
          onClick={sendVoice}
          disabled={sending}
          className="p-2 rounded-full bg-primary text-primary-foreground"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  // Recording state
  if (recording) {
    return (
      <div className="px-3 py-2 border-t border-border flex items-center gap-3 shrink-0" style={{ backgroundColor: "#0A0A0F" }}>
        <button onClick={cancelRecording} className="text-muted-foreground hover:text-foreground text-xs">
          ← Slide to cancel
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm text-foreground font-mono">{fmtDur}</span>
        </div>
        <button onClick={stopRecording} className="p-2 rounded-full bg-destructive text-destructive-foreground">
          <Square className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0" style={{ backgroundColor: "#0A0A0F" }}>
      {/* Pending share chip */}
      {pendingShare && (
        <div className="px-3 pt-2 flex items-start">
          <div className="flex items-center gap-2 max-w-full pr-2 pl-2 py-1.5 rounded-lg border border-white/10 bg-white/5">
            <div className="h-6 w-6 rounded flex items-center justify-center bg-secondary/20 text-secondary shrink-0">
              {pendingShare.type === "blueprint" ? <FileText className="h-3 w-3" /> : pendingShare.type === "stage" ? <Layers className="h-3 w-3" /> : <Box className="h-3 w-3" />}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-foreground truncate max-w-[220px]">{pendingShare.label}</div>
              {pendingShare.subtitle && (
                <div className="text-[10px] text-muted-foreground truncate max-w-[220px]">{pendingShare.subtitle}</div>
              )}
            </div>
            <button
              onClick={() => setPendingShare(null)}
              className="ml-1 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Remove pending share"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Image preview */}
      {imagePreviewUrl && (
        <div className="px-3 pt-2 flex items-start gap-2">
          <div className="relative">
            <img src={imagePreviewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <button
              onClick={() => { setImageFile(null); setImagePreviewUrl(null); }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div className="px-3 py-2 border-t border-border flex flex-wrap gap-1.5">
          {COMMON_EMOJIS.map((e) => (
            <button key={e} onClick={() => insertEmoji(e)} className="text-xl hover:scale-110 transition-transform p-0.5">
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="px-3 py-2 border-t border-border flex items-end gap-2">
        {/* Left icons */}
        <div className="flex items-center gap-1 shrink-0 pb-1">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Camera className="h-5 w-5" />
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <button
            onClick={startRecording}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Mic className="h-5 w-5" />
          </button>
          <button
            ref={atButtonRef}
            onClick={() => {
              atTriggerActiveRef.current = false;
              if (pickerOpen) closePicker();
              else openPicker("");
            }}
            className={`p-1 transition-colors ${pickerOpen ? "text-secondary" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Share content"
          >
            <AtSign className="h-5 w-5" />
          </button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={pendingShare ? "Add a note (optional)…" : "Message…"}
            className="min-h-[36px] max-h-[120px] resize-none rounded-full bg-accent/50 border-border text-sm px-4 py-2 pr-10"
            rows={1}
          />
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="absolute right-3 bottom-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Smile className="h-4 w-4" />
          </button>
        </div>

        {/* Right action */}
        <div className="shrink-0 pb-1">
          {text.trim() || imageFile || pendingShare ? (
            <button
              onClick={imageFile ? sendImage : sendText}
              disabled={sending}
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          ) : (
            <button onClick={sendHeart} className="p-2 text-primary hover:scale-110 transition-transform">
              <Heart className="h-5 w-5 fill-primary" />
            </button>
          )}
        </div>
      </div>

      {/* Reference picker (popover) */}
      <ThreadReferencePicker
        isOpen={pickerOpen}
        onClose={closePicker}
        activeType={pickerType}
        onTypeChange={setPickerType}
        query={pickerQuery}
        onQueryChange={setPickerQuery}
        results={pickerResults}
        isLoading={pickerLoading}
        counts={counts}
        onSelect={handlePickerSelect}
        anchorEl={atButtonRef.current}
      />
    </div>
  );
}
