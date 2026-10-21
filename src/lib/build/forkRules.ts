// CA-13 Part 15: copy the METHOD, not the EVIDENCE. Pure.
//
// A fork keeps the source's earned numbers with the source (reproductions, confirmations, completeness, costs, timings, URLs).
// Those are build columns and are never copied. This extends the same rule to the payload fields CA-13 added, which carry the
// original's evidence rather than its method:
//
//   REMOVED   build_cost, run_cost (what it took and what it cost), helpers[].did (what each helper did on the original's run),
//             trace_url (the original's trace): they are the original's, and a copy has run nowhere yet.
//   RENAMED   a Decision's `answer` becomes `expected`, with source "original": in the copy it reads "The original answered billing
//             (92% sure) on this example; check yours does too", not as the copier's result.
//   KEPT      questions, state_sample, runs_when, called_from, defined_in (the last three are rewritten to the copied tiles by
//             rewritePayload), helpers' settings, output_shape, install, the agent's "Runs in".
//
// FORKING YOUR OWN BUILD STRIPS THEM TOO. fork.ts keeps hidden events for your own build because they are all yours already; these
// are different: the copy is a new build that has not run, so a figure it carried would claim the original's evidence on its first
// day, as an inherited "reproduced 12 times" would. The method is yours to keep; the evidence stays with the build that earned it.

type Payload = Record<string, unknown>;

export const EVIDENCE_KEYS = ["build_cost", "run_cost", "trace_url"] as const;

const isRecord = (value: unknown): value is Payload => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** The payload a copy starts with. Idempotent: a payload that is already the method comes back equal. */
export function methodOf<T extends object | null | undefined>(payload: T): T {
  if (!isRecord(payload)) return payload;
  const out: Payload = { ...payload };
  for (const key of EVIDENCE_KEYS) delete out[key];
  if (Array.isArray(out.helpers)) {
    out.helpers = out.helpers.map((helper) => {
      if (!isRecord(helper)) return helper;
      const { did: _did, ...rest } = helper;
      return rest;
    });
  }
  // A decision's answer is the original's: it stays, as what the copy is checked against.
  if (isRecord(out.answer) && Array.isArray(out.questions)) {
    out.expected = out.answer;
    out.source = "original";
    delete out.answer;
  } else if (isRecord(out.expected)) {
    out.source = "original";
  }
  return out as T;
}
