// "Download with files", in the browser: each attachment fetched through the signed media path, the zip built by `promptZip`,
// then saved. Resolves the names of the files that could not be fetched.

import { getMediaById, signedMediaUrl } from "./media";
import type { Step } from "./graph";
import { stepTitle } from "./graph";
import { promptZip, promptZipName } from "./promptZip";

async function mediaBytes(mediaId: string): Promise<Uint8Array | null> {
  const media = await getMediaById(mediaId);
  const url = media ? await signedMediaUrl(media, { width: "original" }) : null;
  if (!url) return null;
  const response = await fetch(url);
  return response.ok ? new Uint8Array(await response.arrayBuffer()) : null;
}

export async function downloadPromptWithFiles(step: Step): Promise<string[]> {
  const { zip, missing } = await promptZip(step, mediaBytes);
  const blob = new Blob([zip as unknown as BlobPart], { type: "application/zip" });
  const objectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null;
  if (!objectUrl) return missing;
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = promptZipName(stepTitle(step));
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return missing;
}
