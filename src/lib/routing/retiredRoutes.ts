// UX-08 P5: the Solvers board is retired. The site-wide ranking of people by answers is gone; standing per space (UX-07's profile) is
// what replaces it. These three addresses land on OpenBuilds, keeping the search and the hash (`KeepSearchRedirect`). The page file
// and its data functions stay for SV-26 to review on their own.

export const SOLVERS_ADDRESSES = ["/openbuilds/solvers", "/bounties/solvers", "/b/:id/leaderboard"] as const;

export const SOLVERS_LANDING = "/openbuilds";
