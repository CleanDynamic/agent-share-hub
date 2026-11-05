// UX-08 P1: after the build is live, the still-open marks become topics. This never throws and never touches the build: a failure is
// a toast, and pressing Publish changes again sends only the marks that did not go (a mark already posted is not posted again).

import { toast } from "sonner";

import type { NodeTree } from "@/lib/build/types";
import { reportError } from "@/lib/errors/report";
import { startStillOpenTopics, stillOpenMarksOf } from "@/lib/openbuilds/stillOpen";

import { STILL_OPEN_FAILED } from "./openRequestCopy";

export { STILL_OPEN_FAILED };

export async function sendStillOpenTopics({ buildId, making, tree, spaceIds }: { buildId: string; making: unknown; tree: readonly NodeTree[]; spaceIds: readonly string[] }): Promise<void> {
  const marks = stillOpenMarksOf(making, tree);
  if (marks.length === 0) return;
  try {
    await startStillOpenTopics({ buildId, marks, spaceIds });
  } catch (error) {
    reportError(error, { source: "compose", context: "startStillOpenTopics" });
    toast.error(STILL_OPEN_FAILED);
  }
}
