/* UI-P47 — the composer, part 1: the frame, Media, Text and Publish.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   links. `ComposePage` supplies the build, the writes and the save state; the
   dev compare page supplies the sample draft. The viewport is read here (768px)
   so both behave the same.

   ONE SIMPLE COMPOSER. A heading row (the title, a status line, Preview and the
   page's one primary, Publish), then a grid of flat panels: Media and Text on
   the left, and a right track of 340px that stays empty until UI-P48 puts
   "Your sessions" in it. Every panel is `flat`: compose is a place you work in,
   so nothing here refracts and nothing blurs (RULES §7b).

   PUBLISH STAYS CLICKABLE WHILE SOMETHING IS MISSING, at 0.7 opacity, because a
   disabled button explains nothing. The click is the container's: it either
   publishes or says what is missing in a toast.

   The three text fields are controlled by the container's own strings, not by
   the build: a half-typed "photographers, " must stay as typed while the saved
   value is the parsed list. */

import { useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useIsPhone } from "@/components/shell/useMinWidth";
import { acceptedMediaTypes, mediaKindFor } from "@/lib/build/media";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { OUTCOME_MAX, UNTITLED, isUntitled, joinWords, saveWords, type SaveState } from "./composeModel";

/* ── the view's props ── */

export type ComposeMedia =
  | { state: "empty" }
  | { state: "loading" }
  | { state: "adding"; pct: number }
  | { state: "set"; kind: "image" | "video"; url: string };

export interface ComposePublished {
  slug: string;
  /** "It is in the Gallery now." when true; otherwise the shortfall below. */
  inGallery: boolean;
  /** What the Gallery still wants, as noun phrases: "an audience and a link". */
  shortfall: string;
}

export interface ComposeViewProps {
  fit?: "board" | "content";
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  /** Show "Paste a transcript or a repo instead" (the new-draft route only). */
  showStartLink: boolean;
  /** The saved title, for the heading. The field below holds what is being typed. */
  heading: string;
  title: string;
  description: string;
  audience: string;
  /** `getGalleryFacets().roles` values, for the datalist. */
  audienceOptions: readonly string[];
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onAudience: (value: string) => void;
  saveState: SaveState;
  /** Within a minute of the last save. */
  savedJustNow: boolean;
  onSaveRetry: () => void;
  /** Plain words, in order: ["a cover picture or video", "a title", …]. */
  missing: readonly string[];
  /** The draft's slug once it exists; null before. */
  slug: string | null;
  published: ComposePublished | null;
  publishing: boolean;
  onPublish: () => void;
  media: ComposeMedia;
  /** A file dropped or chosen. */
  onFile: (file: File) => void;
  onReplace: (file: File) => void;
  onRemoveMedia: () => void;
}

/* ── shared pieces ── */

const MEDIA_ACCEPT = acceptedMediaTypes()
  .filter((mime) => {
    const kind = mediaKindFor(mime);
    return kind === "image" || kind === "video";
  })
  .join(",");

