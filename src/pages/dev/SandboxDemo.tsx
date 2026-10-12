/* UI-P63 — /dev/kit/pages/sandbox?theme=noon|dusk&viewport=desktop|mobile.

   `SandboxView` with the sample builds, whatever SANDBOX_COMPOSER_ENABLED says.
   `?build=bakery` draws the second (S3); the default is the fox poster (S1).
   No board image is compared. */

import { useSearchParams } from "react-router-dom";

import { sandboxViewProps, type SandboxFixture } from "@/dev/fixtures/sandbox";
import { SandboxView } from "@/pages/site/compose/SandboxView";

import type { DesignPageProps } from "./KitPages";

export default function SandboxDemo({ fit = "board", state = "populated" }: DesignPageProps) {
  const [params] = useSearchParams();
  const which: SandboxFixture = params.get("build") === "bakery" ? "bakery" : "fox";
  return <SandboxView fit={fit} {...sandboxViewProps(which, state)} />;
}
