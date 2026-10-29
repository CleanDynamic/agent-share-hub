// SV-21 P3: offering a session and accepting it. The build layer is faked; the claim is the board's courtesy.

import { beforeEach, describe, expect, it, vi } from "vitest";

interface Written {
  table: string;
  op: string;
  row?: Record<string, unknown>;
}
let written: Written[] = [];
let answers: Record<string, { data?: unknown; error?: unknown }> = {};

function builder(table: string) {
  const self: Record<string, unknown> = {};
  let op = "select";
  for (const name of ["select", "eq", "in", "order", "limit"]) self[name] = () => self;
  self.insert = (row: Record<string, unknown>) => {
    op = "insert";
    written.push({ table, op, row });
    return self;
  };
  self.update = (row: Record<string, unknown>) => {
    op = "update";
    written.push({ table, op, row });
    return self;
  };
  const settle = () => ({ data: answers[`${table}:${op}`]?.data ?? answers[table]?.data ?? null, error: answers[`${table}:${op}`]?.error ?? answers[table]?.error ?? null });
  self.maybeSingle = () => Promise.resolve(settle());
  self.single = () => Promise.resolve(settle());
  self.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(settle()).then(resolve, reject);
  return self;
}

const addSessionToBuild = vi.fn();
const addOfferedSession = vi.fn();
const loadOfferedSession = vi.fn();
const deleteBuild = vi.fn();
const startRebuild = vi.fn();
const claimRequest = vi.fn();
const readMaking = vi.fn();
const setPartOpen = vi.fn();
const setSessionOpen = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => builder(table) } }));
vi.mock("@/lib/build/addSession", () => ({
  addSessionToBuild: (...args: unknown[]) => addSessionToBuild(...args),
  addOfferedSession: (...args: unknown[]) => addOfferedSession(...args),
  loadOfferedSession: (...args: unknown[]) => loadOfferedSession(...args),
}));
vi.mock("@/lib/build/builds", () => ({ deleteBuild: (...args: unknown[]) => deleteBuild(...args) }));
vi.mock("@/lib/build/rebuild", () => ({ startRebuild: (...args: unknown[]) => startRebuild(...args) }));
vi.mock("./claims", () => ({ claimRequest: (...args: unknown[]) => claimRequest(...args) }));
vi.mock("@/lib/build/making", async () => ({
  ...(await vi.importActual<object>("@/lib/build/making")),
  readMaking: (...args: unknown[]) => readMaking(...args),
  setPartOpen: (...args: unknown[]) => setPartOpen(...args),
  setSessionOpen: (...args: unknown[]) => setSessionOpen(...args),
}));

import { acceptOffer, declineOffer, listOpenOffers, offerSession } from "@/lib/bounty/sessionOffers";

const SESSION = { key: "imp-1", model: "Opus 5.5", prompts: [{ text: "Deploy it", reply: null, sourceRef: { source: "claude_code", session_id: "s", index: 0, local_id: "a" } }] };
const REQUEST = { id: "q1", build_id: "b1", status: "open", size: "session", target_key: "typed-3", author_id: "maker" };
const OFFER = { id: "o1", request_id: "q1", user_id: "kit", status: "offered", created_at: "2026-11-01T10:00:00Z", snapshot: SESSION, profiles: { username: "kit" } };

beforeEach(() => {
  written = [];
  answers = { bounties: { data: REQUEST }, "request_offers:insert": { data: OFFER }, request_offers: { data: OFFER } };
  for (const fn of [addSessionToBuild, addOfferedSession, loadOfferedSession, deleteBuild, startRebuild, claimRequest, readMaking, setPartOpen, setSessionOpen]) fn.mockReset();
  loadOfferedSession.mockResolvedValue(SESSION);
  startRebuild.mockResolvedValue({ id: "fork-1" });
  addSessionToBuild.mockResolvedValue({});
  addOfferedSession.mockResolvedValue({});
  deleteBuild.mockResolvedValue(undefined);
  claimRequest.mockResolvedValue(true);
  readMaking.mockResolvedValue({ workstreams: [{ key: "ws-a" }, { key: "ws-b" }], sessions_meta: { "typed-3": { tool: null, date: "2026-10-20", workstream: "ws-b" }, "typed-1": { tool: null, date: "2026-10-20" } } });
  setPartOpen.mockResolvedValue({});
  setSessionOpen.mockResolvedValue({});
});

