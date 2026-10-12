/* UI-P48 — Prompts, as the page runs them.

   WHAT IS TYPED LEADS. Each prompt's text is held here as typed and written
   800ms after the last keystroke (as a title is), through the node queue. A
   prompt is never written empty: `payload.text` is required by the type.

   "WRITE ONE" adds a prompt that exists only on this page until the maker
   types something. On /compose/new that first keystroke makes the draft, as a
   title does. The row keeps its key when its node is made, so the field keeps
   its cursor. Pressing "write one" again while one such prompt is still empty
   only puts the cursor back in it.

   A PROMPT FROM A SESSION is refused when it is already in the build, and
   while it is on its way, so a double press adds it once. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { SAVE_DEBOUNCE_MS } from "@/hooks/useComposeBuild";
import { deleteNode, type BuildNode, type NodeTree } from "@/lib/build";
import {
  addSessionPrompt,
  addWrittenPrompt,
  isPromptAdded,
  movePrompt,
  promptModel,
  promptNodes,
  promptOrigin,
  promptText,
  savePromptText,
  setPromptModel,
} from "@/lib/build/composePrompts";
import {
  addAgent,
  addAgentPrompt,
  addResult,
  addTeam,
  addTool,
  addUse,
  dismissSuggestion,
  removeUse,
  setNodeFields,
  setInstructions,
  setRuns,
  setStepTitle,
  type Runs,
  type Step,
  type Use,
} from "@/lib/build/graph";
import type { SessionPrompt, SessionSummary } from "@/lib/build/sessions";

import { addedToast, parsePromptDragData, promptSourceLine } from "./composeModel";
import type { ComposePromptRow, PromptFocus } from "./PromptsPanel";
import { rowOf, type ComposeNodes } from "./useComposeNodes";

/** The key a prompt written on this page carries until it is saved. */
const LOCAL = "local-";

const findTop = (tree: readonly NodeTree[], id: string) => tree.find((node) => node.id === id) ?? null;

/** A node at any depth: an agent's prompt or a team's agent as well as a top-level one. */
const findNode = (tree: readonly NodeTree[], id: string): NodeTree | null => {
  for (const node of tree) {
    if (node.id === id) return node;
    const inner = node.children?.length ? findNode(node.children, id) : null;
    if (inner) return inner;
  }
  return null;
};

/** Log a failed write with its cause, and say so in one line. */
const failed = (line: string) => (cause: unknown) => {
  console.error("[Compose] prompt write failed", cause);
  toast.error(line);
};

export interface ComposePrompts {
  rows: ComposePromptRow[];
  focus: PromptFocus | null;
  setText: (key: string, text: string) => void;
  move: (key: string, direction: -1 | 1) => void;
  remove: (key: string) => void;
  write: () => void;
  /** + on a session prompt, or a drop. */
  add: (sessionId: string, ordinal: number) => void;
  drop: (data: string) => void;
  /** Already in the build, or on its way. */
  isAdded: (sessionId: string, index: number) => boolean;
  /** Name the model on every prompt from this session. */
  relabel: (sessionId: string, model: string | null) => void;
  /** Write every pending edit now; resolves once the queue is empty. */
  flush: () => Promise<void>;
  /** UI-P65: add a prompt the maker wrote, now, with the tool and model it names. Resolves true once it is saved. */
  addNow: (input: { text: string; tool: string | null; model: string | null }) => Promise<boolean>;
  /** UI-P65: name a step ("" puts its default name back). */
  rename: (id: string, title: string) => void;
  /** UI-P65: take a suggested input. */
  accept: (id: string, use: Use, steps: readonly Step[]) => void;
  /** UI-P65: keep a suggestion from coming back; `key` is "<kind>:<node_id>". */
  dismiss: (id: string, key: string) => void;
  /** UI-P66: take an input off a step. */
  removeUse: (id: string, use: Use) => void;
  /** UI-P66: how an agent or a team runs; null is "Runs once". */
  setRuns: (id: string, runs: Runs | null) => void;
  /** UI-P66: name the model of a prompt written by hand; null clears it. */
  setModel: (id: string, model: string | null) => void;
  /** UI-P66: change the text fields of a file, a tool or a result. */
  setFields: (id: string, fields: Record<string, string | null>) => void;
  /** UI-P66: take a node out of an agent or a team. */
  removeInside: (id: string) => void;
  /** UI-P66: add a tool or a result, then say which node it is (null if it failed). */
  addPiece: (kind: "tool" | "result") => Promise<string | null>;
  /** UI-P69: add an agent, or a team holding one agent; resolves the new step's id (null if it failed). */
  addAgentOrTeam: (input: { kind: "agent" | "team"; name: string | null; model: string }) => Promise<string | null>;
  /** UI-P69: add an agent inside a team. */
  addAgentTo: (teamId: string, model: string) => Promise<string | null>;
  /** UI-P69: a further prompt inside an agent. Resolves true once it is saved. */
  addPromptTo: (agentId: string, text: string) => Promise<boolean>;
  /** UI-P69: an agent's instructions (its system prompt). */
  setInstructions: (agentId: string, text: string) => void;
}

