// CA-15 P9: the readers, the URL parser, the licence line and the GitHub fetch of the three source tiles.

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  datasetOf,
  fetchRepoFacts,
  firstSecretLine,
  forgetRetrieved,
  isPossiblyUnmaintained,
  licenceLine,
  looksLikeSecret,
  parseRepoUrl,
  repoDay,
  repoOf,
  scopeOf,
  scopeValue,
  systemPromptOf,
} from "./sourceTiles";
import { cleanExtras } from "./tileExtras";

describe("a system prompt's scope", () => {
  it("is stored as all, session:<key> or prompts:<id,id>, and read back the same", () => {
    expect(scopeValue({ kind: "all" })).toBe("all");
    expect(scopeValue({ kind: "session", key: "s1" })).toBe("session:s1");
    expect(scopeValue({ kind: "prompts", ids: ["a", "b"] })).toBe("prompts:a,b");
    expect(scopeOf("session:s1")).toEqual({ kind: "session", key: "s1" });
    expect(scopeOf("prompts:a, b,a")).toEqual({ kind: "prompts", ids: ["a", "b"] });
  });

  it("reads anything else as all prompts", () => {
    for (const raw of [undefined, null, 4, "", "everything", "session:", "prompts:"]) expect(scopeOf(raw)).toEqual({ kind: "all" });
  });

  it("reads the text, scope and version, and a version that is absent as null", () => {
    expect(systemPromptOf({ text: " Be brief ", scope: "all" })).toEqual({ text: "Be brief", scope: { kind: "all" }, version: null });
    expect(systemPromptOf({ text: "x", version: "v2" }).version).toBe("v2");
  });
});

describe("a dataset read from its payload", () => {
  it("reads what is given and leaves the rest null or empty", () => {
    expect(datasetOf({ description: "Orders" })).toEqual({ description: "Orders", use: null, format: null, recordCount: null, columns: [], source: null, sample: [], licence: null, chunkStrategy: null, chunkSize: null, chunkOverlap: null, embeddingModel: null });
  });

  it("reads a known use, a whole record count, columns and a sample, and drops what is not valid", () => {
    const facts = datasetOf({ description: "d", use: "retrieval", record_count: 1200, columns: ["id", " ", "total"], sample: ["a,b"], chunk_size: 512, chunk_overlap: -1 });
    expect(facts).toMatchObject({ use: "retrieval", recordCount: 1200, columns: ["id", "total"], sample: ["a,b"], chunkSize: 512, chunkOverlap: null });
    expect(datasetOf({ description: "d", use: "mining", record_count: 1.5 })).toMatchObject({ use: null, recordCount: null });
  });
});

describe("parseRepoUrl", () => {
  it("takes github.com/owner/name with or without the scheme, www, a trailing slash or .git", () => {
    const same = { owner: "acme", name: "shop", url: "https://github.com/acme/shop" };
    for (const raw of ["github.com/acme/shop", "https://github.com/acme/shop", "http://www.github.com/acme/shop/", "https://github.com/acme/shop.git", " github.com/acme/shop?tab=readme "]) expect(parseRepoUrl(raw)).toEqual(same);
  });

  it("refuses anything that is not a repository address", () => {
    for (const raw of ["", null, "github.com/acme", "gitlab.com/acme/shop", "https://github.com/acme/shop/issues", "github.com/-bad/shop", "github.com/acme/..", "not a url"]) expect(parseRepoUrl(raw)).toBeNull();
  });
});

describe("the licence line", () => {
  it("says reuse is permitted only for the permissive licences", () => {
    expect(licenceLine("MIT")).toEqual({ text: "MIT", reuse: "reuse permitted" });
    expect(licenceLine("Apache-2.0").reuse).toBe("reuse permitted");
  });

  it("says no licence means reuse is not granted, and names any other licence plainly", () => {
    expect(licenceLine(null)).toEqual({ text: "No licence · reuse not granted", reuse: null });
    expect(licenceLine("GPL-3.0", "GNU General Public License v3.0")).toEqual({ text: "GNU General Public License v3.0", reuse: null });
    expect(licenceLine("NOASSERTION")).toEqual({ text: "Other licence", reuse: null });
  });
});

describe("possibly unmaintained", () => {
  const now = new Date("2026-10-22T00:00:00Z");
  it("is a last push more than twelve months before now", () => {
    expect(isPossiblyUnmaintained("2025-10-21T00:00:00Z", now)).toBe(true);
    expect(isPossiblyUnmaintained("2025-10-23T00:00:00Z", now)).toBe(false);
    expect(isPossiblyUnmaintained(null, now)).toBe(false);
    expect(isPossiblyUnmaintained("garbage", now)).toBe(false);
  });
});

