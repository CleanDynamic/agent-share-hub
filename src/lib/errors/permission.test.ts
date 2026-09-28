import { describe, expect, it } from "vitest";

import { isPermissionError } from "@/lib/errors/permission";

function wrapped(cause: unknown): Error {
  const error = new Error("listGallery failed: permission denied for table builds");
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

describe("isPermissionError", () => {
  it("reads Postgres 42501 on the cause the data layer wraps", () => {
    expect(isPermissionError(wrapped({ code: "42501", message: "permission denied" }))).toBe(true);
  });

  it("reads PostgREST's refusals of a token or of anonymous access", () => {
    expect(isPermissionError({ code: "PGRST301" })).toBe(true);
    expect(isPermissionError({ code: "PGRST302" })).toBe(true);
  });

  it("reads an HTTP 401 or 403", () => {
    expect(isPermissionError({ status: 401 })).toBe(true);
    expect(isPermissionError(wrapped({ status: 403 }))).toBe(true);
  });

  it("reads a code the search functions kept without the query", () => {
    expect(isPermissionError(new Error("searchBuildIds failed: code 42501"))).toBe(true);
  });

  it("does not read other failures as refusals", () => {
    expect(isPermissionError(wrapped({ code: "PGRST116", message: "no rows" }))).toBe(false);
    expect(isPermissionError(new Error("searchBuildIds failed: code 57014"))).toBe(false);
    expect(isPermissionError({ status: 500 })).toBe(false);
    expect(isPermissionError(null)).toBe(false);
    expect(isPermissionError("42501")).toBe(false);
  });
});
