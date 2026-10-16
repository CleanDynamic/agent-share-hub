// A model, lab or tool's real logo (UI-P83): the logo alone. No tile, no padding, no border, no background, no radius,
// no shadow, and never recoloured, cropped or redrawn.
//
// The files are Lobe Icons' static SVGs and three from `src/assets/tool-logos/`. The first eleven are inlined; every
// other one is imported with `?no-inline`, so it ships as its own small file fetched only when drawn. A `-color` file
// is the brand's own colours and is drawn as an image, unaltered. A mono file is one flat shape, so it is drawn as a
// mask over `currentColor` and takes the ink of whatever it sits in (`--text` unless a parent sets one). `mail` is not
// a brand: it is the refined glyph.
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

import aistudio from "@lobehub/icons-static-svg/icons/aistudio.svg?no-inline";
import antigravityColor from "@lobehub/icons-static-svg/icons/antigravity-color.svg?no-inline";
import codexColor from "@lobehub/icons-static-svg/icons/codex-color.svg?no-inline";
import comfyuiColor from "@lobehub/icons-static-svg/icons/comfyui-color.svg?no-inline";
import devinColor from "@lobehub/icons-static-svg/icons/devin-color.svg?no-inline";
import elevenlabs from "@lobehub/icons-static-svg/icons/elevenlabs.svg?no-inline";
import figmaColor from "@lobehub/icons-static-svg/icons/figma-color.svg?no-inline";
import githubcopilot from "@lobehub/icons-static-svg/icons/githubcopilot.svg?no-inline";
import hermesagent from "@lobehub/icons-static-svg/icons/hermesagent.svg?no-inline";
import klingColor from "@lobehub/icons-static-svg/icons/kling-color.svg?no-inline";
import lovableColor from "@lobehub/icons-static-svg/icons/lovable-color.svg?no-inline";
import makeColor from "@lobehub/icons-static-svg/icons/make-color.svg?no-inline";
import manus from "@lobehub/icons-static-svg/icons/manus.svg?no-inline";
import metaColor from "@lobehub/icons-static-svg/icons/meta-color.svg?no-inline";
import midjourney from "@lobehub/icons-static-svg/icons/midjourney.svg?no-inline";
import n8nColor from "@lobehub/icons-static-svg/icons/n8n-color.svg?no-inline";
import nanobananaColor from "@lobehub/icons-static-svg/icons/nanobanana-color.svg?no-inline";
import notebooklm from "@lobehub/icons-static-svg/icons/notebooklm.svg?no-inline";
import notion from "@lobehub/icons-static-svg/icons/notion.svg?no-inline";
import openclawColor from "@lobehub/icons-static-svg/icons/openclaw-color.svg?no-inline";
import perplexityColor from "@lobehub/icons-static-svg/icons/perplexity-color.svg?no-inline";
import replitColor from "@lobehub/icons-static-svg/icons/replit-color.svg?no-inline";
import soraColor from "@lobehub/icons-static-svg/icons/sora-color.svg?no-inline";
import suno from "@lobehub/icons-static-svg/icons/suno.svg?no-inline";
import v0 from "@lobehub/icons-static-svg/icons/v0.svg?no-inline";
import zapierColor from "@lobehub/icons-static-svg/icons/zapier-color.svg?no-inline";
import boltColor from "@/assets/tool-logos/bolt-color.svg?no-inline";
import canvaColor from "@/assets/tool-logos/canva-color.svg?no-inline";
import higgsfield from "@/assets/tool-logos/higgsfield.svg?no-inline";

import { markFor } from "@/lib/models/marks";
import type { LogoKey } from "@/lib/tools/registry";

import { Glyph } from "./Glyph";

export type ModelMarkSize = 14 | 16 | 18 | 20 | 24 | 28;

export interface ModelMarkProps {
  tool?: string | null;
  model?: string | null;
  lab?: string | null;
  size: ModelMarkSize;
}

const FILES: Readonly<Record<Exclude<LogoKey, "mail">, string>> = {
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
  "aistudio": aistudio,
  "antigravity-color": antigravityColor,
  "bolt-color": boltColor,
  "canva-color": canvaColor,
  "codex-color": codexColor,
  "comfyui-color": comfyuiColor,
  "devin-color": devinColor,
  "elevenlabs": elevenlabs,
  "figma-color": figmaColor,
  "githubcopilot": githubcopilot,
  "hermesagent": hermesagent,
  "higgsfield": higgsfield,
  "kling-color": klingColor,
  "lovable-color": lovableColor,
  "make-color": makeColor,
  "manus": manus,
  "meta-color": metaColor,
  "midjourney": midjourney,
  "n8n-color": n8nColor,
  "nanobanana-color": nanobananaColor,
  "notebooklm": notebooklm,
  "notion": notion,
  "openclaw-color": openclawColor,
  "perplexity-color": perplexityColor,
  "replit-color": replitColor,
  "sora-color": soraColor,
  "suno": suno,
  "v0": v0,
  "zapier-color": zapierColor,
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
