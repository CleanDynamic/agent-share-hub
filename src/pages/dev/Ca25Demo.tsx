/* CA-25 P4: /dev/kit/pages/sandbox?build=ca25&show=<what>: the Publish checklist, Confirm and a published build's menu, on the bakery fixture.

   `?show=` takes one of (press Publish on a draft, open the menu on a published build):
     checklist-full         2 required and 2 recommended items open
     checklist-recommended  only recommended items open (the Card, and two sessions with no app)
     confirm                nothing open: Publish goes straight to Confirm
     published              a build published 2 days ago; its options menu holds Copy link and Unpublish…
   Unpublish… returns the page to a draft, in memory. Nothing is written anywhere. */

import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { sandboxDetailsProps, sandboxListProps, sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { publishChecklist, type ChecklistInput } from "@/lib/build/publishChecklist";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

const DAY = 86_400_000;

const BASE: ChecklistInput = {
  missing: [],
  title: "Bakery homepage",
  description: "A warm homepage for a neighbourhood bakery, with opening hours and a menu.",
  cover: "image",
  tiles: 18,
  blockers: [],
  threadHold: null,
  reminders: [],
  appless: [
    { key: "s2", number: 2 },
    { key: "s4", number: 4 },
  ],
  cardFilled: false,
};

export default function Ca25Demo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const show = params.get("show") ?? "checklist-full";
  const phone = useIsPhone();
  const fine = useFinePointer();
  const [published, setPublished] = useState(show === "published");

  const base = sandboxViewProps("bakery", state);
  const sources = sandboxSourcesProps("bakery", state);
  const list = sandboxListProps("bakery");
  const input = useMemo<ChecklistInput>(() => {
    if (show === "checklist-full") return { ...BASE, missing: ["evidence", "title"], title: "", cover: null };
    if (show === "confirm") return { ...BASE, appless: [], cardFilled: true };
    return BASE;
  }, [show]);
  const publishedAt = useMemo(() => new Date(Date.now() - 2 * DAY).toISOString(), []);

  return (
    <SandboxView
      fit={fit}
      {...base}
      title={show === "checklist-full" ? "" : "Bakery homepage"}
      lens="list"
      onLens={noop}
      published={published ? { slug: "bakery-homepage-p2m8z4", inGallery: true, shortfall: "" } : null}
      publishedAt={publishedAt}
      onUnpublish={async () => {
        setPublished(false);
        return "done";
      }}
      publish={{
        checklist: publishChecklist(input),
        confirm: () => ({ post: { words: 240, links: 3 }, parts: 2, sessions: 4, tiles: 18, files: ["menu.pdf", "logo.png", "homepage.html"], card: ["Website", "Content"] }),
        onShowApps: noop,
      }}
      selection={<DetailsPanel {...sandboxDetailsProps("prompt", "bakery")} phone={phone} />}
      list={<BuildList {...list} phone={phone} arriving={null} onArrived={noop} />}
      sources={<SourcesPanel {...sources} phone={phone} fine={fine} />}
    />
  );
}
