// referenceGroupsWrite: saving reference groups (CA-19 P1).
//
// Groups live in `builds.making.reference_groups`, in the maker's order, and the order of single colours in
// `builds.making.single_colour_order`: no migration. Written through `patchMaking`, which reads `making` fresh and keeps
// every other key as it is.

import { buildLayerError } from "./types";
import { patchMaking } from "./making";
import { referenceGroupsRefusal, type ReferenceGroup } from "./referenceGroups";

/** Save the build's groups (all of them, in order) and, when given, the order of its single colours. Refused when they do not read. */
export async function setReferenceGroups(buildId: string, groups: readonly ReferenceGroup[], order?: readonly string[]): Promise<Record<string, unknown>> {
  const why = referenceGroupsRefusal(groups);
  if (why) throw buildLayerError("setReferenceGroups", new Error(why));
  return patchMaking(buildId, {
    reference_groups: groups.map((group) => ({ ...group, members: [...group.members] })),
    ...(order ? { single_colour_order: [...order] } : null),
  });
}
