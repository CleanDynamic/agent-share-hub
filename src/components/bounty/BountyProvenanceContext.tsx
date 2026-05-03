import * as React from "react";
import type { ProvenanceEntry } from "@/lib/bounty-solver/getProvenance";
import type { SolverProfile } from "@/lib/bounty-solver/types";

export interface BountyProvenanceContextValue {
  bountySlug: string;
  bountyId: string;
  bountyStatus: "open" | "closed" | "solved";
  // Counts of submitted solutions per slot id
  slotSolutionCounts: Record<string, number>;
  // Accepted solver per slot id (latest acceptance)
  slotAcceptance: Record<
    string,
    { solver: SolverProfile | null; acceptedAt: string; slotKind: "stage" | "block"; solutionId?: string }
  >;
  bountyAuthor: SolverProfile | null;
  acceptedSolvers: ProvenanceEntry[];
  onViewOriginalSolution?: (slotId: string) => void;
}

const Ctx = React.createContext<BountyProvenanceContextValue | null>(null);

export function BountyProvenanceProvider({
  value,
  children,
}: {
  value: BountyProvenanceContextValue;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBountyProvenance(): BountyProvenanceContextValue | null {
  return React.useContext(Ctx);
}
