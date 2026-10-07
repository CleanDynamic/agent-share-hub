/* UI-P48 — More details, as the page runs them.

   READ ONCE PER BUILD, then what is typed leads, as with the title: the two
   breakage fields and the gap's problem are written 800ms after the last
   keystroke through the node queue; the three numbers go through the page's
   `edit`, so they share the header's debounced save (and make the draft on
   /compose/new).

   THE SWITCH. On, the gap is written once its problem has words. Off, the gap
   is deleted, and what was typed is kept here, so switching back on puts the
   same part back. */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { SAVE_DEBOUNCE_MS } from "@/hooks/useComposeBuild";
import type { Build, BuildPatch } from "@/lib/build";
import { breakageFields, composerBreakage, composerGap, gapProblemText, saveBreakage, saveGap } from "@/lib/build/composeDetails";

import { parseAmount } from "./composeModel";
import type { ComposeDetailKey, ComposeDetails } from "./MoreDetails";
import { rowOf, type ComposeNodes } from "./useComposeNodes";

const EMPTY: ComposeDetails = { symptom: "", resolution: "", costMonthly: "", costSetup: "", firstResult: "", gapOn: false, gapProblem: "" };

const amount = (value: number | null | undefined) => (typeof value === "number" ? String(value) : "");

const failed = (line: string) => (cause: unknown) => {
  console.error("[Compose] details write failed", cause);
  toast.error(line);
};

export interface ComposeDetailsState {
  details: ComposeDetails;
  setDetail: (key: ComposeDetailKey, value: string) => void;
  setGapOn: (on: boolean) => void;
  /** Write every pending edit now; resolves once the queue is empty. */
  flush: () => Promise<void>;
}

export function useComposeDetails({
  build,
  hydrate,
  nodes,
  ensureBuild,
  edit,
}: {
  build: Build | null;
  /** False for a build this page made: there is nothing to read back, and the fields may already hold typing. */
  hydrate: boolean;
  nodes: ComposeNodes;
  ensureBuild: () => Promise<string>;
  /** The page's header edit: patches the build, or holds the patch and makes the draft. */
  edit: (patch: BuildPatch) => void;
}): ComposeDetailsState {
  const [details, setDetails] = useState<ComposeDetails>(EMPTY);
  const detailsRef = useRef(details);
  const timers = useRef(new Map<"breakage" | "gap", number>());
  const latest = useRef({ ensureBuild, build });
  latest.current = { ensureBuild, build };

  const update = (patch: Partial<ComposeDetails>) => {
    detailsRef.current = { ...detailsRef.current, ...patch };
    setDetails(detailsRef.current);
  };

  /* Read once per build. A build made here has nothing to read back. */
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!build || hydratedFor.current === build.id) return;
    if (hydratedFor.current !== null) {
      // Another build: what was waiting to be written belonged to the last one.
      for (const timer of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
    }
    hydratedFor.current = build.id;
    if (!hydrate) return;
    const breakage = composerBreakage(nodes.tree);
    const gap = composerGap(nodes.tree);
    const next: ComposeDetails = {
      ...breakageFields(breakage),
      costMonthly: amount(build.cost_monthly),
      costSetup: amount(build.cost_setup),
      firstResult: amount(build.time_to_first_result),
      gapOn: gap !== null,
      gapProblem: gapProblemText(gap),
    };
    detailsRef.current = next;
    setDetails(next);
  }, [build, hydrate, nodes.tree]);

  const { run, current: currentTree, record } = nodes;

  const writeBreakage = useCallback(
    () =>
      run(async () => {
        const { symptom, resolution } = detailsRef.current;
        const found = composerBreakage(currentTree());
        if (!found && !symptom.trim()) return;
        const current = found ? rowOf(found) : null;
        if (current && breakageFields(current).symptom === symptom && breakageFields(current).resolution === resolution) return;
        const buildId = await latest.current.ensureBuild();
        const node = await saveBreakage({ buildId, tree: currentTree(), current, symptom, resolution });
        if (node) record(node.id, node);
        else if (current) record(current.id, null);
      }),
    [run, currentTree, record],
  );

  const writeGap = useCallback(
    () =>
      run(async () => {
        const { gapOn, gapProblem } = detailsRef.current;
        const problem = gapOn ? gapProblem : "";
        const found = composerGap(currentTree());
        if (!found && !problem.trim()) return;
        const current = found ? rowOf(found) : null;
        if (current && gapProblemText(current) === problem) return;
        const buildId = await latest.current.ensureBuild();
        const node = await saveGap({ buildId, tree: currentTree(), current, problem });
        if (node) record(node.id, node);
        else if (current) record(current.id, null);
      }),
    [run, currentTree, record],
  );

  const writers = { breakage: writeBreakage, gap: writeGap } as const;
  const lines = { breakage: "Couldn't save where it broke. Try again.", gap: "Couldn't save the part left open. Try again." } as const;

  const schedule = (which: "breakage" | "gap", wait = SAVE_DEBOUNCE_MS) => {
    const timer = timers.current.get(which);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.set(
      which,
      window.setTimeout(() => {
        timers.current.delete(which);
        writers[which]().catch(failed(lines[which]));
      }, wait),
    );
  };

  const flush = () => {
    for (const [which, timer] of [...timers.current]) {
      window.clearTimeout(timer);
      timers.current.delete(which);
      writers[which]().catch(failed(lines[which]));
    }
    return nodes.settled();
  };

  /* Leaving mid-pause writes what was typed, in a build that exists. */
  const writersRef = useRef(writers);
  writersRef.current = writers;
  useEffect(
    () => () => {
      if (!latest.current.build) return;
      for (const [which, timer] of timers.current) {
        window.clearTimeout(timer);
        writersRef.current[which]().catch(() => undefined);
      }
      timers.current.clear();
    },
    [],
  );

  const setDetail = (key: ComposeDetailKey, value: string) => {
    update({ [key]: value });
    switch (key) {
      case "symptom":
      case "resolution":
        schedule("breakage");
        return;
      case "gapProblem":
        schedule("gap");
        return;
      case "costMonthly":
      case "costSetup":
      case "firstResult": {
        const parsed = parseAmount(value, { whole: key === "firstResult" });
        if (parsed === undefined) return;
        const column = key === "costMonthly" ? "cost_monthly" : key === "costSetup" ? "cost_setup" : "time_to_first_result";
        edit({ [column]: parsed });
        return;
      }
    }
  };

  const setGapOn = (on: boolean) => {
    update({ gapOn: on });
    schedule("gap", 0);
  };

  return { details, setDetail, setGapOn, flush };
}
