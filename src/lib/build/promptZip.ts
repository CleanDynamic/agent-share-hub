// "Download with files": one prompt as a zip of `prompt.md` (the copy, attach list first) and its attachments, named by their
// place, "1-screenshot.png", "2-pricing.md", in order. Built in the browser; the files come through `load`, which the page
// gives the signed media path. A file that cannot be fetched is left out and named, so the maker can say so.

import { zipEntriesOf } from "./attachments";
import { copyTogether } from "./copyTogether";
import type { Step } from "./graph";
import { writeZip, type ZipEntry } from "./zip";

export interface PromptZip {
  zip: Uint8Array;
  /** The attachments that could not be fetched, by name. */
  missing: string[];
}

export async function promptZip(step: Step, load: (mediaId: string) => Promise<Uint8Array | null>): Promise<PromptZip> {
  const text = copyTogether(step);
  const entries: ZipEntry[] = [];
  const missing: string[] = [];
  const named = zipEntriesOf(step.attachments ?? []);
  const shown = (step.attachments ?? []).filter((attachment) => attachment.mediaId);
  for (const [index, entry] of named.entries()) {
    if (!entry.mediaId) {
      entries.push({ path: entry.name, data: new TextEncoder().encode(text.endsWith("\n") ? text : `${text}\n`) });
      continue;
    }
    const data = await load(entry.mediaId).catch(() => null);
    if (data) entries.push({ path: entry.name, data });
    else missing.push(shown[index - 1]?.name ?? entry.name);
  }
  return { zip: writeZip(entries), missing };
}

/** A zip's file name from the prompt's title: "fix-the-mobile-layout.zip". */
export const promptZipName = (title: string): string => `${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "prompt"}.zip`;
