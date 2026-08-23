// The two controls that get a build out of NeoScale.
//
// Copy for AI puts the markdown on the clipboard, for the reader who is about
// to paste it into a chat and ask for a version of this build in their own
// stack. Download writes the JSON as <slug>.neoscale.json, for the reader who
// is keeping it, diffing it against a fork, or feeding it to something else.
//
// Both read the record the page already loaded rather than fetching again: an
// export that queried a second time could disagree with what the reader is
// looking at. Neither computes anything until it is clicked.

import { useEffect, useRef, useState } from "react";
import type { BuildRecord } from "@/lib/build";
import { toMarkdown, toPortable } from "@/lib/build/portable";
import { HAIRLINE, TEAL, TEXT_SECONDARY, hexToRgba, labelText } from "./tokens";

interface PortableExportProps {
  record: BuildRecord;
}

/** How long a control stays in its confirmed state. */
const CONFIRMED_MS = 1500;

const controlStyle = (active: boolean) => ({
  ...labelText,
  padding: "6px 12px",
  borderRadius: 8,
  fontSize: 11,
  cursor: "pointer",
  whiteSpace: "nowrap" as const,
  color: active ? TEAL : TEXT_SECONDARY,
  background: active ? hexToRgba(TEAL, 0.14) : "transparent",
  border: `1px solid ${active ? hexToRgba(TEAL, 0.3) : HAIRLINE}`,
  transition: "color 120ms ease, border-color 120ms ease",
});

export function PortableExport({ record }: PortableExportProps) {
  const [confirmed, setConfirmed] = useState<"copy" | "download" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const confirm = (which: "copy" | "download") => {
    setConfirmed(which);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setConfirmed(null), CONFIRMED_MS);
  };

  const copyForAI = async () => {
    try {
      await navigator.clipboard.writeText(toMarkdown(toPortable(record)));
      confirm("copy");
    } catch {
      // A denied clipboard permission is not worth a toast on a read surface.
      setConfirmed(null);
    }
  };

  const download = () => {
    const json = `${JSON.stringify(toPortable(record), null, 2)}\n`;
    const blob = new Blob([json], { type: "application/json" });

    // createObjectURL is absent in a test environment and in older embedded
    // webviews. The data URL is the same bytes by another route.
    const objectUrl =
      typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null;
    const href = objectUrl ?? `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;

    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${record.build.slug}.neoscale.json`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);

    confirm("download");
  };

  return (
    <div
      data-visual-slot="build-portable-export"
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
    >
      <button
        type="button"
        onClick={copyForAI}
        title="The whole build as markdown, ready to paste into an AI tool"
        style={controlStyle(confirmed === "copy")}
      >
        {confirmed === "copy" ? "✓ Copied for AI" : "Copy for AI"}
      </button>
      <button
        type="button"
        onClick={download}
        title={`The whole build as ${record.build.slug}.neoscale.json`}
        style={controlStyle(confirmed === "download")}
      >
        {confirmed === "download" ? "✓ Downloaded" : "Download"}
      </button>
    </div>
  );
}

export default PortableExport;
