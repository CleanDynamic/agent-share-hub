// artefact — code, live_app, repo, generated_media, document.
//
// CODE AND MONACO
// The read surface for code in this repo is a styled <pre>: ContentBlockViewer
// puts text_content into a bordered dark monospace block with no highlighter
// library behind it, and that is what this matches. Monaco is the EDIT surface
// (article/blocks/CodeBlock.tsx) and it is ~3MB — it must not appear in the
// BuildPage chunk. Nothing in this directory imports it.
//
// As everywhere in this folder, the layout is chosen by which field keys the
// schema declares, never by a switch on node.type: `source` makes a code
// block, `url` makes a launch link, `variants` makes the media grid.

import type { CSSProperties } from "react";
import { HAIRLINE, TEAL, TEXT_MUTED, TEXT_SECONDARY, bodyText, hexToRgba, labelText } from "../tokens";
import { MEDIA_WIDTH, MediaFigure } from "../MediaFigure";
import {
  Caption,
  Chip,
  ChipRow,
  Field,
  KeyValueGrid,
  MONO_STACK,
  MonoBlock,
  Prose,
  type GetCopyText,
  type NodeProps,
  Rest,
  Stack,
  bool,
  fieldsOf,
  isPresent,
  labelFor,
  monoBlockStyle,
  payloadOf,
  rows,
  str,
} from "./shared";

const SOURCE_KEY = "source";
const URL_KEY = "url";
const VARIANTS_KEY = "variants";

/** A grid cell is small, so the transform is asked for a small image. */
const VARIANT_WIDTH = MEDIA_WIDTH.variant;

// --- the launch link ---------------------------------------------------------

function LaunchLink({ url, label }: { url: string; label: string }) {
  const style: CSSProperties = {
    ...bodyText,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 8,
    textDecoration: "none",
    color: TEAL,
    background: hexToRgba(TEAL, 0.1),
    border: `1px solid ${hexToRgba(TEAL, 0.3)}`,
    wordBreak: "break-all",
  };
  return (
    <a href={url} target="_blank" rel="noreferrer noopener" style={style}>
      {label}
      <span aria-hidden="true" style={{ opacity: 0.7 }}>
        ↗
      </span>
    </a>
  );
}

// --- artefact ----------------------------------------------------------------

