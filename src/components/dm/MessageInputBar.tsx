import { dmMediaRef } from "@/lib/dm/dmMedia";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { isPermissionError } from "@/lib/errors/permission";
import { Camera, Image as ImageIcon, Mic, Smile, Heart, Send, X, Loader2, Square } from "lucide-react";
import { ThreadReferencePicker, type ReferenceItem } from "@/components/messages/ThreadReferencePicker";
import { isTopicShareState, listShareableBuilds, sendBuildMessage, sendTopicMessage } from "@/lib/messaging";
import { useLocation, useNavigate } from "react-router-dom";
import { MobileIcon } from "@/components/brand/MobileIcon";
import { useIsPhone } from "@/components/shell/useMinWidth";
// Aliased `tok`: this file already binds `t` twice in tight scopes (a
// setTimeout handle and a MediaStreamTrack), and a token accessor that can
// be shadowed is a trap for whoever edits those blocks next.
import { t as tok } from "@/lib/theme/tokens";
import { r } from "@/lib/theme/radius";
import { data as dataType, tabular } from "@/lib/theme/type";
import { uiTransition } from "@/lib/theme/controls";

interface MessageInputBarProps {
  threadId: string;
  otherDisplayName: string;
  /** "maya": the placeholder reads "Message @maya". */
  otherHandle?: string | null;
  replyToId: string | null;
  onClearReply: () => void;
  onMessageSent: () => void;
}

/** RC-P20: the build a message is about to carry, and what the chip calls it. UX-09 Q4: or a topic. */
interface PendingShare {
  kind: "build" | "topic";
  id: string;
  label: string;
  subtitle?: string;
}

