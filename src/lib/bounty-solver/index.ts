// The LEGACY bounty data layer: a bounty that is twelve columns on a
// content_items row, whose slots are positions in a stage_grids blob.
//
// NEW CODE BELONGS IN src/lib/bounty/, which is the same tables read the way
// the record model means them — a bounty is a gap node in a build, a solution
// is a payload for that node's type, and accepting one substitutes the answer
// into the build. That module also owns the seam between the two:
// resolveBountyByLegacyItem turns a content_items id from a legacy route into
// the public.bounties id every table here has keyed on since NS-P46, which is
// what each function below now calls.
//
// Nothing here is deprecated. The legacy bounty page is live, it is reachable,
// and this is what serves it until content_items is retired.
export * from "./types";
export { createSolutionDraft } from "./createSolutionDraft";
export { updateSolutionDraft } from "./updateSolutionDraft";
export { deleteSolutionDraft } from "./deleteSolutionDraft";
export { submitSolution } from "./submitSolution";
export { getSolutions } from "./getSolutions";
export { voteOnSolution } from "./voteOnSolution";
export { acceptSolution } from "./acceptSolution";
export { forkSolution } from "./forkSolution";
export { getDiscussionThread } from "./getDiscussionThread";
export { postDiscussionComment } from "./postDiscussionComment";
export { reactToComment } from "./reactToComment";
export { markBountyDiscussionRead } from "./markBountyDiscussionRead";
export { getProvenance } from "./getProvenance";
export {
  useBountyDiscussionUpdates,
  useBountySolutionUpdates,
} from "./realtime";
