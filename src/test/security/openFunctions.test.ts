// SV-01 Part 4. The functions that used to answer anybody.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { mayExport } from "../../../supabase/functions/generate-ai-pdf/access.ts";
import { createCompatHandler, sameSecret, type CompatDeps, type Item } from "../../../supabase/functions/check-compatibility-status/handler.ts";
import { githubApiUrl, parseGithubUrl } from "../../../supabase/functions/import-github-readme/github.ts";
import { createNotifyHandler, type NotifyDeps } from "../../../supabase/functions/notify-version-update/handler.ts";

const ITEM = "7b2f1c1e-3b6a-4f77-9d52-0f2c8b1b9a11";
const OWNER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";
const FAN = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://fn.test/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

function notifyDeps(user: string | null) {
  const insertNotifications = vi.fn(async () => {});
  const deps: NotifyDeps = {
    getUserId: async () => user,
    findCreator: async (id) => (id === ITEM ? OWNER : null),
    findAudience: async () => [FAN, FAN, OWNER],
    insertNotifications,
  };
  return { deps, insertNotifications };
}

describe("SV-01 P4: notify-version-update", () => {
  const body = { content_id: ITEM, version_number: "1.1" };

  it("refuses an unsigned call", async () => {
    const { deps, insertNotifications } = notifyDeps(null);
    const res = await createNotifyHandler(deps)(post(body));
    expect(res.status).toBe(401);
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("refuses a caller who does not own the item, whatever creator_id the body claims", async () => {
    const { deps, insertNotifications } = notifyDeps(OTHER);
    const res = await createNotifyHandler(deps)(post({ ...body, creator_id: OWNER }));
    expect(res.status).toBe(403);
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("notifies the audience as the owner, once each, never the owner", async () => {
    const { deps, insertNotifications } = notifyDeps(OWNER);
    const res = await createNotifyHandler(deps)(post({ ...body, creator_id: OTHER, changelog: "x".repeat(500) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notified: 1 });
    const rows = insertNotifications.mock.calls[0] as unknown as [{ recipient_id: string; actor_id: string; metadata: { changelog: string } }[]];
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({ recipient_id: FAN, actor_id: OWNER });
    expect(rows[0][0].metadata.changelog).toHaveLength(200);
  });

  it("names a missing field with a 400", async () => {
    const res = await createNotifyHandler(notifyDeps(OWNER).deps)(post({ version_number: "1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^content_id:/);
  });
});

describe("SV-01 P4: check-compatibility-status", () => {
  const old = new Date("2026-01-01T00:00:00Z").toISOString();
  const items: Item[] = [{ id: "i1", creator_id: OWNER, title: "T", last_verified_at: old, approved_at: old, compatibility_status: "verified" }];

  function deps(secret: string | undefined) {
    const setStatus = vi.fn(async () => {});
    const insertNotifications = vi.fn(async () => {});
    const d: CompatDeps = { secret, listApproved: async () => items, setStatus, insertNotifications, now: () => new Date("2026-10-25T00:00:00Z") };
    return { d, setStatus, insertNotifications };
  }

  it("refuses a call without the secret, and writes nothing", async () => {
    const { d, setStatus, insertNotifications } = deps("s3cret");
    const res = await createCompatHandler(d)(new Request("https://fn.test/x", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(setStatus).not.toHaveBeenCalled();
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret, and refuses everybody when none is set", async () => {
    expect((await createCompatHandler(deps("s3cret").d)(new Request("https://fn.test/x", { method: "POST", headers: { "x-cron-secret": "nope" } }))).status).toBe(401);
    expect((await createCompatHandler(deps(undefined).d)(new Request("https://fn.test/x", { method: "POST", headers: { "x-cron-secret": "" } }))).status).toBe(401);
    expect(sameSecret("a", undefined)).toBe(false);
  });

  it("runs for the secret", async () => {
    const { d, setStatus, insertNotifications } = deps("s3cret");
    const res = await createCompatHandler(d)(new Request("https://fn.test/x", { method: "POST", headers: { "x-cron-secret": "s3cret" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1, notified: 1 });
    expect(setStatus).toHaveBeenCalledWith("i1", "outdated");
    expect(insertNotifications).toHaveBeenCalledTimes(1);
  });
});

describe("SV-01 P4: generate-ai-pdf", () => {
  it("exports public approved posts for anyone", () => {
    expect(mayExport({ status: "approved", visibility: "public", creator_id: OWNER }, null)).toBe(true);
  });
  it.each([
    ["a draft", { status: "draft", visibility: "public" }],
    ["a pending post", { status: "pending", visibility: "public" }],
    ["a private post", { status: "approved", visibility: "private" }],
    ["an unlisted post", { status: "approved", visibility: "unlisted" }],
  ])("refuses %s to a stranger and an anonymous caller", (_n, p) => {
    expect(mayExport({ ...p, creator_id: OWNER }, OTHER)).toBe(false);
    expect(mayExport({ ...p, creator_id: OWNER }, null)).toBe(false);
  });
  it("lets the creator export their own", () => {
    expect(mayExport({ status: "draft", visibility: "private", creator_id: OWNER }, OWNER)).toBe(true);
  });
  it("is checked before anything is read or uploaded", () => {
    const src = readFileSync("supabase/functions/generate-ai-pdf/index.ts", "utf8");
    expect(src.indexOf("mayExport(post")).toBeGreaterThan(0);
    expect(src.indexOf("mayExport(post")).toBeLessThan(src.indexOf("buildPdf(payload)"));
  });
});

describe("SV-01 P4: import-github-readme", () => {
  it.each([
    ["https://github.com/o/r", { owner: "o", repo: "r" }],
    ["github.com/o/r", { owner: "o", repo: "r" }],
    ["https://github.com/o/r/blob/main/docs/a b.md", { owner: "o", repo: "r", filePath: "docs/a b.md" }],
  ])("accepts %s", (url, target) => {
    expect(parseGithubUrl(url)).toEqual(target);
  });

  it.each([
    "https://evil.example/github.com/o/r",
    "https://github.com.evil.example/o/r",
    "https://github.com@evil.example/o/r",
    "https://169.254.169.254/latest",
    "https://github.com/o",
    "https://github.com/o/r/blob/main/../../etc/passwd",
    "https://github.com/o/r/blob/main/%2e%2e/x",
    "ftp://github.com/o/r",
  ])("refuses %s", (url) => {
    expect(parseGithubUrl(url)).toBeNull();
  });

  it("only ever builds api.github.com addresses", () => {
    expect(githubApiUrl({ owner: "o", repo: "r" })).toBe("https://api.github.com/repos/o/r/readme");
    expect(githubApiUrl({ owner: "o", repo: "r", filePath: "docs/a b.md" })).toBe("https://api.github.com/repos/o/r/contents/docs/a%20b.md");
  });
});

describe("SV-01 P4: no module-level caller state", () => {
  it("keeps no caller data at module level in the functions this prompt changed", () => {
    for (const f of ["notify-version-update", "check-compatibility-status", "generate-ai-pdf", "create-checkout-session", "create-donation-session"]) {
      const src = readFileSync(`supabase/functions/${f}/index.ts`, "utf8");
      expect(src, f).not.toMatch(/^(let|var) /m);
    }
  });
});
