/* UX-01 P1: the two links on an unsent prompt in the Publish checklist, loaded when one is pressed (it is not part of the
   composer's first download). Add as step tile sends it as the box's own button does, as one step of the history, with the
   List told which tile is coming; Discard clears the box. */

import { ADDED } from "@/lib/build/stepSentences";

import { sendUnsentTile, type SendUnsentInput } from "./sendUnsentTile";
import type { UnsentStore } from "./useUnsentPrompts";

export interface UnsentActionInput {
  unsent: UnsentStore;
  key: string;
  action: "add" | "discard";
  /** The session's tool, or null when it has none. */
  tool: string | null;
  track: SendUnsentInput["track"];
  /** An agent's prompt box, sent through the page's own handler. */
  addToAgent: (agentId: string, text: string) => Promise<boolean>;
  /** The session a prompt in this box is written to: Session 1 before the draft exists makes the draft first. */
  sessionFor: (key: string) => Promise<string | null>;
  write: (input: { text: string; tool: string | null; model: null; session: string | null; id: string }) => Promise<boolean>;
}

export async function runUnsentAction({ unsent, key, action, tool, track, addToAgent, sessionFor, write }: UnsentActionInput): Promise<void> {
  const text = unsent.get(key);
  if (action === "discard" || !text.trim()) return void unsent.set(key, "");
  if (key.startsWith("agent:")) {
    if (await addToAgent(key.slice("agent:".length), text)) unsent.set(key, "");
    return;
  }
  const saved = await sendUnsentTile({ track, sentence: ADDED.prompt, write: async (id) => write({ text, tool, model: null, session: await sessionFor(key), id }) });
  if (saved) unsent.set(key, "");
}
