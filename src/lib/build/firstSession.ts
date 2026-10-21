// CA-12 P3: every post has at least one session. A new draft starts with Session 1: an empty session made here, with no
// app chosen. It is written where a session made here is kept (`making.sessions_meta`) and in `build_sessions`, so the
// prompt box that was already on the page is Prompt 1 of it.
//
// An old draft is never given one: this runs only when `ensureBuild` makes a draft.

import { insertBuildSessionIfTable } from "./buildSessions";
import { newSessionKey, setSessionMeta, todayDay } from "./making";

/** Make Session 1 for a draft that has just been created. Resolves its key. */
export async function seedFirstSession(buildId: string): Promise<string> {
  const key = newSessionKey();
  await setSessionMeta(buildId, key, { tool: null, date: todayDay() });
  await insertBuildSessionIfTable({ buildId, sessionKey: key, importId: null, position: 0 });
  return key;
}