/** renderer key: "artefact" — code, live_app, repo, document. */
export function ArtefactRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const fields = fieldsOf(props.nodeType).filter((field) => isPresent(payload[field.key]));

  const source = str(payload, SOURCE_KEY);
  const language = str(payload, "language");
  const filename = str(payload, "filename");
  const entrypoint = bool(payload, "entrypoint");
  const url = str(payload, URL_KEY);
  const summary = str(payload, "summary");

  // `title` duplicates the node's own title on the card above it.
  const gridFields = fields.filter(
    (field) =>
      field.type !== "list" &&
      field.type !== "text" &&
      !["language", "filename", "entrypoint", URL_KEY, "title"].includes(field.key)
  );

  const remainingText = fields.filter(
    (field) => field.type === "text" && ![SOURCE_KEY, "summary"].includes(field.key)
  );

  const handled = [
    SOURCE_KEY,
    URL_KEY,
    "language",
    "filename",
    "entrypoint",
    "summary",
    "title",
    ...gridFields.map((field) => field.key),
    ...remainingText.map((field) => field.key),
  ];

  return (
    <div data-visual-slot="renderer-artefact" style={{ minWidth: 0 }}>
      <Stack gap={12}>
        {language || filename || entrypoint ? (
          <ChipRow>
            {language ? (
              <Chip colour={TEAL} tinted>
                {language}
              </Chip>
            ) : null}
            {filename ? (
              <span
                style={{
                  ...bodyText,
                  fontFamily: MONO_STACK,
                  fontSize: 12,
                  color: TEXT_SECONDARY,
                  wordBreak: "break-all",
                }}
              >
                {filename}
              </span>
            ) : null}
            {entrypoint ? (
              <Chip colour={TEAL} tinted title="Start reading here">
                entrypoint
              </Chip>
            ) : null}
          </ChipRow>
        ) : null}

        {source ? <MonoBlock text={source} collapseTo={24} /> : null}

        {summary ? <Prose>{summary}</Prose> : null}

        {url ? (
          <div>
            <LaunchLink url={url} label={labelFor(props.nodeType, URL_KEY, "Open")} />
          </div>
        ) : null}

        {remainingText.map((field) => (
          <Field key={field.key} label={field.label}>
            <Prose style={{ color: TEXT_SECONDARY }}>{str(payload, field.key)}</Prose>
          </Field>
        ))}

        <KeyValueGrid
          pairs={gridFields.map((field) => ({
            label: field.label,
            value:
              field.type === "boolean"
                ? bool(payload, field.key)
                  ? "Yes"
                  : "No"
                : str(payload, field.key),
          }))}
        />

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

// --- generated_media ---------------------------------------------------------

/**
 * renderer key: "generated_media"
 *
 * The variant grid is the point: what the model produced, and which one the
 * creator kept. The chosen variant carries a teal border and full opacity; the
 * rest sit at 60% so the choice reads at a glance.
 */
export function GeneratedMediaRenderer(props: NodeProps) {
  const payload = payloadOf(props.node);
  const variants = rows(payload, VARIANTS_KEY);
  const prompt = str(payload, "prompt");
  const model = str(payload, "model");
  const seed = str(payload, "seed");
  const params = str(payload, "params");

  const caption = [model, params, seed ? `seed ${seed}` : undefined]
    .filter(Boolean)
    .join(" · ");

  const chosenIndex = variants.findIndex((variant) => variant.chosen === true);

  const handled = [VARIANTS_KEY, "prompt", "model", "seed", "params"];

  return (
    <div data-visual-slot="renderer-generated-media" style={{ minWidth: 0 }}>
      <Stack gap={12}>
        {prompt ? (
          <Field label={labelFor(props.nodeType, "prompt", "Prompt")}>
            <MonoBlock text={prompt} collapseTo={8} />
          </Field>
        ) : null}

        {caption ? <Caption>{caption}</Caption> : null}

        {variants.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {variants.map((variant, index) => {
              const chosen = variant.chosen === true;
              const reference =
                typeof variant.media_id === "string" ? variant.media_id : undefined;
              const note = typeof variant.note === "string" ? variant.note : undefined;

              return (
                <figure
                  key={index}
                  style={{
                    margin: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: 6,
                    borderRadius: 10,
                    border: `1px solid ${chosen ? TEAL : HAIRLINE}`,
                    background: chosen ? hexToRgba(TEAL, 0.06) : "transparent",
                    opacity: chosen || chosenIndex === -1 ? 1 : 0.6,
                  }}
                >
                  <MediaFigure
                    reference={reference}
                    resolveMedia={props.resolveMedia}
                    alt={note ?? `Variant ${index + 1}`}
                    width={VARIANT_WIDTH}
                    style={{ border: "none", borderRadius: 6 }}
                  />
                  <figcaption
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        ...labelText,
                        fontSize: 11,
                        color: chosen ? TEAL : TEXT_MUTED,
                      }}
                    >
                      {chosen ? "chosen" : `variant ${index + 1}`}
                    </span>
                    {note ? (
                      <span
                        style={{
                          ...bodyText,
                          fontSize: 11,
                          color: TEXT_MUTED,
                          textAlign: "right",
                          minWidth: 0,
                          wordBreak: "break-word",
                        }}
                      >
                        {note}
                      </span>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        ) : null}

        <Rest node={props.node} nodeType={props.nodeType} handled={handled} />
      </Stack>
    </div>
  );
}

/** code copies as its source; generated_media copies as the prompt that made it. */
export const getCopyText: GetCopyText = (node) => {
  const payload = payloadOf(node);
  return str(payload, SOURCE_KEY) ?? str(payload, "prompt") ?? null;
};

export default ArtefactRenderer;
