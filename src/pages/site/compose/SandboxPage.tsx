/* UI-P63 — /compose in the new composer: the container.

   It makes no write of its own. `useComposePage` (beside `ComposePage`) holds
   every field, the first-change-makes-the-draft rule, the debounced save, the
   cover and Publish, and this file hands the same values to `SandboxView`, so
   the Card writes exactly what the old composer did.

   What it adds is what the frame shows: the counts in the Build panel's head,
   whether Map is available yet (CONCEPT §5: two sessions or an agent), and
   which view is chosen. Everything here is read from the build already
   loaded; the steps are `buildSteps(tree)`.

   Mounted by `ComposeRoute` only while SANDBOX_COMPOSER_ENABLED is on. */

import { useCallback, useMemo, useState } from "react";

import { SeoHead } from "@/components/SeoHead";
import { buildSteps, FILE_TYPE, sessionGroups, type Step } from "@/lib/build/graph";
import type { MakingSession } from "@/lib/build/making";

import { PUBLISH_WORDS } from "./composeModel";
import { useComposePage } from "./ComposePage";
import { SandboxView, type SandboxCounts, type SandboxLens } from "./SandboxView";

/** builds.making.sessions, read defensively: it is a json column. */
function makingSessions(making: unknown): MakingSession[] {
  const list = (making as { sessions?: unknown } | null)?.sessions;
  return Array.isArray(list) ? (list as MakingSession[]) : [];
}

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children)]);

export function SandboxPage() {
  const { viewProps, missing, build, tree } = useComposePage();

  const [lens, setLens] = useState<SandboxLens>("list");
  const [switched, setSwitched] = useState(false);
  const onLens = useCallback((next: SandboxLens) => {
    setLens(next);
    setSwitched(true);
  }, []);

  const made = (build as { making?: unknown } | null)?.making;
  const { counts, hasAgent, sessionCount } = useMemo(() => {
    const steps = buildSteps(tree);
    const groups = sessionGroups(steps, makingSessions(made));
    const all = flatten(steps);
    const next: SandboxCounts = {
      sessions: groups.length,
      prompts: all.filter((step) => step.kind === "prompt").length,
      files: tree.filter((node) => node.type === FILE_TYPE).length,
    };
    return { counts: next, hasAgent: all.some((step) => step.kind === "agent" || step.kind === "team"), sessionCount: groups.length };
  }, [tree, made]);

  const mapAvailable = sessionCount >= 2 || hasAgent;

  return (
    <>
      <SeoHead title="Compose — buildgallery" description="Write your build." path="/compose" noIndex />
      <SandboxView
        {...viewProps}
        missing={missing.map((key) => ({ key, label: PUBLISH_WORDS[key] }))}
        counts={counts}
        lens={lens}
        onLens={onLens}
        mapAvailable={mapAvailable}
        mapHint={mapAvailable && !switched}
      />
    </>
  );
}

export default SandboxPage;
