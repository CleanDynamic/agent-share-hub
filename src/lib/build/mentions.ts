// SV-28 Part 2: agent mentions. In an agent's instructions or a team's instructions, "@" followed by the role or title of an agent
// in the same team names that agent. The text is stored as written: a mention is read, never rewritten, so renaming a role leaves
// the old mention unmatched (listed under "Mentions not matched") rather than silently changing the maker's words.
//
// Resolution is case-insensitive, role first, then title. A name must end where a word ends ("@Research" is not "@Researcher").
// Two agents answering to the same name make the mention ambiguous: it stays plain text and is listed. PURE.

export interface MentionAgent {
  id: string;
  role?: string | null;
  title?: string | null;
}

export interface Mention {
  /** Character range of the whole mention, "@" included. */
  start: number;
  end: number;
  /** The agent it names. */
  id: string;
}

export interface UnmatchedMention {
  start: number;
  end: number;
  /** What was written, "@" included. */
  text: string;
  /** Two or more agents answer to it. */
  ambiguous?: true;
}

export const MENTIONS_COPY = { notMatched: "Mentions not matched", ambiguous: "more than one agent has this name", open: (name: string) => `Open ${name}` } as const;

const WORD = /[\p{L}\p{N}_]/u;

/** The mentions in a text, resolved against the agents of one team. */
export function mentionsOf(text: string, team: readonly MentionAgent[]): { mentions: Mention[]; unmatched: UnmatchedMention[] } {
  const mentions: Mention[] = [];
  const unmatched: UnmatchedMention[] = [];
  const names = (pick: "role" | "title") =>
    team.flatMap((agent) => {
      const name = (agent[pick] ?? "").trim();
      return name ? [{ id: agent.id, name, lower: name.toLowerCase() }] : [];
    });
  const roles = names("role");
  const titles = names("title");
  const lower = text.toLowerCase();
  for (let at = text.indexOf("@"); at >= 0; at = text.indexOf("@", at + 1)) {
    // An "@" inside a word (an email address) is not a mention.
    if (at > 0 && WORD.test(text[at - 1])) continue;
    const from = at + 1;
    const fits = (entry: { lower: string }) => lower.startsWith(entry.lower, from) && !WORD.test(text[from + entry.lower.length] ?? "");
    const pickFrom = (list: readonly { id: string; lower: string }[]) => {
      const hits = list.filter(fits);
      if (hits.length === 0) return null;
      // The longest name wins ("@Chief of staff" over "@Chief"); agents that share that name are ambiguous.
      const longest = Math.max(...hits.map((hit) => hit.lower.length));
      const ids = [...new Set(hits.filter((hit) => hit.lower.length === longest).map((hit) => hit.id))];
      return { ids, length: longest };
    };
    const found = pickFrom(roles) ?? pickFrom(titles);
    if (found && found.ids.length === 1) {
      mentions.push({ start: at, end: from + found.length, id: found.ids[0] });
      at = from + found.length - 1;
      continue;
    }
    // Unresolved: the written word after the "@", up to the next space or punctuation that ends a word.
    let end = from;
    while (end < text.length && WORD.test(text[end])) end += 1;
    if (found) end = from + found.length;
    if (end === from) continue;
    unmatched.push({ start: at, end, text: text.slice(at, end), ...(found ? { ambiguous: true as const } : null) });
  }
  return { mentions, unmatched };
}

/** A text cut into plain runs and mention runs, in order, for the view. */
export function mentionRuns(text: string, mentions: readonly Mention[]): { text: string; id?: string }[] {
  const out: { text: string; id?: string }[] = [];
  let at = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    if (mention.start > at) out.push({ text: text.slice(at, mention.start) });
    out.push({ text: text.slice(mention.start, mention.end), id: mention.id });
    at = mention.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}
