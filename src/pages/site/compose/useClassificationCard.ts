/* CA-16 P5: the Classification Card's data: what is stored, what the tiles say, and the two writes.

   THE DERIVED VALUES ARE NEVER STALE. They are worked out from the tiles on every render, and while the composer is
   open they are written back (with the matching `facets`) a moment after they change, so the Gallery and the build
   page read what the composer reads. A build with nothing placed yet writes nothing. The maker's own choices (declared,
   disputes, dismissed questions) are written only by Save, and Save writes the latest derived values with them.

   THE COLUMNS MAY NOT EXIST YET (the CA-16 migration is applied later). `getClassification` says so, the write is
   remembered as impossible, the Card shows its one line and everything else on it saves as before. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { composeBuildQueryKey } from "@/hooks/composeBuildQueryKey";
import { buildSteps, type Step } from "@/lib/build/graph";
import type { Making } from "@/lib/build/making";
import type { Build, NodeTree } from "@/lib/build/types";
import { deriveClassification } from "@/lib/classify/derive";
import { trackWrite } from "@/lib/build/pendingWrites";
import { computeFacets, emptyClassification, shapeFromBuilt, shownValues } from "@/lib/classify/facets";
import { getClassification, writeClassification, type StoredClassification } from "@/lib/classify/storage";
import { TAXONOMY_VERSION } from "@/lib/classify/taxonomy";

import { applyDraft, type ClassificationCardData, type ClassificationDraft, type ClassificationSaved } from "./classificationCardModel";

/** How long the composer waits after the tiles stop changing before it writes the derived values. */
export const DERIVED_WRITE_MS = 1500;

export const classificationKey = (buildId: string | undefined) => ["build", "getClassification", buildId] as const;

const flatten = (steps: readonly Step[]): Step[] => steps.flatMap((step) => [step, ...flatten(step.children), ...flatten(step.sentWith ?? [])]);

export interface UseClassificationCardInput {
  buildId: string | undefined;
  build: Build | null;
  tree: readonly NodeTree[];
  title: string;
  description: string;
  owner: boolean;
  /** Makes the draft when there is none yet, and says its id. */
  ensureBuild: () => Promise<string>;
}

export function useClassificationCard({ buildId, build, tree, title, description, owner, ensureBuild }: UseClassificationCardInput): Omit<ClassificationCardData, "onSelectSource" | "onAction"> {
  const queryClient = useQueryClient();
  const [missing, setMissing] = useState(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const stored = useQuery<StoredClassification>({
    queryKey: classificationKey(buildId),
    queryFn: () => getClassification(buildId as string),
    enabled: Boolean(buildId) && owner,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const steps = useMemo(() => buildSteps(tree), [tree]);
  const derivation = useMemo(
    () =>
      deriveClassification(steps, {
        tree,
        making: (build?.making ?? null) as Partial<Making> | null,
        title,
        outcome: description,
        repo_url: build?.repo_url ?? null,
        live_url: build?.live_url ?? null,
        cost_monthly: build?.cost_monthly ?? null,
        cost_setup: build?.cost_setup ?? null,
      }),
    [steps, tree, build?.making, build?.repo_url, build?.live_url, build?.cost_monthly, build?.cost_setup, title, description],
  );

  const texts = useMemo(
    () =>
      flatten(steps)
        .filter((step) => step.kind === "prompt")
        .slice(0, 20)
        .map((step) => step.text),
    [steps],
  );

  const live = (stored.data?.live ?? true) && !missing;
  const storedClassification = stored.data?.classification ?? emptyClassification();

  /* The derived values follow the tiles: written once they differ from what is stored, never before the columns are known. */
  const derivedJson = JSON.stringify(derivation.derived);
  const storedDerivedJson = JSON.stringify(storedClassification.derived);
  useEffect(() => {
    if (!buildId || !owner || !stored.data?.live || tree.length === 0 || derivedJson === storedDerivedJson) return;
    const timer = window.setTimeout(() => {
      chain.current = chain.current.then(async () => {
        const base = queryClient.getQueryData<StoredClassification>(classificationKey(buildId))?.classification ?? emptyClassification();
        const next = { ...base, version: TAXONOMY_VERSION, derived: derivation.derived };
        try {
          const result = await writeClassification(buildId, next);
          if (result.written) queryClient.setQueryData<StoredClassification>(classificationKey(buildId), { live: true, classification: next, facets: computeFacets(next) });
        } catch (cause) {
          // eslint-disable-next-line no-console -- a deliberate, structured log that its tests assert (SV-26)
          console.warn("[classification] derived values not written", { code: (cause as { code?: string })?.code });
        }
      });
    }, DERIVED_WRITE_MS);
    return () => window.clearTimeout(timer);
  }, [buildId, owner, stored.data?.live, tree.length, derivedJson, storedDerivedJson, derivation.derived, queryClient]);

  const onSave = useCallback(
    (draft: ClassificationDraft): Promise<ClassificationSaved> => {
      const run = trackWrite("card", async (): Promise<ClassificationSaved> => {
        const id = await ensureBuild();
        const base = queryClient.getQueryData<StoredClassification>(classificationKey(id))?.classification ?? storedClassification;
        const merged = applyDraft(base, derivation.derived, draft);
        const result = await writeClassification(id, merged, { shape: shapeFromBuilt(shownValues(merged, "built").values) });
        if (result.written) queryClient.setQueryData<StoredClassification>(classificationKey(id), { live: true, classification: merged, facets: computeFacets(merged) });
        else if (result.missing) setMissing(true);
        await queryClient.invalidateQueries({ queryKey: composeBuildQueryKey(id) });
        return result;
      }, { after: chain.current });
      chain.current = run.catch(() => undefined);
      return run;
    },
    [ensureBuild, queryClient, storedClassification, derivation.derived],
  );

  return { live, stored: storedClassification, derived: derivation.derived, questions: derivation.questions, texts, onSave };
}
