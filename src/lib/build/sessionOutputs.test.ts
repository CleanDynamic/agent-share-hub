// SV-30 P7: output links.

import { describe, expect, it } from "vitest";

import { extrasOf, extrasRefusal, sessionFactsLine } from "./sessionFacts";
import { outputRow, outputsCountLine, outputsOf, outputsRefusal } from "./sessionOutputs";

const commit = (sha: string) => ({ kind: "commit" as const, repo: "https://github.com/acme/app", sha });

describe("SV-30 P7: output links", () => {
  it("refuses a short or non-hex SHA, and a non-https address", () => {
    expect(outputsRefusal([commit("abc12")])).toBe("A commit SHA is 7 to 40 hex characters.");
    expect(outputsRefusal([commit("zzzzzzz")])).toBe("A commit SHA is 7 to 40 hex characters.");
    expect(outputsRefusal([commit("a".repeat(41))])).toBe("A commit SHA is 7 to 40 hex characters.");
    expect(outputsRefusal([{ kind: "pull_request", url: "http://github.com/acme/app/pull/1" }])).toBe("A link starts with https://.");
    expect(outputsRefusal([commit("abc1234"), commit("a".repeat(40)), { kind: "ticket", url: "https://linear.app/acme/issue/A-1" }])).toBeNull();
    expect(extrasRefusal({ outputs: [commit("abc12")] })).toBe("A commit SHA is 7 to 40 hex characters.");
  });
  it("refuses more than 20", () => {
    expect(outputsRefusal(Array.from({ length: 21 }, () => commit("abc1234")))).toBe("Output links: 20 max");
  });
  it("reads only whole entries and says the counts", () => {
    const stored = [commit("ABC1234"), commit("def5678"), commit("0123456"), { kind: "pull_request", url: "https://github.com/acme/app/pull/9" }, { kind: "deployment", url: "javascript:1" }, { kind: "commit", repo: "", sha: "abc1234" }];
    const outputs = outputsOf(stored);
    expect(outputs).toHaveLength(4);
    expect(outputs[0]).toMatchObject({ sha: "abc1234" });
    expect(outputsCountLine(outputs)).toBe("3 commits · 1 pull request");
    expect(outputsCountLine([])).toBeNull();
  });
  it("shows readers the count only when Show readers is ticked, and the maker always", () => {
    const outputs = [commit("abc1234"), { kind: "pull_request" as const, url: "https://github.com/acme/app/pull/9" }];
    expect(sessionFactsLine({ extras: { outputs } }, "maker")).toBe("1 commit · 1 pull request");
    expect(sessionFactsLine({ extras: { outputs } }, "reader")).toBeNull();
    expect(sessionFactsLine({ extras: { outputs, showOutputs: true } }, "reader")).toBe("1 commit · 1 pull request");
    expect(extrasOf({ outputs, showOutputs: true })).toEqual({ outputs, showOutputs: true });
  });
  it("points a commit at its repository's commit page and a link at itself", () => {
    expect(outputRow(commit("abc1234def"))).toEqual({ label: "Commit abc1234 in acme/app", href: "https://github.com/acme/app/commit/abc1234def" });
    expect(outputRow({ kind: "commit", repo: "acme/app", sha: "abc1234" })).toEqual({ label: "Commit abc1234 in acme/app", href: null });
    expect(outputRow({ kind: "pull_request", url: "https://github.com/acme/app/pull/9" }).label).toBe("Pull request · github.com");
  });
});