const underlined: CSSProperties = {
  fontFamily: FIGTREE,
  color: t.text2,
  textDecoration: "underline",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

function TextButton({ onClick, size = 14, children, disabled }: { onClick: () => void; size?: number; children: ReactNode; disabled?: boolean }) {
  const { state, handlers } = useInteractive<HTMLButtonElement>({}, { disabled });
  return (
    <button type="button" onClick={onClick} disabled={disabled} {...handlers} style={{ ...underlined, fontSize: size, borderRadius: 6, ...ring(state.focusVisible) }}>
      {children}
    </button>
  );
}

/** A link dressed as the brand's secondary button, because Preview is a link and a link is an `<a>`. */
function LinkButton({ to, size, fontSize, variant, children }: { to: string; size: 42 | 48; fontSize: 14; variant: "secondary" | "ghost"; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  return (
    <Link
      to={to}
      {...handlers}
      style={{
        height: size,
        padding: "0 14px",
        borderRadius: r.control,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        textDecoration: "none",
        fontFamily: FIGTREE,
        fontSize,
        fontWeight: 500,
        color: variant === "ghost" ? t.text2 : t.text,
        background: variant === "ghost" ? "transparent" : t.glass2,
        border: variant === "ghost" ? "1px solid transparent" : `1px solid ${state.hovered ? t.text2 : t.line}`,
        whiteSpace: "nowrap",
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </Link>
  );
}

const fieldBase: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: r.control,
  background: t.field,
  border: `1px solid ${t.line}`,
  color: t.text,
  fontFamily: FIGTREE,
  outline: "none",
};

function Label({ htmlFor, hint, children }: { htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} style={{ display: "flex", alignItems: "baseline", gap: 8, fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, color: t.text }}>
      {children}
      {hint ? <span style={{ fontSize: 13, fontWeight: 400, color: t.text2 }}>{hint}</span> : null}
    </label>
  );
}

/* ── Media ── */

const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

function MediaPanel({
  media,
  phone,
  onFile,
  onReplace,
  onRemove,
}: {
  media: ComposeMedia;
  phone: boolean;
  onFile: (file: File) => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
}) {
  const pick = useRef<HTMLInputElement>(null);
  const swap = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { state, handlers } = useInteractive<HTMLButtonElement>();

  const choose = (send: (file: File) => void) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) send(file);
  };

  const zoneStyle: CSSProperties = {
    aspectRatio: "16 / 9",
    width: "100%",
    boxSizing: "border-box",
    borderRadius: r.media,
    border: `1.5px dashed ${over ? t.evidence : t.line}`,
    background: over ? t.rowHighlight : t.recess,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 16,
    textAlign: "center",
    color: t.text,
  };

  const dropHandlers = {
    onDragOver: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  };

  let body: ReactNode;
  if (media.state === "adding") {
    const pct = Math.round(Math.min(1, Math.max(0, media.pct)) * 100);
    body = (
      <div data-testid="media-adding" style={{ ...zoneStyle, border: `1.5px dashed ${t.line}`, background: t.recess, padding: "0 24px" }}>
        <div role="progressbar" aria-label="Adding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} style={{ width: "100%", height: 4, borderRadius: 2, background: t.barBase, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: t.evidence }} />
        </div>
        <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>Adding… {pct}%</span>
      </div>
    );
  } else if (media.state === "loading") {
    body = <Skeleton height="auto" radius={10} style={{ aspectRatio: "16 / 9" }} />;
  } else if (media.state === "set") {
    const frame: CSSProperties = { aspectRatio: "16 / 9", width: "100%", objectFit: "cover", borderRadius: r.media, display: "block", background: t.recess };
    body = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {media.kind === "video" ? (
          <video src={media.url} controls muted playsInline style={frame} />
        ) : (
          <img src={media.url} alt="Your cover" style={frame} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ flexGrow: 1, fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>Cover</span>
          <TextButton onClick={() => swap.current?.click()}>Replace</TextButton>
          <TextButton onClick={onRemove}>Remove</TextButton>
        </div>
        <input ref={swap} type="file" accept={MEDIA_ACCEPT} hidden data-testid="media-replace-input" onChange={choose(onReplace)} />
      </div>
    );
  } else if (phone) {
    // No dropping on touch: the dashed box stays, as the button.
    body = (
      <button
        type="button"
        onClick={() => pick.current?.click()}
        {...handlers}
        style={{ ...zoneStyle, cursor: "pointer", font: "inherit", ...ring(state.focusVisible) }}
      >
        <ImageIcon size={28} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" />
        <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600 }}>Add a screenshot or a short video</span>
      </button>
    );
  } else {
    body = (
      <div data-testid="media-zone" data-over={over ? "true" : undefined} {...dropHandlers} style={zoneStyle}>
        <ImageIcon size={28} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" />
        <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600 }}>Drop a screenshot or a short video</span>
        <TextButton onClick={() => pick.current?.click()}>or browse your files</TextButton>
      </div>
    );
  }

  return (
    <Panel surface="flat" padding={phone ? "16px" : "24px"}>
      <PanelHead title="Media" subtitle="What people see first in the Gallery." headingLevel={2} />
      <div style={{ marginTop: 16 }}>{body}</div>
      <input ref={pick} type="file" accept={MEDIA_ACCEPT} hidden data-testid="media-input" onChange={choose(onFile)} />
    </Panel>
  );
}

