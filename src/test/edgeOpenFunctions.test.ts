// CA-29 Part 4. A function that writes with the service key, or reads private
// rows, checks its caller first. Each one is built from the pieces index.ts wires up.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createHandler as createNotify } from "../../supabase/functions/notify-version-update/handler";
import { createHandler as createCompat } from "../../supabase/functions/check-compatibility-status/handler";
import { createHandler as createPdf } from "../../supabase/functions/generate-ai-pdf/handler";
import { createHandler as createReadme } from "../../supabase/functions/import-github-readme/handler";

const CONTENT = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const SAVER = "44444444-4444-4444-8444-444444444444";

const request = (body: unknown, headers: Record<string, string> = {}, method = "POST") =>
  new Request("https://project.supabase.co/functions/v1/x", {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
const signedIn = (token = "owner-token") => ({ Authorization: `Bearer ${token}` });
const users = async (token: string | null) => (token === "owner-token" ? { id: OWNER } : token === "other-token" ? { id: OTHER } : null);

describe("CA-29 P4: notify-version-update", () => {
  const setup = () => {
    const insertNotifications = vi.fn(async (_rows: Record<string, unknown>[]) => undefined);
    const handler = createNotify({
      getUser: users,
      getContentCreator: async (id) => (id === CONTENT ? OWNER : null),
      getRecipients: async () => [OWNER, SAVER, SAVER],
      insertNotifications,
    });
    return { insertNotifications, handler };
  };
  const body = { content_id: CONTENT, version_number: "1.2", changelog: "Fixes", content_title: "A build" };

  it("refuses a call with no login", async () => {
    const { handler, insertNotifications } = setup();
    expect((await handler(request(body))).status).toBe(401);
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("refuses a caller who does not own the item, whatever creator_id says", async () => {
    const { handler, insertNotifications } = setup();
    const response = await handler(request({ ...body, creator_id: OTHER }, signedIn("other-token")));
    expect(response.status).toBe(403);
    expect(insertNotifications).not.toHaveBeenCalled();
  });

  it("notifies each saver once, as the owner from the token, and never the owner", async () => {
    const { handler, insertNotifications } = setup();
    const response = await handler(request({ ...body, creator_id: OTHER }, signedIn()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ notified: 1 });
    const rows = insertNotifications.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ recipient_id: SAVER, actor_id: OWNER, notification_type: "version_update", content_id: CONTENT });
  });

  it("names a missing field and answers an unknown item with 404", async () => {
    const { handler } = setup();
    const missing = await handler(request({ content_id: CONTENT }, signedIn()));
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toMatch(/^version_number:/);
    const unknown = await handler(request({ ...body, content_id: "55555555-5555-4555-8555-555555555555" }, signedIn()));
    expect(unknown.status).toBe(404);
  });
});

describe("CA-29 P4: check-compatibility-status", () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const setup = (secret: string | undefined = "s3cret") => {
    const updateStatus = vi.fn(async (_id: string, _status: string) => true);
    const insertNotifications = vi.fn(async (_rows: Record<string, unknown>[]) => undefined);
    const handler = createCompat({
      cronSecret: secret,
      listApproved: async () => [
        { id: "a", creator_id: OWNER, title: "Old", last_verified_at: daysAgo(200), approved_at: daysAgo(300), compatibility_status: "verified" },
        { id: "b", creator_id: OWNER, title: "Fresh", last_verified_at: daysAgo(5), approved_at: daysAgo(300), compatibility_status: "verified" },
      ],
      updateStatus,
      insertNotifications,
    });
    return { updateStatus, insertNotifications, handler };
  };

  it("refuses a call without the secret, with the wrong secret, and when no secret is set", async () => {
    for (const [secret, headers] of [
      ["s3cret", {}],
      ["s3cret", { "x-cron-secret": "wrong" }],
      ["s3cret", { "x-cron-secret": "s3cre" }],
      [undefined, { "x-cron-secret": "" }],
      [undefined, { "x-cron-secret": "undefined" }],
    ] as const) {
      const { handler, updateStatus, insertNotifications } = setup(secret);
      const response = await handler(request({}, headers));
      expect(response.status).toBe(401);
      expect(updateStatus).not.toHaveBeenCalled();
      expect(insertNotifications).not.toHaveBeenCalled();
    }
  });

  it("refuses a signed-in user's token in place of the secret", async () => {
    const { handler, updateStatus } = setup();
    expect((await handler(request({}, signedIn()))).status).toBe(401);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("rewrites the statuses when the secret matches", async () => {
    const { handler, updateStatus, insertNotifications } = setup();
    const response = await handler(request({}, { "x-cron-secret": "s3cret" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updated: 1, notified: 1 });
    expect(updateStatus).toHaveBeenCalledWith("a", "outdated");
    expect(insertNotifications.mock.calls[0][0][0]).toMatchObject({ recipient_id: OWNER, notification_type: "compatibility_warning", content_id: "a" });
  });
});

describe("CA-29 P4: generate-ai-pdf", () => {
  const post = (over: Record<string, unknown> = {}) => ({
    id: CONTENT,
    slug: "a-build",
    status: "approved",
    visibility: "public",
    creator_id: OWNER,
    updated_at: "2026-01-02T00:00:00Z",
    ai_pdf_url: null,
    ai_pdf_generated_at: null,
    canonical_export_payload: { title: "A build" },
    ...over,
  });
  const setup = (row: ReturnType<typeof post> | null = post()) => {
    const upload = vi.fn(async (_path: string, _bytes: Uint8Array) => "https://storage.test/x.pdf");
    const saveUrl = vi.fn(async (_id: string, _url: string) => undefined);
    const handler = createPdf({
      getUser: users,
      getPost: async () => row,
      getReblog: async () => null,
      buildPdf: async () => new Uint8Array([1]),
      buildReblogPdf: async () => new Uint8Array([2]),
      upload,
      saveUrl,
    });
    return { upload, saveUrl, handler };
  };

  it("makes a PDF for a public approved post, signed in or not", async () => {
    const { handler, upload } = setup();
    const response = await handler(request({ postId: CONTENT }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://storage.test/x.pdf", cached: false });
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("refuses a draft, a post not approved and a private post to anyone but its owner", async () => {
    for (const over of [{ status: "pending" }, { status: "draft" }, { visibility: "private" }, { visibility: "unlisted" }]) {
      for (const headers of [{}, signedIn("other-token")]) {
        const { handler, upload } = setup(post(over));
        const response = await handler(request({ postId: CONTENT }, headers));
        expect(response.status, JSON.stringify(over)).toBe(404);
        expect(upload).not.toHaveBeenCalled();
      }
    }
  });

  it("serves no cached address for a post the caller may not see", async () => {
    const { handler } = setup(post({ visibility: "private", ai_pdf_url: "https://storage.test/old.pdf", ai_pdf_generated_at: "2026-02-01T00:00:00Z" }));
    const response = await handler(request({ postId: CONTENT }, signedIn("other-token")));
    expect(response.status).toBe(404);
    expect(JSON.stringify(await response.json())).not.toContain("old.pdf");
  });

  it("makes a PDF of the owner's own private post and does not store its address on the row", async () => {
    const { handler, upload, saveUrl } = setup(post({ visibility: "private", status: "draft" }));
    const response = await handler(request({ postId: CONTENT }, signedIn()));
    expect(response.status).toBe(200);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(saveUrl).not.toHaveBeenCalled();
  });

  it("names a missing postId", async () => {
    const { handler } = setup();
    const response = await handler(request({}));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/^postId:/);
  });
});

describe("CA-29 P4: import-github-readme", () => {
  const readme = { content: btoa("# Title\n\nA line.\n\nBody") };
  const setup = () => {
    const fetchJson = vi.fn(async (_url: string) => ({ status: 200, body: readme as unknown }));
    return { fetchJson, handler: createReadme({ fetchJson }) };
  };

  it("fetches only api.github.com", async () => {
    const { handler, fetchJson } = setup();
    const response = await handler(request({ url: "https://github.com/owner/repo" }));
    expect(response.status).toBe(200);
    expect(fetchJson).toHaveBeenCalledWith("https://api.github.com/repos/owner/repo/readme");
    const file = await handler(request({ url: "https://github.com/owner/repo/blob/main/docs/a b.md" }));
    expect(file.status).toBe(200);
    expect(new URL(fetchJson.mock.calls[1][0]).hostname).toBe("api.github.com");
  });

  it("refuses any other address", async () => {
    for (const url of [
      "https://evil.example/github.com/owner/repo",
      "https://evil.example/?u=github.com/owner/repo",
      "http://github.com/owner/repo",
      "https://github.com.evil.example/owner/repo",
      "https://api.github.com/user",
      "https://github.com/owner",
      "file:///etc/passwd",
    ]) {
      const { handler, fetchJson } = setup();
      const response = await handler(request({ url }));
      expect(response.status, url).toBe(400);
      expect(fetchJson, url).not.toHaveBeenCalled();
    }
  });

  it("cannot be walked out of /repos by dots in the path", async () => {
    for (const url of ["https://github.com/owner/repo/blob/main/../../../user", "https://github.com/owner/repo/blob/main/%2e%2e/%2e%2e/x", "https://github.com/owner/repo/blob/main/a/..%2f..%2fuser"]) {
      const { handler, fetchJson } = setup();
      await handler(request({ url }));
      for (const [fetched] of fetchJson.mock.calls) {
        const parsed = new URL(fetched);
        expect(parsed.hostname, url).toBe("api.github.com");
        expect(parsed.pathname.startsWith("/repos/"), url).toBe(true);
      }
    }
  });

  it("names a missing url and does not repeat GitHub's own error text", async () => {
    const { handler } = setup();
    expect((await (await handler(request({}))).json()).error).toMatch(/^url:/);
    const failing = createReadme({ fetchJson: async () => ({ status: 500, body: "internal github detail" }) });
    const response = await failing(request({ url: "https://github.com/owner/repo" }));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("internal github detail");
  });
});

describe("CA-29 P4: public reads use the public key", () => {
  for (const name of ["post-json", "sitemap-xml"]) {
    it(`${name} reads with the public key, so the database's own rules apply`, () => {
      const source = readFileSync(join("supabase", "functions", name, "index.ts"), "utf8");
      expect(source).toContain("SUPABASE_ANON_KEY");
      expect(source).not.toContain("SERVICE_ROLE");
    });
  }
});

describe("CA-29 P4: config.toml", () => {
  const config = readFileSync(join("supabase", "config.toml"), "utf8");
  const verifyJwt = (name: string) => {
    const block = config.split(/^\[/m).find((part) => part.startsWith(`functions.${name}]`)) ?? "";
    return /^verify_jwt\s*=\s*(true|false)/m.exec(block)?.[1];
  };

  it("asks the gateway for a key on every function that now checks a caller", () => {
    for (const name of ["notify-version-update", "create-split-checkout-session", "create-pwyw-checkout-session", "generate-ai-pdf", "import-github-readme"]) {
      expect(verifyJwt(name), name).toBe("true");
    }
  });

  it("leaves open only the public reads, the cron job behind its secret and the connector", () => {
    const open = [...config.matchAll(/^\[functions\.([\w-]+)\]/gm)].map((m) => m[1]).filter((name) => verifyJwt(name) === "false");
    expect(open.sort()).toEqual(["check-compatibility-status", "mcp", "post-json", "public-api", "sitemap-xml"]);
  });
});