export function useComposePrompts({
  buildId,
  nodes,
  ensureBuild,
  sessions,
  sessionPrompts,
  onSessionUsed,
}: {
  buildId: string | undefined;
  nodes: ComposeNodes;
  ensureBuild: () => Promise<string>;
  /** The sessions a prompt can come from (the creator's library), oldest first, as Your sessions numbers them. */
  sessions: readonly SessionSummary[];
  /** A session's prompts, once read. */
  sessionPrompts: (sessionId: string) => readonly SessionPrompt[] | undefined;
  /** A prompt from this session was just added to the build. */
  onSessionUsed?: (sessionId: string) => void;
}): ComposePrompts {
  const [texts, setTexts] = useState<Record<string, string>>({});
  const textsRef = useRef(texts);
  /** Keys of prompts written here and not saved yet, in order. */
  const [drafts, setDrafts] = useState<string[]>([]);
  /** Removed, while the delete is on its way. */
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  /** "{importId}:{index}" of session prompts on their way in. */
  const [adding, setAdding] = useState<ReadonlySet<string>>(new Set());
  const addingRef = useRef(adding);
  addingRef.current = adding;
  const [focus, setFocus] = useState<PromptFocus | null>(null);

  /** Node id → the key it was written under here; and back. */
  const aliasOf = useRef(new Map<string, string>());
  const nodeOf = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, number>());
  const counter = useRef(0);

  const latest = useRef({ buildId, ensureBuild });
  latest.current = { buildId, ensureBuild };

  const idOf = (key: string) => nodeOf.current.get(key) ?? (key.startsWith(LOCAL) ? undefined : key);

  /* A different build is a different list. */
  const previous = useRef(buildId);
  useEffect(() => {
    const before = previous.current;
    previous.current = buildId;
    if (!before || before === buildId) return;
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
    textsRef.current = {};
    setTexts({});
    setDrafts([]);
    setHidden(new Set());
  }, [buildId]);

  const { run, current, record, settled } = nodes;

  const save = useCallback(
    (key: string) =>
      run(async () => {
        const text = textsRef.current[key];
        if (text === undefined || !text.trim()) return;
        const id = nodeOf.current.get(key) ?? (key.startsWith(LOCAL) ? undefined : key);
        if (id) {
          const node = findTop(current(), id);
          if (!node || promptText(node) === text) return;
          record(node.id, await savePromptText(rowOf(node), text));
          return;
        }
        const build = await latest.current.ensureBuild();
        const created = await addWrittenPrompt({ buildId: build, tree: current(), text });
        aliasOf.current.set(created.id, key);
        nodeOf.current.set(key, created.id);
        record(created.id, created);
        setDrafts((list) => list.filter((draft) => draft !== key));
      }),
    [run, current, record],
  );

  const flushKey = useCallback(
    (key: string) => {
      const timer = timers.current.get(key);
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timers.current.delete(key);
      save(key).catch(failed("Couldn't save that prompt. Try again."));
    },
    [save],
  );

  const flush = useCallback(() => {
    for (const key of [...timers.current.keys()]) flushKey(key);
    return settled();
  }, [flushKey, settled]);

  /* Leaving mid-pause must not lose the last words typed, in a build that exists. */
  useEffect(
    () => () => {
      if (!latest.current.buildId) return;
      for (const [key, timer] of timers.current) {
        window.clearTimeout(timer);
        save(key).catch(() => undefined);
      }
      timers.current.clear();
    },
    // `save` is stable: it reads everything it needs through refs.
    [save],
  );

  const setText = (key: string, text: string) => {
    textsRef.current = { ...textsRef.current, [key]: text };
    setTexts(textsRef.current);
    // The first words of a prompt written on /compose/new make the draft, as a title does.
    if (!latest.current.buildId && text.trim()) latest.current.ensureBuild().catch(() => undefined);
    const timer = timers.current.get(key);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.set(
      key,
      window.setTimeout(() => {
        timers.current.delete(key);
        save(key).catch(failed("Couldn't save that prompt. Try again."));
      }, SAVE_DEBOUNCE_MS),
    );
  };

  const move = (key: string, direction: -1 | 1) => {
    const id = idOf(key);
    if (!id) return;
    // Every pending text first: a reorder rewrites the rows it reads.
    for (const pending of [...timers.current.keys()]) flushKey(pending);
    nodes
      .run(async () => {
        const build = latest.current.buildId;
        if (!build) return;
        const prompts = promptNodes(nodes.current());
        const index = prompts.findIndex((node) => node.id === id);
        if (index === -1) return;
        const moves = await movePrompt(build, prompts, index, direction);
        for (const step of moves) {
          const node = prompts.find((candidate) => candidate.id === step.id);
          if (node) nodes.record(node.id, { ...rowOf(node), position: step.position });
        }
      })
      .catch(failed("Couldn't move that prompt. Try again."));
  };

  const remove = (key: string) => {
    const timer = timers.current.get(key);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(key);
    }
    setHidden((current) => new Set(current).add(key));
    nodes
      .run(async () => {
        const id = nodeOf.current.get(key) ?? (key.startsWith(LOCAL) ? undefined : key);
        if (id) {
          await deleteNode(id);
          nodes.record(id, null);
        }
        setDrafts((list) => list.filter((draft) => draft !== key));
        const { [key]: _gone, ...rest } = textsRef.current;
        textsRef.current = rest;
        setTexts(rest);
      })
      .then(
        () => setHidden((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        }),
        (cause) => {
          setHidden((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
          });
          failed("Couldn't remove that prompt. Try again.")(cause);
        },
      );
  };

  const write = () => {
    const empty = drafts.find((key) => !hidden.has(key) && !(textsRef.current[key] ?? "").trim());
    const key = empty ?? `${LOCAL}${++counter.current}`;
    if (!empty) setDrafts((list) => [...list, key]);
    setFocus({ key, at: Date.now() });
  };

  const isAdded = (sessionId: string, index: number) =>
    adding.has(`${sessionId}:${index}`) || isPromptAdded(nodes.tree, sessionId, index);

  const add = (sessionId: string, ordinal: number) => {
    const session = sessions.find((candidate) => candidate.id === sessionId);
    const prompt = sessionPrompts(sessionId)?.find((candidate) => candidate.ordinal === ordinal);
    if (!session || !prompt) return;
    const tag = `${sessionId}:${prompt.sourceRef.index}`;
    if (addingRef.current.has(tag) || isPromptAdded(nodes.current(), sessionId, prompt.sourceRef.index)) return;
    addingRef.current = new Set(addingRef.current).add(tag);
    setAdding(addingRef.current);

    nodes
      .run(async () => {
        if (isPromptAdded(nodes.current(), sessionId, prompt.sourceRef.index)) return null;
        const build = await latest.current.ensureBuild();
        const node = await addSessionPrompt({ buildId: build, tree: nodes.current(), importSessionId: sessionId, model: session.modelName, prompt });
        nodes.record(node.id, node);
        return promptNodes(nodes.current()).findIndex((candidate) => candidate.id === node.id) + 1;
      })
      .then((n) => {
        if (!n) return;
        toast(addedToast(n));
        onSessionUsed?.(sessionId);
      })
      .catch(failed("Couldn't add that prompt. Try again."))
      .finally(() => {
        const next = new Set(addingRef.current);
        next.delete(tag);
        addingRef.current = next;
        setAdding(next);
      });
  };

  const drop = (data: string) => {
    const parsed = parsePromptDragData(data);
    if (parsed) add(parsed.importId, parsed.ordinal);
  };

  const relabel = (sessionId: string, model: string | null) => {
    const affected = promptNodes(nodes.current()).filter(
      (node) => promptOrigin(node)?.importSessionId === sessionId && promptModel(node) !== model,
    );
    for (const { id } of affected) {
      nodes
        .run(async () => {
          const node = findTop(nodes.current(), id);
          if (node) nodes.record(node.id, await setPromptModel(rowOf(node), model));
        })
        .catch(failed("Couldn't name the model on its prompts. Try again."));
    }
  };

  const addNow = ({ text, tool, model }: { text: string; tool: string | null; model: string | null }) =>
    nodes
      .run(async () => {
        const build = await latest.current.ensureBuild();
        const created = await addWrittenPrompt({ buildId: build, tree: nodes.current(), text, tool, model });
        nodes.record(created.id, created);
        return true;
      })
      .catch((cause) => {
        failed("Couldn't add that prompt. Try again.")(cause);
        return false;
      });

  /** A write to one node: read it as the queue left it, write, keep the result. */
  const writeStep = (id: string, line: string, change: (node: BuildNode) => Promise<BuildNode>) =>
    nodes
      .run(async () => {
        const node = findNode(nodes.current(), id);
        if (node) nodes.record(node.id, await change(rowOf(node)));
      })
      .catch(failed(line));

  const rename = (id: string, title: string) => void writeStep(id, "Couldn't rename that. Try again.", (node) => setStepTitle(node, title));
  const accept = (id: string, use: Use, steps: readonly Step[]) =>
    void writeStep(id, "Couldn't add that input. Try again.", (node) => addUse(node, use, steps));
  const dismiss = (id: string, key: string) =>
    void writeStep(id, "Couldn't dismiss that. Try again.", (node) => dismissSuggestion(node, key));

  const removeUseFrom = (id: string, use: Use) =>
    void writeStep(id, "Couldn't remove that input. Try again.", (node) => removeUse(node, use));
  const setRunsOf = (id: string, runs: Runs | null) =>
    void writeStep(id, "Couldn't change how that runs. Try again.", (node) => setRuns(node, runs));
  const setModelOf = (id: string, model: string | null) =>
    void writeStep(id, "Couldn't change the model. Try again.", (node) => setPromptModel(node, model));
  const setFields = (id: string, fields: Record<string, string | null>) =>
    void writeStep(id, "Couldn't save that. Try again.", (node) => setNodeFields(node, fields));

  const removeInside = (id: string) => {
    nodes
      .run(async () => {
        await deleteNode(id);
        nodes.record(id, null);
      })
      .catch(failed("Couldn't remove that. Try again."));
  };

  const addPiece = (kind: "tool" | "result") =>
    nodes
      .run(async () => {
        const build = await latest.current.ensureBuild();
        const created =
          kind === "tool"
            ? await addTool(build, nodes.current(), { service: "Untitled tool" })
            : await addResult(build, nodes.current(), { summary: "Untitled result" });
        nodes.record(created.id, created);
        return created.id;
      })
      .catch((cause) => {
        failed(`Couldn't add that ${kind}. Try again.`)(cause);
        return null;
      });

  const addAgentOrTeam = ({ kind, name, model }: { kind: "agent" | "team"; name: string | null; model: string }) =>
    nodes
      .run(async () => {
        const build = await latest.current.ensureBuild();
        if (kind === "agent") {
          const created = await addAgent(build, nodes.current(), { name, model });
          nodes.record(created.id, created);
          return created.id;
        }
        const { team } = await addTeam(build, nodes.current(), { name, model });
        nodes.record(team.id, team);
        return team.id;
      })
      .catch((cause) => {
        failed(cause instanceof Error && /Deploy queue/.test(cause.message) ? "Teams need the Deploy queue item from UI-P61." : `Couldn't add that ${kind}. Try again.`)(cause);
        return null;
      });

  const addAgentTo = (teamId: string, model: string) =>
    nodes
      .run(async () => {
        const build = await latest.current.ensureBuild();
        return (await addAgent(build, nodes.current(), { model, parentId: teamId })).id;
      })
      .catch((cause) => {
        failed("Couldn't add that agent. Try again.")(cause);
        return null;
      });

  const addPromptTo = (agentId: string, text: string) =>
    nodes
      .run(async () => {
        const agent = findNode(nodes.current(), agentId);
        if (!agent) return false;
        await addAgentPrompt(rowOf(agent), nodes.current(), text);
        return true;
      })
      .catch((cause) => {
        failed("Couldn't add that prompt. Try again.")(cause);
        return false;
      });

  const setInstructionsOf = (agentId: string, text: string) =>
    void writeStep(agentId, "Couldn't save the instructions. Try again.", (node) => setInstructions(node, text));

  const rows = useMemo<ComposePromptRow[]>(() => {
    const saved = promptNodes(nodes.tree)
      .map((node) => ({ node, key: aliasOf.current.get(node.id) ?? node.id }))
      .filter(({ key }) => !hidden.has(key))
      .map(({ node, key }) => ({ key, text: texts[key] ?? promptText(node), source: promptSourceLine(node, sessions), saved: true }));
    const local = drafts
      .filter((key) => !hidden.has(key))
      .map((key) => ({ key, text: texts[key] ?? "", source: "Written by you", saved: false }));
    return [...saved, ...local];
  }, [nodes.tree, hidden, texts, drafts, sessions]);

  return { rows, focus, setText, move, remove, write, add, drop, isAdded, relabel, flush, addNow, rename, accept, dismiss, removeUse: removeUseFrom, setRuns: setRunsOf, setModel: setModelOf, setFields, removeInside, addPiece, addAgentOrTeam, addAgentTo, addPromptTo, setInstructions: setInstructionsOf };
}