describe("offerSession", () => {
  it("forks the build, copies the session into the fork's part, files the offer with a snapshot and takes the claim", async () => {
    const offer = await offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" });
    expect(startRebuild).toHaveBeenCalledWith({ sourceBuildId: "b1" });
    expect(addSessionToBuild).toHaveBeenCalledWith("imp-1", { kind: "existing", buildId: "fork-1", workstream: "ws-b" });
    expect(written.find((entry) => entry.table === "request_offers")?.row).toEqual({ request_id: "q1", user_id: "kit", fork_build_id: "fork-1", session_key: "imp-1", snapshot: SESSION });
    expect(claimRequest).toHaveBeenCalledWith({ requestId: "q1", userId: "kit", forkBuildId: "fork-1" });
    expect(offer).toMatchObject({ id: "o1", handle: "kit", status: "offered", session: { key: "imp-1" } });
  });

  it("joins the first part for a session that names none, and no part for a build that has none", async () => {
    answers.bounties = { data: { ...REQUEST, target_key: "typed-1" } };
    await offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" });
    expect(addSessionToBuild).toHaveBeenLastCalledWith("imp-1", { kind: "existing", buildId: "fork-1", workstream: "ws-a" });
    readMaking.mockResolvedValue({ sessions_meta: { "typed-1": { tool: null, date: "2026-10-20" } } });
    await offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" });
    expect(addSessionToBuild).toHaveBeenLastCalledWith("imp-1", { kind: "existing", buildId: "fork-1" });
  });

  it("joins the part itself for a request for a part", async () => {
    answers.bounties = { data: { ...REQUEST, size: "part", target_key: "ws-a" } };
    await offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" });
    expect(addSessionToBuild).toHaveBeenCalledWith("imp-1", { kind: "existing", buildId: "fork-1", workstream: "ws-a" });
  });

  it("deletes the fork when the offer is not filed, and says the table is not there yet", async () => {
    answers["request_offers:insert"] = { error: { code: "42P01" } };
    await expect(offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" })).rejects.toThrow("not available yet");
    expect(deleteBuild).toHaveBeenCalledWith("fork-1");
    expect(claimRequest).not.toHaveBeenCalled();
  });

  it("is not stopped by a claim someone else holds", async () => {
    claimRequest.mockRejectedValue(new Error("Someone else is already working on this request"));
    await expect(offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" })).resolves.toMatchObject({ id: "o1" });
    expect(deleteBuild).not.toHaveBeenCalled();
  });

  it("forks nothing for a closed request, the maker's own, or a request for neither", async () => {
    answers.bounties = { data: { ...REQUEST, status: "solved" } };
    await expect(offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" })).rejects.toThrow("closed");
    answers.bounties = { data: { ...REQUEST, size: null, target_key: null } };
    await expect(offerSession({ requestId: "q1", importId: "imp-1", userId: "kit" })).rejects.toThrow("not for a session or a part");
    answers.bounties = { data: REQUEST };
    await expect(offerSession({ requestId: "q1", importId: "imp-1", userId: "maker" })).rejects.toThrow("add the session to it yourself");
    expect(startRebuild).not.toHaveBeenCalled();
  });
});

describe("acceptOffer", () => {
  it("writes the snapshot into the maker's build with the contributor's credit, clears the mark, and settles the offer and the request", async () => {
    await expect(acceptOffer({ offerId: "o1", makerId: "maker" })).resolves.toBe("b1");
    expect(addOfferedSession).toHaveBeenCalledWith("b1", SESSION, "kit", "ws-b");
    expect(setSessionOpen).toHaveBeenCalledWith("b1", "typed-3", null);
    expect(written.find((entry) => entry.table === "request_offers" && entry.op === "update")?.row).toMatchObject({ status: "accepted" });
    expect(written.find((entry) => entry.table === "bounties" && entry.op === "update")?.row).toMatchObject({ status: "solved" });
  });

  it("clears a part's mark for a request for a part", async () => {
    answers.bounties = { data: { ...REQUEST, size: "part", target_key: "ws-a" } };
    await acceptOffer({ offerId: "o1", makerId: "maker" });
    expect(setPartOpen).toHaveBeenCalledWith("b1", "ws-a", null);
    expect(addOfferedSession).toHaveBeenCalledWith("b1", SESSION, "kit", "ws-a");
  });

  it("writes nothing for anyone but the maker, or for an offer already decided", async () => {
    await expect(acceptOffer({ offerId: "o1", makerId: "kit" })).rejects.toThrow("Only the person who made the build");
    answers.request_offers = { data: { ...OFFER, status: "declined" } };
    await expect(acceptOffer({ offerId: "o1", makerId: "maker" })).rejects.toThrow("has been decided");
    expect(addOfferedSession).not.toHaveBeenCalled();
    expect(written.filter((entry) => entry.op === "update")).toEqual([]);
  });

  it("leaves the offer and the request as they were when the session cannot be written", async () => {
    addOfferedSession.mockRejectedValue(new Error("tiles failed"));
    await expect(acceptOffer({ offerId: "o1", makerId: "maker" })).rejects.toThrow("tiles failed");
    expect(written.filter((entry) => entry.op === "update")).toEqual([]);
  });
});

describe("listOpenOffers, declineOffer", () => {
  it("lists the undecided offers of the requests, and none before the migration is applied", async () => {
    answers.request_offers = { data: [OFFER] };
    expect(await listOpenOffers(["q1"])).toEqual([expect.objectContaining({ id: "o1", handle: "kit" })]);
    expect(await listOpenOffers([])).toEqual([]);
    answers.request_offers = { error: { code: "PGRST205" } };
    expect(await listOpenOffers(["q1"])).toEqual([]);
  });

  it("marks an offer declined", async () => {
    answers.request_offers = { data: null };
    await declineOffer("o1");
    expect(written.find((entry) => entry.op === "update")?.row).toMatchObject({ status: "declined" });
  });
});
