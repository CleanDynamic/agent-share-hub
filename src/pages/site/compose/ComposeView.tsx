/* UI-P47 — the composer, part 1: the frame, Media, Text and Publish.

   PURE. Props in, markup out: no fetching, no `useAuth()`, no router hooks but
   `Link`. `ComposePage` supplies the build and the writes; the dev compare page
   supplies a fixture. The viewport is read here (768px) so both behave alike.

   ONE SIMPLE PAGE FOR ORDINARY DRAFTS: media, text and (UI-P48) prompts. Every
   panel is flat — a place you work in is not a thing on display — so nothing on
   this page has `--glass` or a blur. Publish is the page's one primary; the
   header's "New build" draws as secondary here (SiteHeader reads the route).

   THE DROP ZONE IS A MOUSE'S SHORTCUT. On a phone there is no dropping, so the
   dashed box itself is the button that opens the file picker.

   UI-P48 fills the left column below Text (Prompts, Made with, More details) and
   the right column (Your sessions). Until then the right track is kept, empty. */

import { Image as ImageIcon } from "lucide-react";
import { useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/brand/Button";
import { ErrorState } from "@/components/brand/ErrorState";
import { Panel, PanelHead } from "@/components/brand/Panel";
import { LoadingRegion, Skeleton } from "@/components/brand/Skeleton";
import { useIsPhone, useWidthTier } from "@/components/shell/useMinWidth";
import { ring } from "@/lib/theme/controls";
import { useInteractive } from "@/lib/theme/interactive";
import { r } from "@/lib/theme/radius";
import { t } from "@/lib/theme/tokens";
import { DM_MONO, FIGTREE, display } from "@/lib/theme/type";

import { DESCRIPTION_MAX, isUntitled, SAVE_WORDS, UNTITLED, type SaveState } from "./composeModel";

/* ── the view's props ── */

export type ComposeStatus = "loading" | "error" | "notFound" | "ready";

export interface ComposeCover {
  /** The picture's address once it is signed; null while it is on its way. */
  url: string | null;
  kind: "image" | "video";
}

export interface ComposePublished {
  slug: string;
  inGallery: boolean;
  /** What would put it in the Gallery, as the copy reads, when it is not there yet. */
  shortfall: string;
}

export interface ComposeViewProps {
  fit?: "board" | "content";
  status: ComposeStatus;
  onRetry: () => void;

  title: string;
  onTitle: (value: string) => void;
  description: string;
  onDescription: (value: string) => void;
  /** The "Who it's for" input's text, as typed. */
  audience: string;
  onAudience: (value: string) => void;
  /** The gallery's existing audiences, for the datalist. */
  audienceOptions: readonly string[];

  save: SaveState;
  onRetrySave: () => void;
  /** What publishing still needs, in plain words and in order. */
  missing: readonly string[];

  /** On /compose/new: the text link to the paste-a-transcript and repo intake. */
  intakeHref?: string | null;
  /** The draft's slug once it exists: Preview is disabled until then. */
  slug: string | null;
  published: ComposePublished | null;
  publishing: boolean;
  onPublish: () => void;

  cover: ComposeCover | null;
  /** 0 to 1 while a file is going up; null otherwise. */
  adding: number | null;
  mediaError: string | null;
  /** The image and video mime types the picker accepts. */
  accept: readonly string[];
  /** One or more files: dropped, or chosen. The page adds or replaces. */
  onFiles: (files: File[]) => void;
  onRemoveCover: () => void;
}

/* ── shared pieces ── */

const text2Button: CSSProperties = {
  fontFamily: FIGTREE,
  fontSize: 14,
  color: t.text2,
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
};

function TextButton({
  onClick,
  underline = false,
  disabled,
  children,
}: {
  onClick: (event: React.MouseEvent) => void;
  underline?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { state, handlers } = useInteractive<HTMLButtonElement>();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...handlers}
      style={{
        ...text2Button,
        textDecoration: underline ? "underline" : "none",
        borderRadius: 6,
        ...(disabled ? { cursor: "default", opacity: 0.6 } : null),
        ...ring(state.focusVisible),
      }}
    >
      {children}
    </button>
  );
}

