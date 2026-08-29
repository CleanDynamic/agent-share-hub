/**
 * NeoScale — the bounty-over-builds round trip (NS-P50)
 *
 * Drives the whole new path against a real database, in order:
 *
 *   createBuild + upsertNode   a build with one node marked is_gap
 *   createBountyForGap         the ask, filed against that gap
 *   (refusals)                 a non-gap node, and a payload that does not fit
 *   submitSolution             an answer, validated against the node's TYPE
 *   acceptSolution             the transaction: node filled, gap closed,
 *                              solver credited, milestone appended, bounty
 *                              solved
 *
 * The five writes acceptSolution performs are the half no unit test can reach:
 * a mock can show that the client asks for public.accept_bounty_solution, but
 * only Postgres can show that all five landed and that the gap trigger let the
 * bounty row be updated afterwards.
 *
 * IT TRIES TO DELETE THE BUILD IT MADE, and expects to fail — that refusal is
 * check 6. solution_acceptance_log restricts the delete of any bounty it has a
 * row for, and builds cascade to bounties, so a build whose gap was solved
 * cannot be removed. The script prints the two statements an operator can run
 * to clear it, and does not count the leftover as a failure.
 *
 * THIS SCRIPT WRITES. Point it at a DEV project. It refuses to run unless every
 * one of these is set, so it cannot be pointed at production by leaving a
 * terminal open in the wrong directory:
 *
 *   NEOSCALE_ALLOW_WRITES=1
 *   NEOSCALE_DEV_EMAIL=...        a user in that project
 *   NEOSCALE_DEV_PASSWORD=...
 *
 * USAGE
 *   NEOSCALE_ALLOW_WRITES=1 NEOSCALE_DEV_EMAIL=... NEOSCALE_DEV_PASSWORD=... \
 *     node --experimental-strip-types scripts/verify-bounty-flow.ts
 *
 * The signed-in user is both the bounty's author and its solver, which is the
 * only shape one set of credentials can drive. That is not the interesting case
 * for RLS — the interesting one is a stranger solving, and it is proven under
 * real policies in supabase/tests/ns-p50-drop-bounty-shims.sql — but it is the
 * whole of the mechanic, and every refusal below is evaluated by the database
 * rather than by the caller's identity.
 *
 * WHY IT BOOTS VITE: same reason scripts/verify-build-layer.ts does — src/lib/
 * imports the app's Supabase client, which reads import.meta.env and resolves
 * the "@/" alias. Vite in middleware mode gives the script the same env, the
 * same aliases and the same code path the browser gets.
 */

import { createServer } from "vite";

