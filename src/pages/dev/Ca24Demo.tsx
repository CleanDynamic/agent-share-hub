/* CA-24 P5: /dev/kit/pages/sandbox?build=ca24&show=<what>: loading, empty and error states of the composer, on the bakery fixture.

   `?show=` takes one of:
     first-load       the building blocks; `window.__ca24Ready()` loads the content over them (for the arriving shots)
     empty            "Add your first session" (a build with no sessions and no tiles)
     details-loading  Details while a selection loads
     details-failed   Details failing, with the build working
     import           a slow import at 6 of 18 prompts, with building blocks in the empty sockets (the page itself feeds no count)
   Nothing is written anywhere. */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sandboxDetailsProps, sandboxListProps, sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import type { Arriving } from "@/pages/site/compose/arrival";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";
import type { SourceLibraryItem } from "@/pages/site/compose/sourcesModel";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

const WRITTEN = [
  "Write the homepage copy for a neighbourhood bakery.",
  "Turn that copy into one HTML page with a sticky header.",
  "Add a menu grid of six items, each with a price.",
  "Make the header shrink a little when the page scrolls.",
  "Add opening hours to the footer, in a small table.",
  "Stack the menu grid to one column below 600px.",
];

declare global {
  interface Window {
    __ca24Ready?: () => void;
  }
}

export default function Ca24Demo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const show = params.get("show") ?? "first-load";
  const phone = useIsPhone();
  const fine = useFinePointer();
  const [ready, setReady] = useState(show !== "first-load");
  useEffect(() => {
    window.__ca24Ready = () => setReady(true);
    return () => {
      delete window.__ca24Ready;
    };
  }, []);

  const base = sandboxViewProps("bakery", state);
  const sources = sandboxSourcesProps("bakery", state);
  const library = useMemo<readonly SourceLibraryItem[]>(() => sources.library, [sources.library]);
  const list = sandboxListProps("bakery");
  const sessionDetails = sandboxDetailsProps("session", "bakery");

  const arriving: Arriving | null =
    show === "import"
      ? {
          key: "imp-18",
          kind: "chat",
          head: { key: "imp-18", number: 3, tool: "Claude", detail: "Opus 5.5 · 24 Oct", prompts: [], date: "24 Oct" },
          count: 18,
          status: "writing",
          progress: { done: 6, total: 18 },
          written: WRITTEN,
          onStop: noop,
        }
      : null;

  const details =
    show === "details-loading" && sessionDetails.view?.kind === "session" ? (
      <DetailsPanel {...sessionDetails} phone={phone} view={{ ...sessionDetails.view, status: "loading" }} />
    ) : (
      <DetailsPanel {...sandboxDetailsProps("prompt", "bakery")} phone={phone} />
    );

  return (
    <SandboxView
      fit={fit}
      {...base}
      status={ready ? base.status : "loading"}
      title="Bakery homepage"
      lens="list"
      onLens={noop}
      counts={show === "empty" ? { sessions: 0, prompts: 0, files: 0 } : base.counts}
      emptyBuild={
        show === "empty"
          ? {
              phone,
              fine,
              available: 8,
              addSession: { library, adding: false, onAdd: noop, onStartNew: noop },
              onDropFiles: noop,
              onPick: noop,
            }
          : null
      }
      panels={show === "details-failed" ? { Details: { failed: true, onRetry: noop } } : undefined}
      selection={details}
      list={<BuildList {...list} phone={phone} arriving={arriving} onArrived={noop} />}
      sources={<SourcesPanel {...sources} library={library} phone={phone} fine={fine} />}
    />
  );
}
