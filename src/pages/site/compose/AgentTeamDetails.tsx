/* SV-28: what Details adds for an agent or a team, in its own chunk (the composer's stays within its budget).

   - Hands off to: each rule, "Writer when the draft is complete", with "A person approves first" when it says so (Part 1).
   - Mentions not matched: an "@" name in its instructions (or the team's) that names no agent of the team, or names two (Part 2).
   - Trust boundary: each crossing that starts at this agent, one line each (Part 6). It describes the build; it blocks nothing.
   Plain rows, the window's own section head and type: no new look. */

import { mentionsOf, MENTIONS_COPY } from "@/lib/build/mentions";
import { agentLabel, agentsOfTeam, handoffsOf, HANDOFF_COPY, teamOfAgent, type TeamNode } from "@/lib/build/teamFields";
import { crossingDetail, trustBoundaryOf, TRUST_COPY } from "@/lib/build/trustBoundary";
import type { NodeTree } from "@/lib/build/types";
import { t } from "@/lib/theme/tokens";

import { text } from "./refinedStyles";

const flat = (nodes: readonly TeamNode[]): TeamNode[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);
const str = (value: unknown): string => (typeof value === "string" ? value : "");

function Section({ title, testId, lines }: { title: string; testId: string; lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <section data-testid={testId} aria-label={title} style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.hairline}` }}>
      <h3 style={{ ...text(12, 500, t.label), margin: 0 }}>{title}</h3>
      {lines.map((line, at) => (
        <p key={at} style={{ ...text(13, 400, t.text), lineHeight: "20px", margin: 0, overflowWrap: "anywhere" }}>
          {line}
        </p>
      ))}
    </section>
  );
}

export function AgentTeamDetails({ id, kind, tree }: { id: string; kind: "agent" | "team"; tree: readonly NodeTree[] }) {
  const all = flat(tree as readonly TeamNode[]);
  const self = all.find((node) => node.id === id);
  if (!self) return null;
  const team = kind === "team" ? self : teamOfAgent(tree, id);
  const members = team ? agentsOfTeam(tree, team.id) : [];
  const roster = members.map((member) => ({ id: member.id, role: str((member.payload as Record<string, unknown> | undefined)?.role), title: member.title ?? null }));
  const instructions = str((self.payload as Record<string, unknown> | undefined)?.system_prompt);
  const unmatched = team ? mentionsOf(instructions, roster).unmatched.map((mention) => (mention.ambiguous ? `${mention.text} (${MENTIONS_COPY.ambiguous})` : mention.text)) : [];
  const handoffs = kind === "agent" ? handoffsOf(self.payload).map((rule) => `${agentLabel(members.find((member) => member.id === rule.to))} when ${rule.when}${rule.needs_approval ? ` · ${HANDOFF_COPY.approval}` : ""}`) : [];
  const crossings = kind === "agent" ? trustBoundaryOf({ tree: tree as readonly TeamNode[] }).filter((crossing) => crossing.from === id).map((crossing) => crossingDetail(crossing, tree as readonly TeamNode[])) : [];
  return (
    <>
      <Section title={HANDOFF_COPY.label} testId="details-handoffs" lines={handoffs} />
      <Section title={MENTIONS_COPY.notMatched} testId="details-mentions" lines={unmatched} />
      <Section title={TRUST_COPY.head} testId="details-trust" lines={crossings} />
    </>
  );
}

export default AgentTeamDetails;
