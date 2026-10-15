/* UI-P63 — /dev/kit/pages/sandbox?theme=noon|dusk&viewport=desktop|mobile.

   `SandboxView` with the sample builds, whatever SANDBOX_COMPOSER_ENABLED says.
   `?build=bakery` draws the second (S3); the default is the fox poster (S1).
   `?open=1` opens the full prompt window on the selected prompt (UI-P67).
   `?lens=map` draws the Map; `?build=big` is 60 steps for the long-task measurement (UI-P68).
   `?build=team` is the team build (S5): add `&lens=map` for its Map, and `&opened=t3` (or `t3b`) for the
   opened team (V5-TeamMap) (UI-P69).
   `?build=manual` is the manual step build (D2 option B): add `&lens=map` for its Map (UI-P70).
   `?details=prompt|session|agent|file|tool|result` picks what Details shows (UI-P66).
   No board image is compared. */

import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FullPromptWindow } from "@/components/build/FullPromptWindow";

import { sandboxDetailsProps, sandboxMapProps, sandboxListProps, sandboxSourcesProps, sandboxManualFixture, sandboxTeamFixture, sandboxViewProps, type SandboxDetails, type SandboxFixture, type SandboxMapFixture } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { BuildMap } from "@/pages/site/compose/BuildMap";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import type { DesignPageProps } from "./KitPages";

export default function SandboxDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const asBuild = params.get("build");
  const which: SandboxFixture = asBuild === "bakery" || asBuild === "big" ? "bakery" : "fox";
  const mapOf: SandboxMapFixture = asBuild === "big" ? "big" : which;
  const asked = params.get("details");
  const details: SandboxDetails = (["session", "agent", "file", "tool", "result"] as const).find((kind) => kind === asked) ?? "prompt";
  const [open, setOpen] = useState<string | null>(params.get("open") ? (which === "fox" ? "p1" : "p3") : null);
  const phone = useIsPhone();
  const fine = useFinePointer();
  const team = asBuild === "team" ? sandboxTeamFixture() : asBuild === "manual" ? sandboxManualFixture() : null;
  const list = team?.list ?? sandboxListProps(which);
  const openedId = params.get("opened");
  const opened = team && openedId ? (team.map.steps.flatMap((step) => [step, ...step.children]).find((step) => step.id === openedId) ?? null) : null;
  return (
    <>
      <SandboxView
        fit={fit}
        {...sandboxViewProps(which, state)}
        lens={params.get("lens") === "map" ? "map" : "list"}
        mapAvailable={Boolean(team) || params.get("lens") === "map" || sandboxViewProps(which, state).mapAvailable}
        list={<BuildList {...list} phone={phone} onOpenPrompt={setOpen} />}
        map={<BuildMap {...(team?.map ?? sandboxMapProps(mapOf))} opened={opened} onOpenPrompt={setOpen} />}
        trail={opened ? [{ id: opened.id, title: opened.title ?? opened.defaultTitle }] : []}
        selection={<DetailsPanel {...sandboxDetailsProps(details, which)} phone={phone} onOpenPrompt={setOpen} />}
        sources={<SourcesPanel {...sandboxSourcesProps(which, state)} phone={phone} fine={fine} />}
      />
      <FullPromptWindow steps={list.steps} names={list.names} openId={open} mode="maker" onTitle={() => undefined} onNavigate={setOpen} onClose={() => setOpen(null)} />
    </>
  );
}
