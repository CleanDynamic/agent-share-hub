import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Image as ImageIcon, Mic, Smile, Heart, Send, X, Loader2, Square } from "lucide-react";

interface MessageInputBarProps {
  threadId: string;
  otherDisplayName: string;
  replyToId: string | null;
  onClearReply: () => void;
  onMessageSent: () => void;
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
  const recordingTimerRef = useRef<ReturnType<typeof setInterval>>();
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const COMMON_EMOJIS = ["😀", "😂", "😍", "🤔", "👍", "🎉", "🔥", "💯", "😎", "🙌", "💪", "✨", "🚀", "❤️", "😊", "👏", "🤩", "😭", "🫡", "💀"];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["dm_messages", threadId] });
    queryClient.invalidateQueries({ queryKey: ["dm_threads"] });
  };

  // Send text message
  const sendText = async () => {
    if (!text.trim() || !user || sending) return;
    setSending(true);
    const insertData: any = {
      thread_id: threadId,
      sender_id: user.id,
      message_type: "text",
      text_content: text.trim(),
    };
    if (replyToId) insertData.reply_to_message_id = replyToId;
    await supabase.from("dm_messages").insert(insertData);
    setText("");
    onClearReply();
    invalidate();
    onMessageSent();
    setSending(false);
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
    // For private buckets we need signed URL
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

  // Image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  // Voice recording
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
    if (e.key === "Enter" && !e.shiftKey) {
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
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 2000))}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
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
          {text.trim() || imageFile ? (
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
    </div>
  );
}
