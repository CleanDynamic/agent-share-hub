/* SV-28 P5: a team's shared workspace and its example run, in the team's window after its own fields. Built from the window's
   existing quiet controls (Field, PickMenu, typed fields, text buttons): no new look.

   - Shared workspace: how the agents share files (each in its own git worktree, one shared folder, or separate places), and,
     only when work is shared, how it is merged and by whom (an agent of the team, or the maker).
   - Example run: an ordered list of 2 to 12 entries, each an agent, what it did and what it passed on. Each entry moves up or down
     with a button (the keyboard's way). It is written only once it has 2 complete entries; until then the window says why.
   Every write goes through `onExtras` (the existing extras writer), held by the window until Save. */

import { useState } from "react";

import {
  EXAMPLE_COPY,
  EXAMPLE_DID_MAX,
  EXAMPLE_PASSED_MAX,
  EXAMPLE_RUN_MAX,
  EXAMPLE_RUN_MIN,
  MAKER,
  MERGE_LABEL,
  MERGES,
  WORKSPACE_COPY,
  WORKSPACE_KINDS,
  WORKSPACE_LABEL,
  agentLabel,
  agentsOfTeam,
  exampleRunOf,
  takesMerge,
  workspaceOf,
  type ExampleEntry,
  type Merge,
  type Workspace,
  type WorkspaceKind,
} from "@/lib/build/teamFields";
import type { NodeTree } from "@/lib/build/types";
import { t } from "@/lib/theme/tokens";

import { Field, TextButton } from "./composeControls";
import { PickMenu } from "./PickMenu";
import { typedField } from "./refinedStyles";

const NOT_SAID = "none";

