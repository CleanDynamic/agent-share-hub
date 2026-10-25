// CA-29 Part 7. One place errors are reported: the last 50 are kept in memory,
// development prints them, and Sentry gets them only when a DSN is set.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({ loaded: vi.fn(), init: vi.fn(), captureException: vi.fn() }));
vi.mock("@sentry/react", () => {
  sentry.loaded();
  return { init: sentry.init, captureException: sentry.captureException };
});

type Report = typeof import("@/lib/errors/report");
let recentErrors: Report["recentErrors"];
let reportError: Report["reportError"];

describe("CA-29 P7: reportError", () => {
  beforeEach(async () => {
    // A fresh module each time: Sentry is started once per page, so a test starts a page.
    vi.resetModules();
    ({ recentErrors, reportError } = await import("@/lib/errors/report"));
    sentry.loaded.mockClear();
    sentry.init.mockClear();
    sentry.captureException.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("keeps what it was told: the kind of error, its code and where it happened, and never its message", () => {
    const error = Object.assign(new TypeError("could not read: the maker's prompt text"), { code: "42501" });
    reportError(error, { source: "query", route: "/builds" });
    const [entry] = recentErrors();
    expect(entry).toMatchObject({ name: "TypeError", code: "42501", context: { source: "query", route: "/builds" } });
    expect(JSON.stringify(recentErrors())).not.toContain("prompt text");
  });

  it("keeps the last 50", () => {
    for (let i = 0; i < 60; i += 1) reportError(new Error(`e${i}`), { source: "query", route: `/${i}` });
    const kept = recentErrors();
    expect(kept).toHaveLength(50);
    expect(kept[0].context.route).toBe("/10");
    expect(kept[49].context.route).toBe("/59");
  });

  it("reports something that is not an Error", () => {
    reportError("a string", { source: "window.error" });
    reportError(undefined, { source: "unhandledrejection" });
    expect(recentErrors().map((entry) => entry.name)).toEqual(["string", "undefined"]);
  });

  it("never throws, whatever it is given", () => {
    const hostile = { get name(): string { throw new Error("no"); } };
    expect(() => reportError(hostile, { source: "query" })).not.toThrow();
  });

  it("requests no Sentry code when no DSN is set", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    reportError(new Error("x"), { source: "query" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sentry.loaded).not.toHaveBeenCalled();
    expect(sentry.init).not.toHaveBeenCalled();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("sends Sentry a scrubbed copy when a DSN is set: the kind, the code and identifiers, not the message", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@example.ingest.sentry.io/1");
    const error = Object.assign(new Error("secret prompt text"), { code: "PGRST301" });
    reportError(error, { source: "boundary", boundary: "route", route: "/b2/slug" });
    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledTimes(1));

    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = sentry.init.mock.calls[0][0];
    expect(options.dsn).toBe("https://key@example.ingest.sentry.io/1");
    expect(options.dataCollection).toEqual({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false });

    const [sent, hint] = sentry.captureException.mock.calls[0];
    expect(String(sent.message)).not.toContain("secret prompt text");
    expect(String(sent.stack)).not.toContain("secret prompt text");
    expect(sent.name).toBe("Error");
    expect(hint.tags).toMatchObject({ source: "boundary", boundary: "route", route: "/b2/slug", code: "PGRST301" });
  });

  it("starts Sentry once however many errors follow", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@example.ingest.sentry.io/1");
    reportError(new Error("a"), { source: "query" });
    reportError(new Error("b"), { source: "query" });
    await vi.waitFor(() => expect(sentry.captureException).toHaveBeenCalledTimes(2));
    expect(sentry.init).toHaveBeenCalledTimes(1);
  });

  it("scrubs an event before it leaves: no message, no request, no breadcrumbs, no user", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://key@example.ingest.sentry.io/1");
    reportError(new Error("a"), { source: "query" });
    await vi.waitFor(() => expect(sentry.init).toHaveBeenCalled());
    const { beforeSend, beforeBreadcrumb } = sentry.init.mock.calls[0][0];
    const scrubbed = beforeSend({
      message: "prompt text",
      exception: { values: [{ type: "Error", value: "prompt text" }] },
      request: { url: "https://x/y", data: "body", cookies: { a: "b" }, headers: { Authorization: "Bearer t" } },
      breadcrumbs: [{ message: "m" }],
      user: { id: "u", email: "a@b" },
      extra: { payload: "x" },
    });
    expect(scrubbed.message).toBeUndefined();
    expect(scrubbed.exception.values[0].value).toBeUndefined();
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.user).toEqual({ id: "u" });
    expect(beforeBreadcrumb()).toBeNull();
  });
});