export function MessageInputBar({
  threadId,
  otherDisplayName,
  otherHandle = null,
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
  const phone = useIsPhone();

  // Reference picker state
  const atButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerDebouncedQuery, setPickerDebouncedQuery] = useState("");
  const [pickerResults, setPickerResults] = useState<ReferenceItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<unknown>(null);
  const [pickerAttempt, setPickerAttempt] = useState(0);
  const [pendingShare, setPendingShare] = useState<PendingShare | null>(null);

  /* UX-09 Q4: "Message @maya" on a topic opens this thread with the topic handed over in the router state. It waits here as a card,
     with an optional note, and goes when the reader sends, as a build does. The state is cleared so a reload does not add it again. */
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const state = location.state as unknown;
    if (!isTopicShareState(state)) return;
    setPendingShare({ kind: "topic", id: state.shareTopic.id, label: state.shareTopic.label, subtitle: state.shareTopic.subtitle });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.state, location.pathname, location.search, navigate]);
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

  // RC-P20: one kind, builds — the reader's own and their saves, newest first.
  useEffect(() => {
    if (!pickerOpen) return;
    let cancelled = false;
    setPickerLoading(true);
    setPickerError(null);
    (async () => {
      try {
        const builds = await listShareableBuilds({ query: pickerDebouncedQuery });
        if (cancelled) return;
        setPickerResults(
          builds.map((build) => ({
            id: build.id,
            name: build.title,
            subtitle: build.source === "yours" ? "Yours" : "Saved",
            slug: build.slug,
          })),
        );
      } catch (error) {
        // STATES.md row 21, not an empty list: a refusal is not "nothing".
        if (!cancelled) {
          setPickerResults([]);
          setPickerError(error);
        }
      } finally {
        if (!cancelled) setPickerLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pickerOpen, pickerDebouncedQuery, pickerAttempt]);

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
    setPendingShare({ kind: "build", id: item.id, label: item.name, subtitle: item.subtitle });
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
        try {
          if (pendingShare.kind === "topic") await sendTopicMessage(threadId, pendingShare.id, text.trim() || undefined);
          else await sendBuildMessage(threadId, pendingShare.id, text.trim() || undefined);
        } catch (error) {
          // The build and the note stay, so the reader can send again. The
          // toast says why in the words STATES.md row 21 gives; the note is
          // not in it.
          toast(isPermissionError(error) ? "You don't have access to this." : "Something went wrong.");
          return;
        }
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
    // The message keeps a reference to the file, never a long-lived link (src/lib/dm/dmMedia.ts).
    const imageUrl = dmMediaRef("dm-images", path);

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
    const { error: voiceErr } = await supabase.storage.from("dm-voice").upload(path, voiceBlob, { contentType: "audio/webm" });
    if (voiceErr) { setSending(false); return; }
    // The message keeps a reference to the file, never a long-lived link (src/lib/dm/dmMedia.ts).
    const voiceUrl = dmMediaRef("dm-voice", path);

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
      <div className="px-3 py-2 border-t border-border flex items-center gap-3 shrink-0" style={{ backgroundColor: tok.bg }}>
        <button onClick={cancelRecording} style={{ color: tok.text2, transition: uiTransition() }} aria-label="Discard the recording">
          <X className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm" style={{ color: tok.text }}>🎤 Voice message</span>
          <span
            className="text-xs"
            style={{ fontFamily: dataType.fontFamily, ...tabular, color: tok.text2 }}
          >
            {fmtDur}
          </span>
        </div>
        <button
          onClick={sendVoice}
          disabled={sending}
          className="p-2"
          style={{
            borderRadius: r["r-control"],
            background: tok.action,
            color: tok.onAction,
            transition: uiTransition(),
          }}
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    );
  }

  // Recording state
  if (recording) {
    return (
      <div className="px-3 py-2 border-t border-border flex items-center gap-3 shrink-0" style={{ backgroundColor: tok.bg }}>
        <button onClick={cancelRecording} className="text-xs" style={{ color: tok.text2, transition: uiTransition() }}>
          ← Slide to cancel
        </button>
        <div className="flex-1 flex items-center justify-center gap-2">
          {/* Recording is a live state, so the dot is `--cat-breakage` — the
              token that already means "this needs attention" — rather than
              shadcn's destructive, which is a palette colour and not a theme
              token. */}
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            data-bg-animated=""
            style={{ background: tok.catBreakage }}
          />
          <span
            className="text-sm"
            style={{ fontFamily: dataType.fontFamily, ...tabular, color: tok.text }}
          >
            {fmtDur}
          </span>
        </div>
        <button
          onClick={stopRecording}
          className="p-2"
          style={{
            borderRadius: r["r-control"],
            background: tok.catBreakageFill,
            color: tok.catBreakage,
            transition: uiTransition(),
          }}
        >
          <Square className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0" style={{ backgroundColor: tok.bg }}>
      {/* Pending share chip */}
      {pendingShare && (
        <div className="px-3 pt-2 flex items-start">
          <div
            className="flex items-center gap-2 max-w-full pr-2 pl-2 py-1.5"
            style={{ borderRadius: r["r-chip"], border: `1px solid ${tok.line}`, background: tok.recess }}
          >
            <div className="min-w-0">
              <div className="text-[12px] font-medium truncate max-w-[220px]" style={{ color: tok.text }}>
                {pendingShare.label}
              </div>
              {pendingShare.subtitle && (
                <div className="text-[10px] truncate max-w-[220px]" style={{ color: tok.text2 }}>
                  {pendingShare.subtitle}
                </div>
              )}
            </div>
            <button
              onClick={() => setPendingShare(null)}
              className="ml-1 shrink-0"
              style={{ color: tok.text2, transition: uiTransition() }}
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
            {/* An image thumbnail takes `--r-media`, which is the token for
                exactly this and is 10px rather than the 8px `rounded-lg` was. */}
            <img
              src={imagePreviewUrl}
              alt=""
              className="h-16 w-16 object-cover"
              style={{ borderRadius: r["r-media"] }}
            />
            <button
              onClick={() => { setImageFile(null); setImagePreviewUrl(null); }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center"
              style={{ background: tok.bg, border: `1px solid ${tok.line}`, color: tok.text2 }}
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
            <button key={e} onClick={() => insertEmoji(e)} className="text-xl hover:opacity-75 transition-feedback p-0.5">
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Mobile prompt 26 Part E: on a phone the bar is a 44 round plus ("Share a build", which opens the sheet of the reader's builds),
          the field (40 tall, radius 20, Card, 16px text so the page does not zoom) and Send (the main button, small). With nothing to
          send, Send gives way to the attach and voice buttons, so nothing the desktop's bar offers is lost. */}
      {phone ? (
        <div data-testid="message-input-phone" style={{ padding: "10px 16px", display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button
            ref={atButtonRef}
            type="button"
            aria-label="Share a build"
            aria-expanded={pickerOpen}
            onClick={() => {
              atTriggerActiveRef.current = false;
              if (pickerOpen) closePicker();
              else openPicker("");
            }}
            className="shrink-0 flex items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: "50%", background: tok.control, color: tok.text, transition: uiTransition() }}
          >
            <MobileIcon name="new" size={20} />
          </button>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          <div className="flex-1 min-w-0" style={{ background: tok.module, borderRadius: 20, minHeight: 40, display: "flex", alignItems: "center" }}>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingShare ? "Add a note (optional)…" : otherHandle ? `Message @${otherHandle}` : "Message…"}
              aria-label={otherHandle ? `Message @${otherHandle}` : "Message"}
              className="min-h-[40px] max-h-[120px] resize-none"
              style={{ background: "transparent", border: 0, boxShadow: "none", fontSize: 16, lineHeight: "20px", padding: "10px 16px" }}
              rows={1}
            />
          </div>
          {text.trim() || imageFile || pendingShare ? (
            <button
              type="button"
              onClick={imageFile ? sendImage : sendText}
              disabled={sending}
              aria-label="Send"
              className="shrink-0 flex items-center justify-center gap-1.5"
              style={{ height: 44, padding: "0 16px", borderRadius: 22, fontSize: 13, fontWeight: 600, background: tok.action, color: tok.onAction, opacity: sending ? 0.6 : 1, transition: uiTransition() }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </button>
          ) : (
            <div className="flex items-center shrink-0">
              <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach an image" className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: "50%", color: tok.text2 }}>
                <MobileIcon name="image" size={22} />
              </button>
              <button type="button" onClick={startRecording} aria-label="Record a voice note" className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: "50%", color: tok.text2 }}>
                <Mic className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Synth 12 Part D: the input bar is a Card pill (radius 22): attach (round icons), the text field, "Share a build"
          (ghost, small) and "Send" (the main button, small). */}
      <div className="px-3 py-3">
        <div className="flex items-end gap-2" style={{ background: tok.module, borderRadius: 22, padding: "6px 6px 6px 8px", minHeight: 44, boxSizing: "border-box" }}>
          <div className="flex items-center gap-1 shrink-0">
            {[
              { label: "Take a photo", Icon: Camera, onClick: () => cameraInputRef.current?.click() },
              { label: "Attach an image", Icon: ImageIcon, onClick: () => fileInputRef.current?.click() },
              { label: "Record a voice note", Icon: Mic, onClick: startRecording },
            ].map(({ label, Icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="flex items-center justify-center"
                style={{ width: 32, height: 32, borderRadius: "50%", color: tok.text2, transition: uiTransition() }}
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
          </div>

          {/* Text input */}
          <div className="flex-1 relative min-w-0">
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={pendingShare ? "Add a note (optional)…" : otherHandle ? `Message @${otherHandle}` : "Message…"}
              aria-label={otherHandle ? `Message @${otherHandle}` : "Message"}
              className="min-h-[32px] max-h-[120px] resize-none px-2 py-1.5 pr-8"
              style={{ background: "transparent", border: 0, boxShadow: "none", fontSize: 15, lineHeight: "20px" }}
              rows={1}
            />
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="absolute right-2 bottom-2"
              style={{ color: tok.text2, transition: uiTransition() }}
              aria-label="Insert an emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
          </div>

          <button
            ref={atButtonRef}
            onClick={() => {
              atTriggerActiveRef.current = false;
              if (pickerOpen) closePicker();
              else openPicker("");
            }}
            className="shrink-0"
            aria-expanded={pickerOpen}
            style={{ height: 32, padding: "0 12px", borderRadius: 16, fontSize: 13, fontWeight: 600, color: pickerOpen ? tok.text : tok.text2, background: pickerOpen ? tok.control : "transparent", transition: uiTransition() }}
          >
            Share a build
          </button>

          {text.trim() || imageFile || pendingShare ? (
            <button
              onClick={imageFile ? sendImage : sendText}
              disabled={sending}
              className="shrink-0 flex items-center justify-center gap-1.5"
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 16,
                fontSize: 13,
                fontWeight: 600,
                background: tok.action,
                color: tok.onAction,
                opacity: sending ? 0.6 : 1,
                transition: uiTransition(),
              }}
              aria-label="Send"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send
            </button>
          ) : (
            // Nothing to send yet: the heart, a round ghost icon; Send takes its place once there is something.
            <button
              onClick={sendHeart}
              className="shrink-0 flex items-center justify-center"
              style={{ width: 32, height: 32, borderRadius: "50%", color: tok.text2, transition: uiTransition() }}
              aria-label="Send a heart"
            >
              <Heart className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      </>
      )}

      {/* Reference picker (popover) */}
      <ThreadReferencePicker
        isOpen={pickerOpen}
        onClose={closePicker}
        query={pickerQuery}
        onQueryChange={setPickerQuery}
        results={pickerResults}
        isLoading={pickerLoading}
        error={pickerError}
        onRetry={() => setPickerAttempt((attempt) => attempt + 1)}
        onSelect={handlePickerSelect}
        anchorEl={atButtonRef.current}
      />
    </div>
  );
}
