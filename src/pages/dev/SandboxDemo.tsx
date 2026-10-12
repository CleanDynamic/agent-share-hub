/* UI-P63 — /dev/kit/pages/sandbox?theme=noon|dusk&viewport=desktop|mobile.

   `SandboxView` with the sample builds, whatever SANDBOX_COMPOSER_ENABLED says.
   UI-P64 fills its Sources panel from the same fixture.
   `?build=bakery` draws the second (S3); the default is the fox poster (S1).
   No board image is compared. */

import { useSearchParams } from "react-router-dom";

import { sandboxViewProps, sourcesPanelProps, type SandboxFixture } from "@/dev/fixtures/sandbox";
import { SandboxView } from "@/pages/site/compose/SandboxView";
import { SourcesPanel } from "@/pages/site/compose/SourcesPanel";

import type { DesignPageProps } from "./KitPages";

export default function SandboxDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const which: SandboxFixture = params.get("build") === "bakery" ? "bakery" : "fox";
  const sources = sourcesPanelProps(which, state);
  return (
    <SandboxView
      fit={fit}
      {...sandboxViewProps(which, state)}
      sources={<SourcesPanel {...sources} />}
      addSession={{ rows: sources.library, onAttach: () => undefined }}
      onAddFile={() => undefined}
    />
  );
}