/* ── Text ── */

function TextPanel({
  phone,
  title,
  description,
  audience,
  audienceOptions,
  onTitle,
  onDescription,
  onAudience,
}: Pick<ComposeViewProps, "title" | "description" | "audience" | "audienceOptions" | "onTitle" | "onDescription" | "onAudience"> & { phone: boolean }) {
  const titleFocus = useInteractive<HTMLInputElement>();
  const descFocus = useInteractive<HTMLTextAreaElement>();
  const forFocus = useInteractive<HTMLInputElement>();
  const used = description.length;
  return (
    <Panel surface="flat" padding={phone ? "16px" : "24px"}>
      <PanelHead title="Text" subtitle="Shown on your build's card." headingLevel={2} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="compose-title">Title</Label>
          <input
            id="compose-title"
            value={title}
            placeholder="Name your build"
            onChange={(event) => onTitle(event.target.value)}
            {...titleFocus.handlers}
            style={{ ...fieldBase, height: 44, padding: "0 14px", fontSize: 17, fontWeight: 600, ...ring(titleFocus.state.focusVisible) }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="compose-description">Description</Label>
          <textarea
            id="compose-description"
            rows={3}
            value={description}
            maxLength={OUTCOME_MAX}
            placeholder="What does it do, and who is it for? One or two sentences."
            onChange={(event) => onDescription(event.target.value)}
            {...descFocus.handlers}
            style={{ ...fieldBase, padding: "12px 14px", fontSize: 16, lineHeight: 1.5, resize: "vertical", display: "block", ...ring(descFocus.state.focusVisible) }}
          />
          <span style={{ alignSelf: "flex-end", fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
            {used} / {OUTCOME_MAX}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="compose-for" hint="Separate with commas">
            Who it&apos;s for
          </Label>
          <input
            id="compose-for"
            list="compose-audiences"
            value={audience}
            onChange={(event) => onAudience(event.target.value)}
            {...forFocus.handlers}
            style={{ ...fieldBase, height: 40, padding: "0 14px", fontSize: phone ? 16 : 14, ...ring(forFocus.state.focusVisible) }}
          />
          <datalist id="compose-audiences">
            {audienceOptions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        </div>
      </div>
    </Panel>
  );
}

/* ── the page ── */

export function ComposeView(props: ComposeViewProps) {
  const phone = useIsPhone();
  const {
    status,
    onRetry,
    showStartLink,
    heading,
    saveState,
    savedJustNow,
    onSaveRetry,
    missing,
    slug,
    published,
    publishing,
    onPublish,
  } = props;

  if (status !== "ready") {
    return (
      <div data-testid="compose-view" style={{ display: "flex", flexDirection: "column", gap: phone ? 12 : 16 }}>
        <h1 style={{ ...display(phone ? 30 : 40, { mobilePageHeading: phone }), margin: 0, color: t.text2 }}>{UNTITLED}</h1>
        {status === "error" ? (
          <ErrorState panel="Composer" onRetry={onRetry} />
        ) : (
          <LoadingRegion what="your draft" announce style={{ display: "grid", gridTemplateColumns: phone ? "minmax(0, 1fr)" : "minmax(0, 1fr) 340px", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Panel surface="flat" padding={phone ? "16px" : "24px"}>
                <Skeleton height={phone ? 180 : 360} radius={10} />
              </Panel>
              <Panel surface="flat" padding={phone ? "16px" : "24px"}>
                <Skeleton height={phone ? 200 : 260} radius={10} />
              </Panel>
            </div>
          </LoadingRegion>
        )}
      </div>
    );
  }

  const untitled = isUntitled(heading);
  const blocked = missing.length > 0;
  const words = saveWords(saveState, savedJustNow);

  const statusLine = (
    <p data-testid="compose-status" style={{ margin: 0, fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
      Draft
      {words ? <> · {words}</> : null}
      {saveState === "failed" ? <TextButton size={12} onClick={onSaveRetry}>Try again</TextButton> : null}
      {blocked ? ` · still needs ${joinWords(missing)}` : null}
    </p>
  );

  const heading1 = (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <h1 style={{ ...display(phone ? 30 : 40, { mobilePageHeading: phone }), margin: 0, color: untitled ? t.text2 : t.text, overflowWrap: "anywhere" }}>
        {untitled ? UNTITLED : heading.trim()}
      </h1>
      <div style={{ marginTop: 6 }}>{statusLine}</div>
      {showStartLink ? (
        <Link to="/compose/start" style={{ marginTop: 10, alignSelf: "flex-start", fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
          Paste a transcript or a repo instead
        </Link>
      ) : null}
    </div>
  );

  const publishButton = (size: 42 | 48, fontSize: 14 | 15, full: boolean) => (
    <Button
      variant="primary"
      size={size}
      fontSize={fontSize}
      fullWidth={full}
      disabled={published !== null || publishing}
      onClick={onPublish}
      style={published === null && blocked ? { opacity: 0.7 } : undefined}
      data-blocked={published === null && blocked ? "true" : undefined}
    >
      {published !== null ? "Published" : "Publish"}
    </Button>
  );

  const banner = published ? (
    <div
      role="status"
      data-testid="published-banner"
      style={{
        padding: "12px 16px",
        borderRadius: r.control,
        background: t.evidenceFill,
        color: t.onEvidenceFill,
        fontFamily: FIGTREE,
        fontSize: 14,
        display: "flex",
        flexWrap: "wrap",
        gap: "4px 12px",
        alignItems: "baseline",
      }}
    >
      <span>
        Published.{" "}
        {published.inGallery ? "It is in the Gallery now." : `It will show in the Gallery once it has ${published.shortfall}.`}
      </span>
      <Link to={`/b2/${published.slug}`} style={{ color: "inherit", fontWeight: 600 }}>
        See it
      </Link>
    </div>
  ) : null;

  const left = (
    <div style={{ display: "flex", flexDirection: "column", gap: phone ? 12 : 16, minWidth: 0 }}>
      <MediaPanel media={props.media} phone={phone} onFile={props.onFile} onReplace={props.onReplace} onRemove={props.onRemoveMedia} />
      <TextPanel
        phone={phone}
        title={props.title}
        description={props.description}
        audience={props.audience}
        audienceOptions={props.audienceOptions}
        onTitle={props.onTitle}
        onDescription={props.onDescription}
        onAudience={props.onAudience}
      />
    </div>
  );

  if (phone) {
    return (
      <div data-testid="compose-view" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {heading1}
        {banner}
        {left}
        <div
          data-testid="compose-action-bar"
          style={{
            position: "sticky",
            bottom: "calc(92px + env(safe-area-inset-bottom))",
            zIndex: 5,
            display: "flex",
            gap: 8,
            padding: 10,
            borderRadius: r.panel,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowCard,
          }}
        >
          {slug ? (
            <LinkButton to={`/b2/${slug}`} size={48} fontSize={14} variant="ghost">
              Preview
            </LinkButton>
          ) : (
            <Button variant="ghost" size={48} fontSize={14} disabled>
              Preview
            </Button>
          )}
          <div style={{ flexGrow: 1 }}>{publishButton(48, 15, true)}</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="compose-view" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        {heading1}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          {slug ? (
            <LinkButton to={`/b2/${slug}`} size={42} fontSize={14} variant="secondary">
              Preview
            </LinkButton>
          ) : (
            <Button variant="secondary" size={42} fontSize={14} disabled>
              Preview
            </Button>
          )}
          {publishButton(42, 14, false)}
        </div>
      </div>
      {banner}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24, alignItems: "start" }}>
        {left}
        {/* UI-P48: Your sessions. The track stays so the left column does not move when it arrives. */}
        <div aria-hidden="true" />
      </div>
    </div>
  );
}

export default ComposeView;