export function TeamWorkFields({ id, tree, phone, onExtras }: { id: string; tree: readonly NodeTree[]; phone: boolean; onExtras?: (id: string, patch: Record<string, unknown>) => void }) {
  const flat = (nodes: readonly NodeTree[]): NodeTree[] => nodes.flatMap((node) => [node, ...flat(node.children ?? [])]);
  const payload = flat(tree).find((node) => node.id === id)?.payload;
  const agents = agentsOfTeam(tree, id).map((agent) => ({ id: agent.id, label: agentLabel(agent) }));
  const [workspace, setWorkspace] = useState<Workspace | null>(workspaceOf(payload));
  const [entries, setEntries] = useState<ExampleEntry[]>(() => {
    const saved = exampleRunOf(payload);
    return saved.length > 0 ? saved : [];
  });
  const writeWorkspace = (next: Workspace | null) => {
    setWorkspace(next);
    onExtras?.(id, { workspace: next });
  };
  const complete = entries.filter((entry) => entry.agent && entry.did.trim());
  const writeEntries = (next: ExampleEntry[]) => {
    setEntries(next);
    const done = next.filter((entry) => entry.agent && entry.did.trim());
    if (done.length === next.length && (next.length === 0 || (next.length >= EXAMPLE_RUN_MIN && next.length <= EXAMPLE_RUN_MAX))) onExtras?.(id, { example_run: next.length > 0 ? next : null });
  };
  const change = (at: number, patch: Partial<ExampleEntry>) => writeEntries(entries.map((entry, i) => (i === at ? { ...entry, ...patch } : entry)));
  const swap = (at: number, by: -1 | 1) => {
    const next = [...entries];
    [next[at], next[at + by]] = [next[at + by], next[at]];
    writeEntries(next);
  };
  const short = entries.length > 0 && (complete.length < EXAMPLE_RUN_MIN || complete.length !== entries.length);
  return (
    <>
      <Field id={`${id}-workspace`} label={WORKSPACE_COPY.label} group>
        <PickMenu<WorkspaceKind | typeof NOT_SAID>
          label={WORKSPACE_COPY.label}
          options={[...WORKSPACE_KINDS.map((kind) => ({ value: kind, label: WORKSPACE_LABEL[kind] })), { value: NOT_SAID, label: "Not said" }]}
          value={workspace?.kind ?? NOT_SAID}
          placeholder="Not said"
          phone={phone}
          onChange={(kind) => writeWorkspace(kind === NOT_SAID ? null : takesMerge(kind) ? { ...workspace, kind } : { kind })}
        />
        {workspace && takesMerge(workspace.kind) ? (
          <>
            <PickMenu<Merge | typeof NOT_SAID>
              label={WORKSPACE_COPY.merge}
              options={[...MERGES.map((merge) => ({ value: merge, label: MERGE_LABEL[merge] })), { value: NOT_SAID, label: "Not said" }]}
              value={workspace.merge ?? NOT_SAID}
              placeholder={WORKSPACE_COPY.merge}
              phone={phone}
              onChange={(merge) => {
                const { merge: _was, ...rest } = workspace;
                writeWorkspace(merge === NOT_SAID ? rest : { ...rest, merge });
              }}
            />
            <PickMenu<string>
              label={WORKSPACE_COPY.mergedBy}
              options={[{ value: MAKER, label: WORKSPACE_COPY.maker }, ...agents.map((agent) => ({ value: agent.id, label: agent.label })), { value: NOT_SAID, label: "Not said" }]}
              value={workspace.merged_by ?? NOT_SAID}
              placeholder={WORKSPACE_COPY.pick}
              phone={phone}
              onChange={(by) => {
                const { merged_by: _was, ...rest } = workspace;
                writeWorkspace(by === NOT_SAID ? rest : { ...rest, merged_by: by });
              }}
            />
          </>
        ) : null}
      </Field>

      <Field id={`${id}-example`} label={EXAMPLE_COPY.label} hint={EXAMPLE_COPY.note} group>
        <ol data-testid="example-run-editor" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map((entry, at) => (
            <li key={at} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: t.label, minWidth: 16 }}>{at + 1}</span>
                <PickMenu<string> label={`Step ${at + 1}: agent`} options={agents.map((agent) => ({ value: agent.id, label: agent.label }))} value={entry.agent} placeholder="Select an agent" phone={phone} onChange={(agent) => change(at, { agent })} />
                <TextButton target={phone} aria-label={EXAMPLE_COPY.up(at + 1)} disabled={at === 0} onClick={() => swap(at, -1)}>Up</TextButton>
                <TextButton target={phone} aria-label={EXAMPLE_COPY.down(at + 1)} disabled={at === entries.length - 1} onClick={() => swap(at, 1)}>Down</TextButton>
                <TextButton target={phone} aria-label={EXAMPLE_COPY.remove(at + 1)} onClick={() => writeEntries(entries.filter((_, i) => i !== at))}>Remove</TextButton>
              </div>
              <input type="text" aria-label={`Step ${at + 1}: ${EXAMPLE_COPY.did}`} maxLength={EXAMPLE_DID_MAX} value={entry.did} placeholder={EXAMPLE_COPY.didPlaceholder} onChange={(event) => setEntries(entries.map((was, i) => (i === at ? { ...was, did: event.target.value } : was)))} onBlur={() => change(at, { did: entry.did.trim() })} style={typedField(phone)} />
              <input
                type="text"
                aria-label={`Step ${at + 1}: ${EXAMPLE_COPY.passedOn}`}
                maxLength={EXAMPLE_PASSED_MAX}
                value={entry.passed_on ?? ""}
                placeholder={EXAMPLE_COPY.passedPlaceholder}
                onChange={(event) => setEntries(entries.map((was, i) => (i === at ? { ...was, passed_on: event.target.value } : was)))}
                onBlur={() => {
                  const { passed_on: said, ...rest } = entry;
                  change(at, said?.trim() ? { ...rest, passed_on: said.trim() } : { ...rest, passed_on: undefined });
                }}
                style={typedField(phone)}
              />
            </li>
          ))}
        </ol>
        {short ? <span role="status" style={{ fontSize: 12, color: t.label }}>{EXAMPLE_COPY.range}</span> : null}
        {entries.length < EXAMPLE_RUN_MAX && agents.length > 0 ? (
          <span>
            <TextButton underline target={phone} onClick={() => setEntries([...entries, { agent: agents[entries.length % agents.length]?.id ?? "", did: "" }])}>
              {EXAMPLE_COPY.add}
            </TextButton>
          </span>
        ) : null}
      </Field>
    </>
  );
}