describe("repoDay", () => {
  it("writes a date as 7 Oct 2026, and nothing for what is not a date", () => {
    expect(repoDay("2026-10-07T09:00:00Z")).toBe("7 Oct 2026");
    expect(repoDay("soon")).toBe("");
    expect(repoDay(undefined)).toBe("");
  });
});

describe("repoOf", () => {
  it("is null without a valid URL", () => {
    expect(repoOf({})).toBeNull();
    expect(repoOf({ url: "example.com" })).toBeNull();
  });

  it("reads the URL alone as a valid tile, with everything else absent", () => {
    expect(repoOf({ url: "github.com/acme/shop" })).toMatchObject({ owner: "acme", name: "shop", ownership: null, usage: [], run: [], pin: null, fetched: { stars: null, fetchedAt: null } });
  });

  it("reads what GitHub said, what the maker said, a pin, and drops values it does not know", () => {
    const facts = repoOf({ url: "github.com/acme/shop", ownership: "third_party", stars: 42, licence_spdx: "MIT", fetched_at: "2026-10-07T09:00:00Z", usage: ["copied", "nonsense", "dependency"], pin: { kind: "tag", value: "v1.2" }, run: ["npm ci"], visibility: "secret" });
    expect(facts).toMatchObject({ ownership: "third_party", fetched: { stars: 42, licenceSpdx: "MIT" }, usage: ["dependency", "copied"], pin: { kind: "tag", value: "v1.2" }, run: ["npm ci"], visibility: null });
  });
});

describe("a run instruction that looks like a secret", () => {
  it("is caught for a long value after an equals sign and for well-known key prefixes", () => {
    expect(looksLikeSecret("export GITHUB_TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123")).toBe(true);
    expect(looksLikeSecret("API_KEY=abcdefghijklmnopqrstuvwxyz")).toBe(true);
    expect(looksLikeSecret("curl -H sk-abcdefghijklmnopqrstuvwxyz")).toBe(true);
  });

  it("lets a command that only names an environment variable through", () => {
    expect(looksLikeSecret("export GITHUB_TOKEN=$GITHUB_TOKEN")).toBe(false);
    expect(looksLikeSecret("npm run build")).toBe(false);
    expect(firstSecretLine("npm ci\nAPI_KEY=abcdefghijklmnopqrstuvwxyz\nnpm start")).toBe("API_KEY=abcdefghijklmnopqrstuvwxyz");
    expect(firstSecretLine("npm ci\nnpm start")).toBeNull();
  });

  it("is refused by the repo cleaners, without echoing the value", () => {
    expect(() => cleanExtras("repo", { run: ["API_KEY=abcdefghijklmnopqrstuvwxyz"] })).toThrow("A run instruction looks as if it holds a key's value. Name the key instead, for example GITHUB_TOKEN.");
    try {
      cleanExtras("repo", { run: ["API_KEY=abcdefghijklmnopqrstuvwxyz"] });
    } catch (cause) {
      expect((cause as Error).message).not.toContain("abcdefghijklmnopqrstuvwxyz");
    }
    expect(cleanExtras("repo", { run: ["npm ci", "npm start"] })).toEqual({ run: ["npm ci", "npm start"] });
  });
});

describe("fetchRepoFacts", () => {
  beforeEach(forgetRetrieved);

  const reply = (body: unknown, ok = true) => vi.fn().mockResolvedValue({ ok, json: async () => body });

  it("asks GitHub's public API once, unauthenticated, and keeps the facts it gives", async () => {
    const fetcher = reply({ stargazers_count: 1500, default_branch: "main", language: "TypeScript", license: { spdx_id: "MIT", name: "MIT License" }, pushed_at: "2026-09-01T00:00:00Z" });
    const facts = await fetchRepoFacts("acme", "shop", fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledWith("https://api.github.com/repos/acme/shop", { headers: { Accept: "application/vnd.github+json" } });
    expect(facts).toMatchObject({ stars: 1500, defaultBranch: "main", language: "TypeScript", licenceSpdx: "MIT", licenceName: "MIT License", pushedAt: "2026-09-01T00:00:00Z" });
    expect(Number.isNaN(Date.parse(facts?.fetchedAt ?? ""))).toBe(false);
    await fetchRepoFacts("ACME", "Shop", fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("is null, once, when GitHub says no, the network fails or the reply is not an object", async () => {
    expect(await fetchRepoFacts("a", "missing", reply({}, false) as unknown as typeof fetch)).toBeNull();
    expect(await fetchRepoFacts("a", "down", vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch)).toBeNull();
    expect(await fetchRepoFacts("a", "odd", reply([1]) as unknown as typeof fetch)).toBeNull();
  });
});
