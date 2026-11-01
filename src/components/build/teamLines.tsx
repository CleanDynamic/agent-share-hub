/* SV-28: the lines a team, an agent, a job and an Approval step add to their tiles, drawn the same in the composer's List and on
   the build page. Plain values (visual grammar 6): text in `--text2` and `--label`, the step numbers and mentions as links.

   - TeamHead: "Team instructions" (unnumbered) with linked mentions, the workspace line, and "Example run · n steps", which opens
     a vertical timeline headed "Entered by the maker, not recorded from a run."
   - AgentRules: "Output rules", one per line, and "Follows", each guidance a link to its https address.
   - JobLine: "Delivers a draft · Weekly pipeline email → Gmail · Approved first", the arrow a text character in `--label`.
   - GateLine: "The maker approves the client email draft before steps 5, 6", each number a button that opens that step.
   - WaitsLine: "Waits for approval (step 4)".
   - MentionText: instruction text with each resolved mention drawn as the post's linked words; it opens the agent.

   Opening a step goes through `TeamLinesContext.open` (the List selects the tile; the build page scrolls to it). No motion. */

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";

import type { Step } from "@/lib/build/graph";
import { mentionRuns, mentionsOf, MENTIONS_COPY, type MentionAgent } from "@/lib/build/mentions";
import { EXAMPLE_COPY, RULES_COPY, TEAM_INSTRUCTIONS_COPY, beforeSteps, gateLead, jobParts, workspaceLine, type Gate, type Job } from "@/lib/build/teamFields";
import { t } from "@/lib/theme/tokens";
import { toolName } from "@/lib/tools/registry";
import { TextButton } from "@/pages/site/compose/composeControls";
import { text } from "@/pages/site/compose/refinedStyles";

export interface TeamLinesValue {
  /** Open a step or an agent by its id. Absent: numbers and mentions are plain words. */
  open?: (id: string) => void;
  /** A tool's name from its integration node id (the List's names); a tool id or typed text falls back to the registry, then as typed. */
  names?: Readonly<Record<string, string>>;
  phone?: boolean;
  /** The build's steps, for an Approval step's numbers. */
  steps?: readonly Pick<Step, "id" | "number">[];
}

export const TeamLinesContext = createContext<TeamLinesValue>({});

const LINE: CSSProperties = { ...text(12, 400, t.text2), lineHeight: "18px", margin: 0, overflowWrap: "anywhere" };
const HEAD: CSSProperties = { ...text(11.5, 500, t.label), lineHeight: "16px" };
const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

/** The agents of a step's team as mentions resolve them: role, then title. */
export const mentionTeam = (agents: readonly Step[]): MentionAgent[] => agents.map((agent) => ({ id: agent.id, role: agent.role ?? null, title: agent.title }));

