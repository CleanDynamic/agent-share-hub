/* UI-P63 — /dev/kit/pages/sandbox?theme=noon|dusk&viewport=desktop|mobile.

   `SandboxView` with the sample builds, whatever SANDBOX_COMPOSER_ENABLED says.
   `?build=bakery` draws the second (S3); the default is the fox poster (S1).
   `?details=prompt|session|agent|file|tool|result` picks what Details shows (UI-P66).
   No board image is compared. */

import { useSearchParams } from "react-router-dom";

import { sandboxDetailsProps, sandboxListProps, sandboxSourcesProps, sandboxViewProps, type SandboxDetails, type SandboxFixture } from "@/dev/fixtures/sandbox";
import { useFinePointer, useIsPhone } from "@/components/shell/useMinWidth";
import { BuildList } from "@/pages/site/compose/BuildList";
import { DetailsPanel } from "@/pages/site/compose/DetailsPanel";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import type { DesignPageProps } from "./KitPages";

export default function SandboxDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const which: SandboxFixture = params.get("build") === "bakery" ? "bakery" : "fox";
  const asked = params.get("details");
  const details: SandboxDetails = (["session", "agent", "file", "tool", "result"] as const).find((kind) => kind === asked) ?? "prompt";
  const phone = useIsPhone();
  const fine = useFinePointer();
  return <SandboxView fit={fit} {...sandboxViewProps(which, state)} list={<BuildList {...sandboxListProps(which)} phone={phone} />} selection={<DetailsPanel {...sandboxDetailsProps(details, which)} phone={phone} />} sources={<SourcesPanel {...sandboxSourcesProps(which, state)} phone={phone} fine={fine} />} />;
}