// The Supabase client is built for the browser and reaches for localStorage at
// module scope. Give it somewhere harmless to write before it loads.
if (typeof (globalThis as Record<string, unknown>).localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

interface Field {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  of?: Field[];
}

const email = process.env.NEOSCALE_DEV_EMAIL;
const password = process.env.NEOSCALE_DEV_PASSWORD;

if (process.env.NEOSCALE_ALLOW_WRITES !== "1" || !email || !password) {
  console.error(
    "Refusing to run: this script writes to the database it is pointed at.\n" +
      "Set NEOSCALE_ALLOW_WRITES=1, NEOSCALE_DEV_EMAIL and NEOSCALE_DEV_PASSWORD,\n" +
      "and check .env points at a DEV Supabase project."
  );
  process.exit(1);
}

let failures = 0;

function check(label: string, passed: boolean, detail = ""): void {
  console.log(`${passed ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

/** Whether `run` threw, and what it said. A refusal is a result, not a crash. */
async function refused(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * A payload that satisfies one node type's schema, built from the schema.
 *
 * Written from the registry rather than hard-coded, so this script keeps
 * working when a node type gains a field — which is exactly the change that
 * would otherwise make it fail for a reason that has nothing to do with
 * bounties.
 */
function payloadFor(fields: Field[], marker: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    switch (field.type) {
      case "number":
        payload[field.key] = 1;
        break;
      case "boolean":
        payload[field.key] = true;
        break;
      case "enum":
        payload[field.key] = field.options?.[0] ?? "";
        break;
      case "list":
        payload[field.key] = [];
        break;
      default:
        payload[field.key] = marker;
    }
  }
  return payload;
}

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

let buildId: string | null = null;

try {
  const build = await server.ssrLoadModule("/src/lib/build/index.ts");
  const bounty = await server.ssrLoadModule("/src/lib/bounty/index.ts");
  const { supabase } = await server.ssrLoadModule(
    "/src/integrations/supabase/client.ts"
  );

  const { data: auth, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);
  const userId = auth.user?.id as string;

  // A type from the registry that actually declares fields: a gap whose type
  // declares none has no payload to validate and would prove nothing.
  const types = await build.getNodeTypes();
  const nodeType = types.find(
    (entry: { is_active: boolean; schema?: { fields?: Field[] } }) =>
      entry.is_active && (entry.schema?.fields?.length ?? 0) > 0
  );
  if (!nodeType) throw new Error("no active node type with a payload schema");
  const fields = (nodeType.schema?.fields ?? []) as Field[];

  // 1. A build, with one gap and one ordinary node beside it.
  const created = await build.createBuild({
    title: `NS-P50 bounty flow ${new Date().toISOString()}`,
    shape: "agent",
  });
  buildId = created.id;
  console.log(`\nBuild   ${created.title}`);
  console.log(`slug    ${created.slug}\n`);

  const gap = await build.upsertNode({
    build_id: created.id,
    parent_id: null,
    position: 1,
    type: nodeType.key,
    title: "The step nobody has written",
    payload: {},
    is_gap: true,
  });
  const filled = await build.upsertNode({
    build_id: created.id,
    parent_id: null,
    position: 2,
    type: nodeType.key,
    title: "A step that is already written",
    payload: payloadFor(fields, "already here"),
    is_gap: false,
  });

  check("the gap node is marked as a gap", gap.is_gap === true);

  // 2. The bounty, and the two refusals that matter.
  const notAGap = await refused(() =>
    bounty.createBountyForGap({ buildId: created.id, nodeId: filled.id })
  );
  check(
    "a node that is not a gap is refused",
    notAGap !== null && /not marked as a gap/i.test(notAGap),
    notAGap ?? "(it was accepted)"
  );

  const open = await bounty.createBountyForGap({
    buildId: created.id,
    nodeId: gap.id,
    rewardGbp: 25,
  });
  check("the bounty is open", open.status === "open", open.status);
  check("it names the gap", open.gap_node_id === gap.id);
  check("its author is the build's creator", open.author_id === userId);
  check("it has no legacy home", open.legacy_item_id === null);

  const twice = await refused(() =>
    bounty.createBountyForGap({ buildId: created.id, nodeId: gap.id })
  );
  check(
    "a second bounty on the same gap is refused",
    twice !== null && /already has a bounty/i.test(twice),
    twice ?? "(it was accepted)"
  );

  // 3. The payload check, on the way in.
  const badPayload = await refused(() =>
    bounty.submitSolution({
      bountyId: open.id,
      nodePayload: { not_a_field_this_type_declares: "anything" },
      solverId: userId,
    })
  );
  check(
    "a payload the node type does not declare is refused",
    badPayload !== null && /schema does not declare/i.test(badPayload),
    badPayload ?? "(it was stored)"
  );

  const answer = payloadFor(fields, "the answer");
  const solution = await bounty.submitSolution({
    bountyId: open.id,
    nodePayload: answer,
    solverId: userId,
    solverNote: "filled from scripts/verify-bounty-flow.ts",
  });
  check("the solution is submitted", solution.status === "submitted", solution.status);
  check("it answers a node slot", solution.slot_kind === "node", solution.slot_kind);
  check("on this bounty's gap", solution.slot_id === gap.id);

  // 4. The acceptance, and everything it is supposed to have done.
  const accepted = await bounty.acceptSolution(open.id, solution.id);
  check("acceptance names the node it filled", accepted.nodeId === gap.id);
  check("and the event it appended", Boolean(accepted.eventId), accepted.eventId);

  const record = await bounty.getBounty(open.id);
  check("the bounty is solved", record?.bounty.status === "solved", record?.bounty.status);
  check(
    "and names the solution it accepted",
    record?.bounty.accepted_solution_id === solution.id
  );
  check("solved_at is written", Boolean(record?.bounty.solved_at));

  const node = record?.gapNode;
  check("the node is no longer a gap", node?.is_gap === false);
  check(
    "its payload IS the accepted one",
    JSON.stringify(node?.payload ?? {}) === JSON.stringify(answer),
    JSON.stringify(node?.payload ?? {})
  );

  const ref = (node?.source_ref ?? {}) as Record<string, unknown>;
  check("source_ref credits the bounty", ref.source === "bounty", String(ref.source));
  check("and the solution", ref.solution_id === solution.id);
  check("and the solver", ref.solver_id === userId);

  const events = await build.getEvents(created.id, { includeHidden: true });
  const milestone = events.find(
    (event: { id: string }) => event.id === accepted.eventId
  ) as { kind?: string; payload?: Record<string, unknown>; ordinal?: number } | undefined;
  check("a milestone was appended", milestone?.kind === "milestone", milestone?.kind);
  check(
    "and it says who solved the gap",
    typeof milestone?.payload?.text === "string" &&
      /^Gap solved by @/.test(milestone.payload.text as string),
    String(milestone?.payload?.text)
  );
  check(
    "with a dense 1-based ordinal",
    typeof milestone?.ordinal === "number" && milestone.ordinal >= 1,
    String(milestone?.ordinal)
  );

  // 5. The bounty row is still writable after its gap stopped being a gap.
  // NS-P45's trigger asserted is_gap unconditionally, which would have made
  // every later update of this row fail; NS-P50 exempts a solved bounty.
  const closeAgain = await refused(() => bounty.closeBounty(open.id));
  check(
    "a solved bounty refuses to be closed, in words rather than a trigger error",
    closeAgain !== null && /has been solved/i.test(closeAgain),
    closeAgain ?? "(it was closed)"
  );

  const secondAccept = await refused(() =>
    bounty.acceptSolution(open.id, solution.id)
  );
  check(
    "the same solution cannot be accepted twice",
    secondAccept !== null,
    secondAccept ?? "(it was accepted again)"
  );

  // 6. And the thing that surprises everyone once, asserted so it surprises
  // nobody twice. solution_acceptance_log.bounty_id is ON DELETE RESTRICT,
  // because an append-only record of who solved what is exactly the thing that
  // must not vanish with the row it is about. builds -> bounties is CASCADE, so
  // the restrict reaches all the way up: a build with an accepted solution on
  // one of its gaps CANNOT BE DELETED, and the error names bounties.
  //
  // Before NS-P50 no build could have an acceptance row, so this is new
  // behaviour on the build path and the delete affordance has to reckon with
  // it. It is deliberate here, not incidental.
  const deletion = await refused(() => build.deleteBuild(created.id));
  check(
    "a build whose gap was solved cannot be deleted — the acceptance log restricts it",
    deletion !== null,
    deletion ?? "(it was deleted, and the acceptance record went with it)"
  );
  if (deletion === null) buildId = null;
} catch (error) {
  failures += 1;
  console.error("\nFAILED:", error instanceof Error ? error.message : error);
} finally {
  if (buildId) {
    try {
      const build = await server.ssrLoadModule("/src/lib/build/index.ts");
      await build.deleteBuild(buildId);
      console.log(`\ncleaned up build ${buildId}`);
    } catch {
      // Expected on a completed run, and asserted as check 6 above: the
      // acceptance log restricts the cascade. Not counted as a failure, but the
      // build is left behind and the operator is told exactly how to remove it.
      console.log(
        `\nbuild ${buildId} was left in place: its accepted solution is in the` +
          " append-only log, which restricts the delete. To remove it:\n" +
          `  DELETE FROM public.solution_acceptance_log\n` +
          `   WHERE bounty_id IN (SELECT id FROM public.bounties WHERE build_id = '${buildId}');\n` +
          `  DELETE FROM public.builds WHERE id = '${buildId}';`
      );
    }
  }
  await server.close();
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