/** A link drawn as a button of the same size and type, for Preview. */
function LinkButton({ to, size, fontSize, variant, children }: { to: string | null; size: 42 | 48; fontSize: 14; variant: "secondary" | "ghost"; children: ReactNode }) {
  const { state, handlers } = useInteractive<HTMLAnchorElement>();
  const common: CSSProperties = {
    height: size,
    padding: "0 14px",
    borderRadius: r.control,
    boxSizing: "border-box",
    fontFamily: FIGTREE,
    fontSize,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    textDecoration: "none",
    border: variant === "secondary" ? `1px solid ${t.line}` : "1px solid transparent",
    background: variant === "secondary" ? t.glass2 : "transparent",
    color: variant === "secondary" ? t.text : t.text2,
    whiteSpace: "nowrap",
  };
  if (!to) {
    return (
      <span aria-disabled="true" style={{ ...common, opacity: 0.5, cursor: "not-allowed" }}>
        {children}
      </span>
    );
  }
  return (
    <Link to={to} {...handlers} style={{ ...common, ...ring(state.focusVisible) }}>
      {children}
    </Link>
  );
}

const fieldBase: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: t.field,
  color: t.text,
  border: `1px solid ${t.line}`,
  borderRadius: r.control,
  fontFamily: FIGTREE,
  outline: "none",
};

function Field({ id, label, hint, right, children }: { id: string; label: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <label htmlFor={id} style={{ fontFamily: FIGTREE, fontSize: 14, fontWeight: 500, color: t.text }}>
          {label}
        </label>
        {hint ? <span style={{ fontFamily: FIGTREE, fontSize: 13, color: t.text2 }}>{hint}</span> : null}
        {right ? <span style={{ marginLeft: "auto" }}>{right}</span> : null}
      </div>
      {children}
    </div>
  );
}

/** A field that draws the focus ring as `ring()` does, on focus-visible only. */
function useRing<T extends HTMLElement>() {
  const { state, handlers } = useInteractive<T>();
  return { handlers, style: ring(state.focusVisible) };
}

/* ── Media ── */

function MediaPanel({
  phone,
  cover,
  adding,
  mediaError,
  accept,
  onFiles,
  onRemoveCover,
}: Pick<ComposeViewProps, "cover" | "adding" | "mediaError" | "accept" | "onFiles" | "onRemoveCover"> & { phone: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const pick = () => input.current?.click();
  const busy = adding !== null;

  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");
  const dropHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setOver(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setOver(true);
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setOver(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0 && !busy) onFiles(files);
    },
  };

  const pct = Math.round((adding ?? 0) * 100);
  const { handlers: zoneHandlers, style: zoneRing } = useRing<HTMLDivElement>();

  return (
    <Panel surface="flat" padding={phone ? "16px" : "24px"}>
      <PanelHead title="Media" subtitle="What people see first in the Gallery." headingLevel={2} />
      <input
        ref={input}
        type="file"
        accept={accept.join(",")}
        hidden
        data-testid="compose-file"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />

      <div style={{ marginTop: 16 }}>
        {cover ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ aspectRatio: "16 / 9", borderRadius: r.media, overflow: "hidden", background: t.recess }}>
              {cover.url === null ? null : cover.kind === "video" ? (
                <video src={cover.url} controls muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <img src={cover.url} alt="Cover" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
            </div>
            {busy ? (
              <Adding pct={pct} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ flexGrow: 1, fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>Cover</span>
                <TextButton onClick={pick}>Replace</TextButton>
                <TextButton onClick={onRemoveCover}>Remove</TextButton>
              </div>
            )}
          </div>
        ) : busy ? (
          <div
            style={{
              aspectRatio: "16 / 9",
              borderRadius: r.media,
              border: `1.5px dashed ${t.line}`,
              background: t.recess,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div style={{ width: "100%", maxWidth: 360 }}>
              <Adding pct={pct} />
            </div>
          </div>
        ) : (
          <div
            data-testid="compose-dropzone"
            data-over={over ? "true" : undefined}
            {...dropHandlers}
            {...(phone ? { ...zoneHandlers, role: "button", tabIndex: 0, "aria-label": "Add a screenshot or a short video", onClick: pick, onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); pick(); } } } : null)}
            style={{
              aspectRatio: "16 / 9",
              borderRadius: r.media,
              border: `1.5px dashed ${over ? t.evidence : t.line}`,
              background: over ? t.rowHighlight : t.recess,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: 16,
              textAlign: "center",
              cursor: phone ? "pointer" : "default",
              ...(phone ? zoneRing : null),
            }}
          >
            <ImageIcon size={28} strokeWidth={1.6} color="var(--text2)" aria-hidden="true" />
            <span style={{ fontFamily: FIGTREE, fontSize: 15, fontWeight: 600, color: t.text }}>
              {phone ? "Add a screenshot or a short video" : "Drop a screenshot or a short video"}
            </span>
            <TextButton
              underline
              onClick={(event) => {
                event.stopPropagation();
                pick();
              }}
            >
              or browse your files
            </TextButton>
          </div>
        )}
        {mediaError ? (
          <p role="alert" style={{ margin: "10px 0 0", fontFamily: FIGTREE, fontSize: 14, color: t.catBreakage }}>
            {mediaError}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

/** "Adding… 40%": the vocabulary never says "upload". */
function Adding({ pct }: { pct: number }) {
  return (
    <div role="status" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ height: 4, borderRadius: 2, background: t.barBase, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: t.evidence }} />
      </div>
      <span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>Adding… {pct}%</span>
    </div>
  );
}

