// src/lib/bounty — a bounty is a gap in a build (NS-P50).
//
// WHAT THIS MODULE IS. public.bounties has been the header table since NS-P45
// and every satellite has pointed at it since NS-P48, but nothing wrote the
// forward path: a bounty could only be created as twelve columns on a
// content_items row, and a solution could only be a fragment of a stage_grids
// blob. This module is the forward path. A bounty here is filed against a gap
// node in a build, a solution is a payload for that node's type, and accepting
// one substitutes the answer into the build and writes the solve into its
// sequence.
//
// WHAT IS STILL SOMEWHERE ELSE, AND WHY.
//
//   * src/lib/bounty-solver/ is the LEGACY path — the content_items bounty
//     page, its stage and block slots, its stage_grids merge on acceptance. It
//     still works, unchanged in behaviour, and reads the same bounties table
//     through resolveBountyByLegacyItem. It is not deprecated here; it is the
//     other half, and it stops mattering when content_items does.
//
//   * voteOnSolution, getSolutionComments and postSolutionComment are
//     RE-EXPORTED from it rather than rewritten. All three address a solution
//     by its own id and never touch a bounty id, so the repoint never reached
//     them and a second copy here would be a second copy of working code.
//
//   * validateBountyForPublish and countMissingInStageGrids are the legacy
//     publish validators. They read content_items and are exported here because
//     they have always lived in this folder, not because they are part of the
//     new path.

export {
  bountyLayerError,
  type Bounty,
  type BountyCounts,
  type BountyInsert,
  type BountyPatch,
  type BountyRecord,
  type BountyStatus,
  type DeadlineExtension,
  type GapNode,
  type SlotKind,
} from "./types";

export {
  BOUNTY_COLUMNS,
  OPEN_BOUNTIES_PAGE_SIZE,
  closeBounty,
  createBountyForGap,
  extendDeadline,
  getBounty,
  listBountiesForBuild,
  listBuildBounties,
  listOpenBounties,
  type BuildBounty,
  type CreateBountyForGapInput,
  type ExtendDeadlineInput,
  type ListBuildBountiesOptions,
  type ListOpenBountiesOptions,
  type OpenBountiesPage,
} from "./bounties";

export {
  SOLUTION_COLUMNS,
  acceptSolution,
  countSolutionsByBounty,
  listSolutions,
  listSolverHandles,
  submitSolution,
  type AcceptedSolution,
  type BountySolution,
  type ListSolutionsOptions,
  type SolutionSolver,
  type SubmitSolutionInput,
  type SubmittedSolution,
} from "./solutions";

// The reader's one-click answer to an open ask. Its table is NS-P52's and is
// keyed at bounties; the generation-1 bounty_me_too is neither read nor
// written here — see the header of meToo.ts.
export { myMeToo, toggleMeToo } from "./meToo";

export {
  checkNodeField,
  checkNodePayload,
  payloadRejectionMessage,
  type PayloadCheck,
  type PayloadRejection,
} from "./payload";

export {
  clearBountyResolutionCache,
  legacyItemForBounty,
  resolveBountiesByLegacyItems,
  resolveBountyByLegacyItem,
  resolveLegacyItemsByBounty,
} from "./resolveLegacy";

// Solution-wise, and already correct: neither votes nor solution comments ever
// held a bounty id, so NS-P46 did not move them and NS-P50 does not rewrite
// them. They are surfaced here so a consumer of the new path does not have to
// import half its data layer from the legacy folder.
export { voteOnSolution } from "@/lib/bounty-solver/voteOnSolution";
export {
  getSolutionComments,
  postSolutionComment,
  type SolutionComment,
} from "@/lib/bounty-solver/solutionComments";

export { validateBountyForPublish, type BountyValidationResult } from "./validateBountyForPublish";
export { countMissingInStageGrids, type MissingCounts } from "./countMissing";
