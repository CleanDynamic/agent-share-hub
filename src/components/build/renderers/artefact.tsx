// artefact — code, live_app, repo, document, and generated_media.
//
// SYNTAX HIGHLIGHTING: there is none, and that is deliberate. ContentBlockViewer
// — the viewer this repo already ships — renders code as a plain monospace
// <pre> with a language pill and a copy control, and this surface matches it
// rather than introducing a second, heavier answer. Monaco is emphatically not
// imported here: it is ~3MB and this is a read surface.

import {
  Caption,
  Chip,
  ChipRow,
  DetailGrid,
  ExternalLink,
  MonoBlock,
  Prose,
  Section,
  Stack,
} from "./shared";
import {
  bool,
  fieldsOf,
  formatNumber,
  isPresent,
  joinCaption,
  labelFor,
  payloadOf,
  rowsOf,
  str,
  type PayloadRecord,
  type Stat,
} from "./payload";
import { MEDIA_QUALITY, MEDIA_WIDTH, mediaUrl } from "./media";
import { CATEGORY_COLOUR, HAIRLINE, TEAL, TEXT_MUTED, labelText } from "../tokens";
import type { GetCopyText, NodeProps } from "./types";
import type { FieldDef } from "@/lib/build";

const ARTEFACT = CATEGORY_COLOUR.artefact;
const MEDIA = CATEGORY_COLOUR.media;

/** The code payload, identified by schema shape rather than by node.type. */
function codeOf(record: PayloadRecord, fields: FieldDef[]): string | undefined {
  const field = fields.find((candidate) => candidate.key === "source" && candidate.type === "text");
  return field ? str(record, "source") : undefined;
}

export function ArtefactRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const fields = fieldsOf(nodeType);

  const source = codeOf(record, fields);
  const language = str(record, "language");
  const filename = str(record, "filename");
  const url = str(record, "url");

  const grid: Stat[] = [];
  const prose: Array<{ field: FieldDef; value: string }> = [];

  for (const field of fields) {
    if (["source", "language", "filename", "url", "entrypoint"].includes(field.key)) continue;
    const raw = record[field.key];
    if (!isPresent(raw)) continue;

    if (field.type === "text") {
      prose.push({ field, value: String(raw) });
      continue;
    }
    if (field.type === "boolean") {
      grid.push({ label: field.label, value: raw ? "Yes" : "No" });
      continue;
    }
    grid.push({
      label: field.label,
      value: field.type === "number" && typeof raw === "number" ? formatNumber(raw) : String(raw),
    });
  }

  return (
    <Stack>
      {language || filename || bool(record, "entrypoint") ? (
        <ChipRow>
          {language ? <Chip colour={ARTEFACT}>{language}</Chip> : null}
          {filename ? <Chip dim>{filename}</Chip> : null}
          {bool(record, "entrypoint") ? <Chip colour={TEAL}>start here</Chip> : null}
        </ChipRow>
      ) : null}

      {source ? <MonoBlock text={source} accent={ARTEFACT} /> : null}

      {url ? (
        <Section label={labelFor(nodeType, "url", "URL")}>
          <ExternalLink href={url} />
        </Section>
      ) : null}

      {prose.map(({ field, value }) => (
        <Section key={field.key} label={field.label}>
          <Prose dim>{value}</Prose>
        </Section>
      ))}

      <DetailGrid items={grid} />
    </Stack>
  );
}

// --- generated_media ---------------------------------------------------------

interface Variant {
  mediaId?: string;
  chosen: boolean;
  note?: string;
}

/**
 * The variant grid. The chosen frame carries a teal border at full opacity;
 * the rejected ones sit at 60% because they are context, not the artefact.
 *
 * Every tile is requested at thumbnail width through the transform endpoint —
 * a grid of four originals is the exact mistake this surface exists not to
 * repeat.
 */
function VariantGrid({ variants }: { variants: Variant[] }) {
  if (variants.length === 0) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 10,
      }}
    >
      {variants.map((variant, index) => {
        const src = mediaUrl(variant.mediaId, {
          width: MEDIA_WIDTH.thumb,
          quality: MEDIA_QUALITY,
        });

        return (
          <figure
            key={variant.mediaId ?? index}
            data-chosen={variant.chosen ? "true" : "false"}
            style={{
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: 6,
              borderRadius: 10,
              border: variant.chosen ? `1px solid ${TEAL}` : `1px solid ${HAIRLINE}`,
              opacity: variant.chosen ? 1 : 0.6,
            }}
          >
            {src ? (
              <img
                src={src}
                alt={variant.note ?? `Variant ${index + 1}`}
                loading="lazy"
                width={MEDIA_WIDTH.thumb}
                style={{ width: "100%", height: "auto", borderRadius: 6, display: "block" }}
              />
            ) : (
              <div
                style={{
                  aspectRatio: "1 / 1",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...labelText,
                  fontSize: 10.5,
                  color: TEXT_MUTED,
                  textAlign: "center",
                  padding: 8,
                }}
              >
                media not available
              </div>
            )}
            <figcaption
              style={{
                ...labelText,
                fontSize: 10.5,
                color: variant.chosen ? TEAL : TEXT_MUTED,
              }}
            >
              {variant.chosen ? "chosen" : variant.note ?? `variant ${index + 1}`}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export function GeneratedMediaRenderer({ node, nodeType }: NodeProps) {
  const record = payloadOf(node);
  const prompt = str(record, "prompt");

  const variants: Variant[] = rowsOf(record, "variants").map((row) => ({
    mediaId: typeof row.media_id === "string" ? row.media_id : undefined,
    chosen: row.chosen === true,
    note: typeof row.note === "string" ? row.note : undefined,
  }));

  const caption = joinCaption([
    str(record, "model"),
    str(record, "seed") ? `seed ${str(record, "seed")}` : undefined,
    str(record, "params"),
  ]);

  return (
    <Stack>
      <VariantGrid variants={variants} />
      {prompt ? (
        <Section label={labelFor(nodeType, "prompt", "Prompt")}>
          <MonoBlock text={prompt} accent={MEDIA} />
        </Section>
      ) : null}
      {caption ? <Caption>{caption}</Caption> : null}
    </Stack>
  );
}

/** Code copies as source. Everything else copies its address. */
export const getCopyText: GetCopyText = (node, nodeType) => {
  const record = payloadOf(node);
  return codeOf(record, fieldsOf(nodeType)) ?? str(record, "url") ?? null;
};

/** A generated image is reproduced from its prompt, so that is what copies. */
export const getGeneratedMediaCopyText: GetCopyText = (node) =>
  str(payloadOf(node), "prompt") ?? null;