/* ── Text ── */

function TextPanel({
  phone,
  title,
  onTitle,
  description,
  onDescription,
  audience,
  onAudience,
  audienceOptions,
}: Pick<ComposeViewProps, "title" | "onTitle" | "description" | "onDescription" | "audience" | "onAudience" | "audienceOptions"> & { phone: boolean }) {
  const titleRing = useRing<HTMLInputElement>();
  const descRing = useRing<HTMLTextAreaElement>();
  const forRing = useRing<HTMLInputElement>();
  return (
    <Panel surface="flat" padding={phone ? "16px" : "24px"}>
      <PanelHead title="Text" subtitle="Shown on your build's card." headingLevel={2} />
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
        <Field id="compose-title" label="Title">
          <input
            id="compose-title"
            type="text"
            value={title}
            placeholder="Name your build"
            autoComplete="off"
            onChange={(event) => onTitle(event.target.value)}
            {...titleRing.handlers}
            style={{ ...fieldBase, height: 44, padding: "0 14px", fontSize: 17, fontWeight: 600, ...titleRing.style }}
          />
        </Field>

        <Field
          id="compose-description"
          label="Description"
          right={<span style={{ fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>{description.length} / {DESCRIPTION_MAX}</span>}
        >
          <textarea
            id="compose-description"
            rows={3}
            value={description}
            maxLength={DESCRIPTION_MAX}
            placeholder="What does it do, and who is it for? One or two sentences."
            onChange={(event) => onDescription(event.target.value)}
            {...descRing.handlers}
            style={{ ...fieldBase, padding: "12px 14px", fontSize: 16, lineHeight: 1.5, resize: "vertical", display: "block", ...descRing.style }}
          />
        </Field>

        <Field id="compose-audience" label="Who it's for" hint="Separate with commas">
          <input
            id="compose-audience"
            type="text"
            list="compose-audience-options"
            value={audience}
            autoComplete="off"
            onChange={(event) => onAudience(event.target.value)}
            {...forRing.handlers}
            style={{ ...fieldBase, height: 40, padding: "0 14px", fontSize: phone ? 16 : 15, ...forRing.style }}
          />
          <datalist id="compose-audience-options">
            {audienceOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </Field>
      </div>
    </Panel>
  );
}

/* ── states ── */

function Skeletons({ phone }: { phone: boolean }) {
  return (
    <LoadingRegion what="the composer" announce>
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? 12 : 16 }}>
        <Skeleton width={phone ? "70%" : 360} height={phone ? 30 : 40} radius={r.chip} />
        <Panel surface="flat" padding={phone ? "16px" : "24px"}>
          <Skeleton width={120} height={16} />
          <Skeleton height={phone ? 180 : 320} radius={r.media} style={{ marginTop: 16, aspectRatio: "16 / 9" }} />
        </Panel>
        <Panel surface="flat" padding={phone ? "16px" : "24px"}>
          <Skeleton width={120} height={16} />
          <Skeleton height={44} radius={r.control} style={{ marginTop: 16 }} />
        </Panel>
      </div>
    </LoadingRegion>
  );
}

function NotFound() {
  return (
    <Panel surface="flat" padding="24px" style={{ maxWidth: 520 }}>
      <h1 style={{ ...display(30), margin: 0, color: t.text }}>No build at this address</h1>
      <p style={{ margin: "10px 0 14px", fontFamily: FIGTREE, fontSize: 15, color: t.text2 }}>
        Nothing here, or nothing you can open. It may have been deleted, or it may be another creator's build.
      </p>
      <Link to="/compose/new" style={{ fontFamily: FIGTREE, fontSize: 14, color: t.text2, textDecoration: "underline" }}>
        Start a new build
      </Link>
    </Panel>
  );
}

/* ── the view ── */

export function ComposeView(props: ComposeViewProps) {
  const phone = useIsPhone();
  const tier = useWidthTier();
  const { status } = props;

  if (status === "loading") return <Skeletons phone={phone} />;
  if (status === "error") {
    return (
      <Panel surface="flat" padding={phone ? "16px" : "24px"}>
        <ErrorState line="This build didn't load." panel="The composer" onRetry={props.onRetry} />
      </Panel>
    );
  }
  if (status === "notFound") return <NotFound />;

  const { title, published, missing, save } = props;
  const untitled = isUntitled(title);
  const needs = missing.length > 0;

  const statusLine = (
    <>
    <p data-testid="compose-status" style={{ margin: "6px 0 0", fontFamily: DM_MONO, fontSize: 12, color: t.text2 }}>
      {published ? "Published" : "Draft"}
      {save !== "idle" ? <> · {SAVE_WORDS[save]}{save === "error" ? <TextButton onClick={props.onRetrySave}>Try again</TextButton> : null}</> : null}
      {needs && !published ? ` · still needs ${missing.join(", ")}` : null}
    </p>
    {props.intakeHref ? (
      <Link to={props.intakeHref} style={{ display: "inline-block", marginTop: 8, fontFamily: FIGTREE, fontSize: 14, color: t.text2 }}>
        Paste a transcript or a repo instead
      </Link>
    ) : null}
    </>
  );

  const publishLabel = published ? "Published" : props.publishing ? "Publishing…" : "Publish";
  const publishDisabled = Boolean(published) || props.publishing;
  const publishStyle: CSSProperties | undefined = needs && !published ? { opacity: 0.7 } : undefined;

  const heading = (
    <h1
      data-testid="compose-heading"
      style={{
        ...display(phone ? 30 : 40, { mobilePageHeading: phone }),
        margin: 0,
        color: untitled ? t.text2 : t.text,
        overflowWrap: "anywhere",
      }}
    >
      {untitled ? UNTITLED : title.trim()}
    </h1>
  );

  const stacked = tier === "stacked";
  const body = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: phone || stacked ? "minmax(0, 1fr)" : "minmax(0, 1fr) 340px",
        gap: phone ? 12 : 24,
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: phone ? 12 : 16, minWidth: 0 }}>
        <MediaPanel
          phone={phone}
          cover={props.cover}
          adding={props.adding}
          mediaError={props.mediaError}
          accept={props.accept}
          onFiles={props.onFiles}
          onRemoveCover={props.onRemoveCover}
        />
        <TextPanel
          phone={phone}
          title={props.title}
          onTitle={props.onTitle}
          description={props.description}
          onDescription={props.onDescription}
          audience={props.audience}
          onAudience={props.onAudience}
          audienceOptions={props.audienceOptions}
        />
      </div>
      {/* UI-P48: Your sessions. The track is kept; nothing is in it yet. */}
      {phone || stacked ? null : <div aria-hidden="true" />}
    </div>
  );

  const banner = published ? (
    <div
      role="status"
      data-testid="compose-published"
      style={{
        padding: "12px 16px",
        borderRadius: 12,
        background: t.evidenceFill,
        color: t.onEvidenceFill,
        fontFamily: FIGTREE,
        fontSize: 14,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        gap: 6,
      }}
    >
      <span>
        Published.{" "}
        {published.inGallery
          ? "It is in the Gallery now."
          : `It will show in the Gallery once you ${published.shortfall}.`}
      </span>
      <Link to={`/b2/${published.slug}`} style={{ color: "inherit", fontWeight: 600, textDecoration: "underline" }}>
        See it
      </Link>
    </div>
  ) : null;

  if (phone) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          {heading}
          {statusLine}
        </div>
        {banner}
        {body}
        <div
          role="group"
          aria-label="Actions"
          style={{
            position: "sticky",
            bottom: "calc(92px + env(safe-area-inset-bottom))",
            zIndex: 5,
            display: "flex",
            gap: 8,
            padding: 10,
            borderRadius: 16,
            background: t.solid,
            border: `1px solid ${t.line}`,
            boxShadow: t.shadowCard,
            boxSizing: "border-box",
          }}
        >
          <LinkButton to={props.slug ? `/b2/${props.slug}` : null} size={48} fontSize={14} variant="ghost">
            Preview
          </LinkButton>
          <div style={{ flexGrow: 1 }}>
            <Button size={48} fontSize={15} fullWidth disabled={publishDisabled} onClick={props.onPublish} style={publishStyle}>
              {publishLabel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div style={{ minWidth: 0 }}>
          {heading}
          {statusLine}
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <LinkButton to={props.slug ? `/b2/${props.slug}` : null} size={42} fontSize={14} variant="secondary">
            Preview
          </LinkButton>
          <Button size={42} fontSize={14} disabled={publishDisabled} onClick={props.onPublish} style={publishStyle}>
            {publishLabel}
          </Button>
        </div>
      </div>
      {banner}
      {body}
    </div>
  );
}

export default ComposeView;
