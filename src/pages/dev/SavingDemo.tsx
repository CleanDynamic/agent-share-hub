/* CA-23 P5: /dev/kit/pages/sandbox?build=ca23&show=<what>: the composer's saving, offline and two-tab states on the bakery fixture.

   `?show=` takes one of:
     status-saving | status-saved | status-saved-min | status-saved-clock | status-offline | status-offline-one | status-error | status-published
     offline-strip | other-tab-strip | both-strips
     reconnected          (the notice "Reconnected. 3 changes saved.")
     leave                (the window "Changes still saving")
     clash-tile | clash-fields | clash-post | clash-session
   Nothing is written anywhere. */

import { useSearchParams } from "react-router-dom";

import { sandboxListProps, sandboxSourcesProps, sandboxViewProps } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { clashView } from "@/lib/build/clashView";
import { BuildList } from "@/pages/site/compose/BuildList";
import { ClashWindow } from "@/pages/site/compose/ClashWindow";
import { ReferenceNotice } from "@/pages/site/compose/referencePieces";
import { OfflineStrip, OtherTabStrip, Strips } from "@/pages/site/compose/saveStrips";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { LeaveWindow } from "@/pages/site/compose/saveWindows";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";
import type { SaveState } from "@/pages/site/compose/composeModel";

import type { DesignPageProps } from "./KitPages";

const noop = () => undefined;

/** Yesterday at 14:05, so "saved at 14:05" reads the same whenever the page is opened. */
const clockSave = (): Date => {
  const at = new Date();
  at.setDate(at.getDate() - 1);
  at.setHours(14, 5, 0, 0);
  return at;
};

const TWO_MIN_AGO = (): Date => new Date(Date.now() - 2 * 60_000 - 5_000);

const at = (hours: number, minutes: number): number => new Date(2026, 9, 24, hours, minutes).getTime();

const STATUS: Record<string, { save: SaveState; lastSavedAt: () => Date | null; pending?: number; published?: boolean }> = {
  "status-saving": { save: "saving", lastSavedAt: () => null },
  "status-saved": { save: "saved", lastSavedAt: () => new Date() },
  "status-saved-min": { save: "saved", lastSavedAt: TWO_MIN_AGO },
  "status-saved-clock": { save: "saved", lastSavedAt: clockSave },
  "status-offline": { save: "offline", lastSavedAt: () => null, pending: 3 },
  "status-offline-one": { save: "offline", lastSavedAt: () => null, pending: 1 },
  "status-error": { save: "error", lastSavedAt: () => null },
  "status-published": { save: "saved", lastSavedAt: () => new Date(), published: true },
};

export default function SavingDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const show = params.get("show") ?? "status-saved";
  const phone = useIsPhone();
  const fine = useFinePointer();
  const status = STATUS[show] ?? STATUS["status-saved"];
  const base = sandboxViewProps("bakery", state);

  const strips = show === "offline-strip" || show === "both-strips" ? true : false;
  const tab = show === "other-tab-strip" || show === "both-strips";
  const clash =
    show === "clash-tile"
      ? clashView("Prompt 2", [{ key: "payload.text", mine: "Turn that copy into a single HTML page with a sticky header and a menu grid.", theirs: "Turn that copy into one HTML page: a sticky header, a hero, and a menu grid of six items." }], at(20, 41), at(20, 42))
      : show === "clash-fields"
        ? clashView(
            "Prompt 2",
            [
              { key: "title", mine: "Homepage page", theirs: "The page" },
              { key: "payload.text", mine: "Turn that copy into a single HTML page.", theirs: "Turn that copy into one HTML page, with a hero." },
            ],
            at(20, 41),
            at(20, 42),
          )
        : show === "clash-session"
          ? clashView("Session 2", [{ key: "title", mine: "Fix the mobile layout", theirs: "Mobile fixes" }], at(20, 41), at(20, 42))
          : show === "clash-post"
            ? clashView(
                "Post",
                [
                  {
                    key: "post_doc",
                    mine: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A homepage for a neighbourhood bakery, from three prompts." }] }] },
                    theirs: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "A warm homepage for the bakery on the corner, made in an afternoon." }] }] },
                  },
                ],
                at(20, 41),
                at(20, 42),
              )
            : null;

  return (
    <>
      <SandboxView
        fit={fit}
        {...base}
        title="Bakery homepage"
        save={status.save}
        lastSavedAt={status.lastSavedAt()}
        pendingWrites={status.pending}
        published={status.published ? { slug: "bakery-homepage-p2m8z4", inGallery: true, shortfall: "" } : null}
        lens="list"
        onLens={noop}
        strips={
          strips || tab ? (
            <Strips>
              {strips ? <OfflineStrip /> : null}
              {tab ? <OtherTabStrip onShow={noop} /> : null}
            </Strips>
          ) : undefined
        }
        list={<BuildList {...sandboxListProps("bakery")} phone={phone} />}
        sources={<SourcesPanel {...sandboxSourcesProps("bakery", state)} phone={phone} fine={fine} />}
      />
      <LeaveWindow open={show === "leave"} count={2} onStay={noop} onLeave={noop} />
      <ClashWindow view={clash} onUseOther={noop} onKeepThis={noop} />
      {show === "reconnected" ? <ReferenceNotice notice={{ sentence: "Reconnected. 3 changes saved.", n: 1, noUndo: true }} onUndo={noop} onDone={noop} phone={phone} /> : null}
    </>
  );
}