/** A mention, drawn as the post's linked words (a fill, radius 4), a button that opens the agent. */
function MentionLink({ id, children }: { id: string; children: ReactNode }) {
  const { open, phone } = useContext(TeamLinesContext);
  const [hover, setHover] = useState(false);
  const look: CSSProperties = { background: hover ? t.tagFill : t.rowHighlight, borderRadius: 4, padding: "1px 4px", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", color: "inherit" };
  if (!open) return <span data-testid="mention" style={look}>{children}</span>;
  return (
    <TextButton target={phone} aria-label={MENTIONS_COPY.open(String(children))} onClick={(event) => (stop(event), open(id))} style={{ ...look, font: "inherit" }}>
      <span data-testid="mention" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>{children}</span>
    </TextButton>
  );
}

/** Text with its resolved mentions linked; unresolved ones stay plain (Details lists them). */
export function MentionText({ value, team, style, testId }: { value: string; team: readonly MentionAgent[]; style?: CSSProperties; testId?: string }) {
  const runs = mentionRuns(value, mentionsOf(value, team).mentions);
  return (
    <p data-testid={testId} style={{ ...LINE, ...text(13, 400, t.text), lineHeight: "21px", whiteSpace: "pre-wrap", ...style }}>
      {runs.map((run, at) => (run.id ? <MentionLink key={at} id={run.id}>{run.text}</MentionLink> : <span key={at}>{run.text}</span>))}
    </p>
  );
}

/** A team's head: its instructions, how its agents share work, and its example run. Nothing when it says none. */
export function TeamHead({ team, style }: { team: Step; style?: CSSProperties }) {
  const [open, setOpen] = useState(false);
  const { phone } = useContext(TeamLinesContext);
  const agents = team.children.filter((child) => child.kind === "agent");
  const nameOf = (id: string) => {
    const agent = agents.find((entry) => entry.id === id);
    return agent ? agent.role || agent.title || agent.defaultTitle : "Agent";
  };
  const run = team.exampleRun ?? [];
  if (!team.teamInstructions && !team.workspace && run.length === 0) return null;
  return (
    <div data-testid="team-head" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      {team.teamInstructions ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={HEAD}>{TEAM_INSTRUCTIONS_COPY.label}</span>
          <MentionText value={team.teamInstructions} team={mentionTeam(agents)} testId="team-instructions" />
        </div>
      ) : null}
      {team.workspace ? <p data-testid="team-workspace" style={LINE}>{workspaceLine(team.workspace, nameOf)}</p> : null}
      {run.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>
            <TextButton target={phone} aria-expanded={open} onClick={(event) => (stop(event), setOpen(!open))} style={text(12, 500, t.text2)}>
              {EXAMPLE_COPY.head(run.length)}
            </TextButton>
          </span>
          {open ? (
            <div data-testid="example-run" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ ...LINE, color: t.label }}>{EXAMPLE_COPY.note}</span>
              <ol style={{ margin: 0, padding: 0, listStyle: "none", borderLeft: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 12 }}>
                {run.map((entry, at) => (
                  <li key={at} style={{ paddingLeft: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={text(12.5, 500, t.text)}>{nameOf(entry.agent)}</span>
                    <span style={LINE}>{entry.did}</span>
                    {entry.passed_on ? <span style={{ ...LINE, color: t.label }}>{EXAMPLE_COPY.passed(entry.passed_on)}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** An agent's output rules and the published guidance it follows. */
export function AgentRules({ agent, style }: { agent: Pick<Step, "outputRules" | "rulesFollowed">; style?: CSSProperties }) {
  const rules = agent.outputRules ?? [];
  const follows = agent.rulesFollowed ?? [];
  if (rules.length === 0 && follows.length === 0) return null;
  return (
    <div data-testid="agent-rules" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0, ...style }}>
      {rules.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={HEAD}>{RULES_COPY.output}</span>
          {rules.map((rule, at) => (
            <p key={at} style={LINE}>{rule}</p>
          ))}
        </div>
      ) : null}
      {follows.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={HEAD}>{RULES_COPY.follows}</span>
          {follows.map((rule) => (
            <a key={rule.url} href={rule.url} target="_blank" rel="noreferrer noopener" onClick={stop} style={{ ...LINE, color: t.text, textDecoration: "underline", textUnderlineOffset: 2 }}>
              {rule.text}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "Delivers a draft · Weekly pipeline email → Gmail · Approved first". */
export function JobLine({ job, style }: { job: Job; style?: CSSProperties }) {
  const { names } = useContext(TeamLinesContext);
  const parts = jobParts(job, (destination) => names?.[destination] ?? toolName(destination) ?? destination);
  const what = [parts.delivers, parts.name].filter(Boolean).join(" · ");
  if (!what && !parts.destination && !parts.approved) return null;
  return (
    <p data-testid="job-line" style={{ ...LINE, ...style }}>
      {what}
      {parts.destination ? (
        <>
          {what ? " " : null}
          <span style={{ color: t.label }}>→</span> {parts.destination}
        </>
      ) : null}
      {parts.approved ? ` · ${parts.approved}` : null}
    </p>
  );
}

/** A step number that opens its step, or the number as words without a way to open. */
function StepNumber({ id, number }: { id: string; number: string }) {
  const { open, phone } = useContext(TeamLinesContext);
  if (!open) return <span>{number}</span>;
  return (
    <TextButton target={phone} underline aria-label={`Open step ${number}`} onClick={(event) => (stop(event), open(id))} style={text(12, 500, t.text2)}>
      {number}
    </TextButton>
  );
}

/** "The maker approves the client email draft before steps 5, 6". */
export function GateLine({ gate, steps, reviewerName, style }: { gate: Gate; steps?: readonly Pick<Step, "id" | "number">[]; reviewerName?: string; style?: CSSProperties }) {
  const context = useContext(TeamLinesContext);
  const all = steps ?? context.steps ?? [];
  const blocked = gate.blocks.flatMap((id) => {
    const step = all.find((entry) => entry.id === id);
    return step ? [step] : [];
  });
  return (
    <p data-testid="gate-line" style={{ ...LINE, ...style }}>
      {gateLead(gate, reviewerName)}
      {blocked.length > 0 ? ` ${beforeSteps(blocked.length)} ` : null}
      {blocked.map((step, at) => (
        <span key={step.id}>
          {at > 0 ? ", " : null}
          <StepNumber id={step.id} number={step.number} />
        </span>
      ))}
    </p>
  );
}

/** "Waits for approval (step 4)". */
export function WaitsLine({ waitsFor, style }: { waitsFor: NonNullable<Step["waitsFor"]>; style?: CSSProperties }) {
  return (
    <p data-testid="waits-line" style={{ ...LINE, ...style }}>
      Waits for approval (step <StepNumber id={waitsFor.id} number={waitsFor.number} />)
    </p>
  );
}
