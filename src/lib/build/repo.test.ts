// Acceptance cover for the repository URL intake (NS-P21), client half.
//
// What a type checker cannot see: that this module's URL detection agrees with
// parse-repo's own — a URL the client accepts must be one the function accepts,
// or a creator is routed somewhere that cannot read it — and that applying a
// proposal's header facts never overwrites what a creator already had.

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above every const, so the doubles have to be too.
const { invoke, updateBuild, getBuildHeader } = vi.hoisted(() => ({
  invoke: vi.fn(),
  updateBuild: vi.fn(),
  getBuildHeader: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
vi.mock("@/lib/build/builds", () => ({ getBuildHeader, updateBuild }));

import {
  applyRepoHeader,
  isRepoUrl,
  parseRepoUrl,
  repoUrlComplaint,
  requestRepoProposal,
  type RepoProposal,
} from "@/lib/build/repo";
// The function's own reader. If these two ever disagree, the routing is broken.
import { parseRepoUrl as serverParseRepoUrl } from "../../../supabase/functions/parse-repo/github.ts";

const BUILD_ID = "9f6b1a2c-4d3e-4f5a-8b7c-1d2e3f4a5b6c";

function proposalOf(madeWith: string[]): RepoProposal {
  return {
    events: [],
    nodes: [],
    warnings: [],
    summary: {
      session_id: "s",
      source_hint: null,
      detected_format: "github-repo",
      detected_labels: { user: [], assistant: [] },
      turn_count: 0,
      user_turn_count: 0,
      assistant_turn_count: 0,
      event_count: 0,
      node_count: 0,
      character_count: 0,
      line_count: 0,
      proposed_title: null,
      proposed_outcome: null,
      proposed_made_with: madeWith.map((value) => ({
        value,
        source_ref: { source: "repo", session_id: "s", index: 1 },
        inferred: true,
        inferred_reason: "a dependency",
      })),
    },
  } as RepoProposal;
}

beforeEach(() => {
  invoke.mockReset();
  updateBuild.mockReset();
  getBuildHeader.mockReset();
});

describe("recognising a repository URL", () => {
  it("agrees with parse-repo's own reader on every shape", () => {
    const urls = [
      "https://github.com/acme/widget-factory",
      "https://github.com/acme/widget-factory/",
      "http://github.com/acme/widget-factory",
      "https://www.github.com/acme/widget-factory",
      "github.com/acme/widget-factory",
      "https://github.com/acme/widget-factory.git",
      "https://github.com/acme/widget-factory/tree/main/src",
      "https://github.com/acme/widget-factory#readme",
      "https://gitlab.com/acme/widget",
      "https://github.com/acme",
      "https://github.com/features/actions",
      "not a url at all",
      "",
    ];

    // The client is the function's mirror, not a second opinion.
    for (const url of urls) {
      expect(parseRepoUrl(url), url).toEqual(serverParseRepoUrl(url));
    }
  });

  it("reads owner and repo out of a repository URL", () => {
    expect(parseRepoUrl("https://github.com/acme/widget-factory")).toEqual({
      owner: "acme",
      repo: "widget-factory",
    });
    expect(isRepoUrl("https://github.com/acme/widget-factory")).toBe(true);
    expect(isRepoUrl("https://gitlab.com/acme/widget")).toBe(false);
  });

  it("says something different for each way a URL can be wrong", () => {
    expect(repoUrlComplaint("")).toMatch(/Paste a repository URL/);
    expect(repoUrlComplaint("https://gitlab.com/acme/widget")).toMatch(/Only GitHub/);
    expect(repoUrlComplaint("https://github.com/features/actions")).toMatch(/not a repository one/);
    expect(repoUrlComplaint("banana")).toMatch(/not a GitHub repository URL/);
  });
});

describe("calling the parser", () => {
  it("sends repo_url and build_id, and returns the envelope", async () => {
    invoke.mockResolvedValue({ data: proposalOf([]), error: null });

    const proposal = await requestRepoProposal(BUILD_ID, "https://github.com/acme/widget", "acme/widget");

    expect(invoke).toHaveBeenCalledWith("parse-repo", {
      body: {
        repo_url: "https://github.com/acme/widget",
        build_id: BUILD_ID,
        source_hint: "acme/widget",
      },
    });
    expect(proposal.summary.detected_format).toBe("github-repo");
    expect(proposal.events).toEqual([]);
  });

  it("surfaces the function's own sentence rather than the generic non-2xx one", async () => {
    // What a private repository actually looks like coming back through
    // supabase-js: the message is useless and the body carries the answer.
    invoke.mockResolvedValue({
      data: null,
      error: {
        message: "Edge Function returned a non-2xx status code",
        context: {
          json: async () => ({
            error: "acme/secret is private, does not exist, or has been renamed.",
          }),
        },
      },
    });

    await expect(requestRepoProposal(BUILD_ID, "https://github.com/acme/secret")).rejects.toThrow(
      /private, does not exist, or has been renamed/,
    );
  });

  it("rejects a response this version does not understand", async () => {
    invoke.mockResolvedValue({ data: { nonsense: true }, error: null });
    await expect(requestRepoProposal(BUILD_ID, "https://github.com/acme/widget")).rejects.toThrow(
      /does not understand/,
    );
  });
});

describe("applying the header a repo intake establishes", () => {
  it("sets repo_url and merges made_with on a fresh draft", async () => {
    getBuildHeader.mockResolvedValue({ id: BUILD_ID, repo_url: null, made_with: [] });
    updateBuild.mockResolvedValue({});

    const applied = await applyRepoHeader(
      BUILD_ID,
      proposalOf(["Anthropic API", "OpenAI"]),
      "https://github.com/acme/widget",
    );

    expect(applied).toEqual({ repoUrlSet: true, madeWithAdded: ["Anthropic API", "OpenAI"] });
    expect(updateBuild).toHaveBeenCalledWith(BUILD_ID, {
      repo_url: "https://github.com/acme/widget",
      made_with: ["Anthropic API", "OpenAI"],
    });
  });

  it("never overwrites a repository the creator already recorded", async () => {
    getBuildHeader.mockResolvedValue({
      id: BUILD_ID,
      repo_url: "https://github.com/acme/the-real-one",
      made_with: [],
    });
    updateBuild.mockResolvedValue({});

    const applied = await applyRepoHeader(BUILD_ID, proposalOf(["OpenAI"]), "https://github.com/acme/widget");

    expect(applied.repoUrlSet).toBe(false);
    expect(updateBuild).toHaveBeenCalledWith(BUILD_ID, { made_with: ["OpenAI"] });
  });

  it("merges beside what a creator typed, case-insensitively, without duplicating", async () => {
    getBuildHeader.mockResolvedValue({ id: BUILD_ID, repo_url: null, made_with: ["Claude", "openai"] });
    updateBuild.mockResolvedValue({});

    const applied = await applyRepoHeader(
      BUILD_ID,
      proposalOf(["OpenAI", "Anthropic API"]),
      "https://github.com/acme/widget",
    );

    // "openai" was already there under the creator's own spelling. Theirs wins.
    expect(applied.madeWithAdded).toEqual(["Anthropic API"]);
    expect(updateBuild).toHaveBeenCalledWith(BUILD_ID, {
      repo_url: "https://github.com/acme/widget",
      made_with: ["Claude", "openai", "Anthropic API"],
    });
  });

  it("writes nothing at all when there is nothing to add", async () => {
    getBuildHeader.mockResolvedValue({
      id: BUILD_ID,
      repo_url: "https://github.com/acme/widget",
      made_with: ["OpenAI"],
    });

    const applied = await applyRepoHeader(BUILD_ID, proposalOf(["OpenAI"]), "https://github.com/acme/widget");

    expect(applied).toEqual({ repoUrlSet: false, madeWithAdded: [] });
    expect(updateBuild).not.toHaveBeenCalled();
  });

  it("does nothing for a proposal from a parser that proposes no made_with", async () => {
    getBuildHeader.mockResolvedValue({ id: BUILD_ID, repo_url: null, made_with: [] });
    updateBuild.mockResolvedValue({});

    // parse-transcript and parse-lovable never set the field. Neither changed.
    const proposal = proposalOf([]);
    delete (proposal.summary as { proposed_made_with?: unknown }).proposed_made_with;

    const applied = await applyRepoHeader(BUILD_ID, proposal, "https://github.com/acme/widget");
    expect(applied.madeWithAdded).toEqual([]);
    expect(updateBuild).toHaveBeenCalledWith(BUILD_ID, { repo_url: "https://github.com/acme/widget" });
  });
});
