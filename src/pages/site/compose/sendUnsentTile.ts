/* UX-01 P1: "Add as step tile" on an unsent prompt. It sends exactly as the box's send button does, as one step of the build's
   history, and tells the List's animator first which tile is coming: the id is chosen here, before the write, and the write
   uses it. `track` is `useBuildHistory`'s; its `motion` and `keys` options make it call `motion.expect({ kind: "add", keys })`
   before the task starts. */

import type { TrackOptions } from "./useBuildHistory";

export interface SendUnsentInput {
  track: <T>(sentence: string, task: () => Promise<T>, options?: TrackOptions) => Promise<T>;
  sentence: string;
  /** Writes the prompt with the id it is given; resolves whether it was saved. */
  write: (id: string) => Promise<boolean>;
  newId?: () => string;
}

export async function sendUnsentTile({ track, sentence, write, newId = () => crypto.randomUUID() }: SendUnsentInput): Promise<boolean> {
  const id = newId();
  return track(sentence, () => write(id), { motion: "add", keys: [id] });
}
