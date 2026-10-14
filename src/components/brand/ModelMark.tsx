// A model, lab or tool's real logo (UI-P83): the logo alone. No tile, no padding, no border, no background, no radius,
// no shadow, and never recoloured, cropped or redrawn.
//
// The files are Lobe Icons' static SVGs, each imported as a URL so only the ones named here ship. A `-color` file is
// the brand's own colours and is drawn as an image, unaltered. A mono file is one flat shape, so it is drawn as a mask
// over `currentColor` and takes the ink of whatever it sits in (`--text` unless a parent sets one). `mail` is not a
// brand: it is the refined glyph.
//
// Decorative: the name beside it is the label, so the mark is `aria-hidden` with an empty alt. No key, no output.

import anthropic from "@lobehub/icons-static-svg/icons/anthropic.svg";
import claudeColor from "@lobehub/icons-static-svg/icons/claude-color.svg";
import claudeCodeColor from "@lobehub/icons-static-svg/icons/claudecode-color.svg";
import cursor from "@lobehub/icons-static-svg/icons/cursor.svg";
import deepseekColor from "@lobehub/icons-static-svg/icons/deepseek-color.svg";
import geminiColor from "@lobehub/icons-static-svg/icons/gemini-color.svg";
import googleColor from "@lobehub/icons-static-svg/icons/google-color.svg";
import grok from "@lobehub/icons-static-svg/icons/grok.svg";
import openai from "@lobehub/icons-static-svg/icons/openai.svg";
import vercel from "@lobehub/icons-static-svg/icons/vercel.svg";
import xai from "@lobehub/icons-static-svg/icons/xai.svg";

import { markFor, type MarkKey } from "@/lib/models/marks";

import { Glyph } from "./Glyph";

export type ModelMarkSize = 14 | 16 | 18 | 20 | 24 | 28;

export interface ModelMarkProps {
  tool?: string | null;
  model?: string | null;
  lab?: string | null;
  size: ModelMarkSize;
}

const FILES: Readonly<Record<Exclude<MarkKey, "mail">, string>> = {
  anthropic,
  "claude-color": claudeColor,
  "claudecode-color": claudeCodeColor,
  cursor,
  "deepseek-color": deepseekColor,
  "gemini-color": geminiColor,
  "google-color": googleColor,
  grok,
  openai,
  vercel,
  xai,
};

export function ModelMark({ tool, model, lab, size }: ModelMarkProps) {
  const key = markFor({ tool, model, lab });
  if (key === null) return null;

  const box = {
    display: "inline-block",
    flexShrink: 0,
    verticalAlign: "middle",
    width: size,
    height: size,
  } as const;

  if (key === "mail") {
    return (
      <span aria-hidden="true" data-mark={key} style={{ ...box, lineHeight: 0 }}>
        <Glyph name="mail" size={size} />
      </span>
    );
  }

  const file = FILES[key];

  if (key.endsWith("-color")) {
    return (
      <img
        src={file}
        alt=""
        width={size}
        height={size}
        aria-hidden="true"
        draggable={false}
        data-mark={key}
        style={box}
      />
    );
  }

  /* Quoted: Vite inlines a small SVG as a data URI, whose quotes and brackets make an unquoted `url()` invalid, and
     the browser then drops the mask and paints the whole box. */
  const mask = `url("${file}")`;
  return (
    <span
      aria-hidden="true"
      data-mark={key}
      style={{
        ...box,
        backgroundColor: "currentColor",
        maskImage: mask,
        WebkitMaskImage: mask,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export default ModelMark;
