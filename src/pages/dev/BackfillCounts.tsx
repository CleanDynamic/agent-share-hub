/* SV-23: /dev/backfill-counts. An admin runs it once: it counts every build that has no step count yet, with the composer's own
   functions, and writes the counts that differ. Safe to run again. Behind AdminRoute (see App.tsx), so only an admin sees it. */

import { useRef, useState } from "react";

import { BACKFILL_BATCH, backfillCounts, type BackfillSummary } from "@/lib/build/backfillCounts";
import { t } from "@/lib/theme/tokens";
import { BuildsControl, text } from "@/pages/site/builds/BuildsFrame";

const EMPTY: BackfillSummary = { done: 0, skipped: [], failed: [] };

function Outcomes({ title, rows }: { title: string; rows: BackfillSummary["skipped"] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-label={title} style={{ marginTop: 16 }}>
      <h2 style={{ ...text(14, 500, t.text), margin: 0 }}>{`${title} · ${rows.length}`}</h2>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
        {rows.map((row) => (
          <li key={row.id} style={{ ...text(12, 400, t.text2), minHeight: 24 }}>{`${row.id}: ${row.reason}`}</li>
        ))}
      </ul>
    </section>
  );
}

export default function BackfillCounts() {
  const [summary, setSummary] = useState<BackfillSummary>(EMPTY);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopped = useRef(false);

  const run = async () => {
    stopped.current = false;
    setRunning(true);
    setFinished(false);
    setError(null);
    setSummary(EMPTY);
    try {
      setSummary(await backfillCounts(setSummary, () => stopped.current));
      setFinished(true);
    } catch (cause) {
      setError((cause as { message?: string })?.message ?? "The builds could not be read.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <h1 style={{ ...text(20, 500, t.text), margin: 0 }}>Backfill build counts</h1>
      <p style={{ ...text(13, 400, t.text2), margin: "8px 0 16px" }}>
        {`Counts every build that has no step count yet, ${BACKFILL_BATCH} at a time, and writes the counts that differ. Running it again is safe. Builds this account cannot read are not counted here; they are counted the next time they are saved.`}
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <BuildsControl onClick={() => void run()} disabled={running}>{running ? "Counting" : "Count builds"}</BuildsControl>
        {running ? <BuildsControl onClick={() => (stopped.current = true)}>Stop</BuildsControl> : null}
      </div>
      <p role="status" style={{ ...text(13, 400, t.text), margin: "16px 0 0" }}>
        {`Done ${summary.done} · Skipped ${summary.skipped.length} · Failed ${summary.failed.length}${finished ? " · Finished" : ""}`}
      </p>
      {error ? <p role="alert" style={{ ...text(13, 400, t.text), margin: "8px 0 0" }}>{error}</p> : null}
      <Outcomes title="Skipped" rows={summary.skipped} />
      <Outcomes title="Failed" rows={summary.failed} />
    </main>
  );
}
