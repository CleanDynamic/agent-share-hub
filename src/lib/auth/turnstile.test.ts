// G6, G8, G9: the invisible Turnstile widget. Cloudflare's script is replaced by a fake `window.turnstile`, so what is
// claimed is how the module drives it: one hidden host outside the layout, the token handed over, a reset after use,
// a failure reported as a failure, and the site key read from VITE_TURNSTILE_SITE_KEY.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Options = { sitekey: string; callback: (token: string) => void; "error-callback": () => boolean; "expired-callback": () => void };

const api = {
  render: vi.fn<(host: HTMLElement, options: Options) => string>(),
  reset: vi.fn(),
  remove: vi.fn(),
};
let options: Options;

async function load() {
  vi.resetModules();
  return import("./turnstile");
}

/** The module's script tag "loads": the fake api appears and onload fires. */
function scriptLoads() {
  (window as unknown as { turnstile: typeof api }).turnstile = api;
  document.querySelector<HTMLScriptElement>("script[data-turnstile]")?.onload?.(new Event("load"));
}

beforeEach(() => {
  api.render.mockReset().mockImplementation((_host, opts) => {
    options = opts;
    return "w-1";
  });
  api.reset.mockReset();
  api.remove.mockReset();
  delete (window as unknown as { turnstile?: unknown }).turnstile;
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the site key (G8)", () => {
  it("comes from VITE_TURNSTILE_SITE_KEY", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0x-site-key-from-env");
    const { turnstileSiteKey } = await load();
    expect(turnstileSiteKey()).toBe("0x-site-key-from-env");
  });

  it("is Cloudflare's always-pass invisible test key in development when unset, and the console says so once", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("DEV", true);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { turnstileSiteKey, TEST_SITE_KEY } = await load();
    expect(TEST_SITE_KEY).toBe("1x00000000000000000000BB");
    expect(turnstileSiteKey()).toBe(TEST_SITE_KEY);
    expect(turnstileSiteKey()).toBe(TEST_SITE_KEY);
    expect(info).toHaveBeenCalledTimes(1);
  });

  it("is absent in production when unset, so no widget is drawn and the server decides", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("DEV", false);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { turnstileSiteKey, createInvisibleCaptcha } = await load();
    expect(turnstileSiteKey()).toBeNull();
    const captcha = createInvisibleCaptcha();
    await expect(captcha.token()).resolves.toEqual({ token: undefined, failed: false });
    expect(document.querySelector("script[data-turnstile]")).toBeNull();
  });
});

describe("createInvisibleCaptcha", () => {
  beforeEach(() => vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0x-site-key"));

  it("G9: renders into one hidden host outside the layout: fixed, 0 by 0, nothing to animate", async () => {
    const { createInvisibleCaptcha } = await load();
    createInvisibleCaptcha();
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    const host = api.render.mock.calls[0][0];
    expect(host.parentElement).toBe(document.body);
    expect(host.getAttribute("aria-hidden")).toBe("true");
    expect(host.style.position).toBe("fixed");
    expect(host.style.width).toBe("0px");
    expect(host.style.height).toBe("0px");
    expect(host.style.overflow).toBe("hidden");
    expect(options.sitekey).toBe("0x-site-key");
    // One script, from Cloudflare, rendered explicitly.
    const scripts = document.querySelectorAll("script[data-turnstile]");
    expect(scripts).toHaveLength(1);
    expect((scripts[0] as HTMLScriptElement).src).toBe("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit");
  });

  it("G6: hands over the token the widget produced, waiting for it if need be", async () => {
    const { createInvisibleCaptcha } = await load();
    const captcha = createInvisibleCaptcha();
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    const pending = captcha.token();
    options.callback("tok-1");
    await expect(pending).resolves.toEqual({ token: "tok-1", failed: false });
    await expect(captcha.token()).resolves.toEqual({ token: "tok-1", failed: false });
  });

  it("G6: reset forgets the spent token and asks the widget for a new one", async () => {
    const { createInvisibleCaptcha } = await load();
    const captcha = createInvisibleCaptcha();
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    options.callback("tok-1");
    captcha.reset();
    expect(api.reset).toHaveBeenCalledWith("w-1");
    const next = captcha.token();
    options.callback("tok-2");
    await expect(next).resolves.toEqual({ token: "tok-2", failed: false });
  });

  it("reports a widget error as a failure, and a reset tries again", async () => {
    const { createInvisibleCaptcha } = await load();
    const captcha = createInvisibleCaptcha();
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    const pending = captcha.token();
    options["error-callback"]();
    await expect(pending).resolves.toEqual({ token: undefined, failed: true });
    captcha.reset();
    const next = captcha.token();
    options.callback("tok-3");
    await expect(next).resolves.toEqual({ token: "tok-3", failed: false });
  });

  it("forgets an expired token", async () => {
    const { createInvisibleCaptcha } = await load();
    const captcha = createInvisibleCaptcha();
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    options.callback("tok-1");
    options["expired-callback"]();
    const next = captcha.token();
    options.callback("tok-4");
    await expect(next).resolves.toEqual({ token: "tok-4", failed: false });
  });

  it("gives up after 10 seconds with no token, as a failure", async () => {
    vi.useFakeTimers();
    const { createInvisibleCaptcha } = await load();
    const captcha = createInvisibleCaptcha();
    const pending = captcha.token();
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toEqual({ token: undefined, failed: true });
  });

  it("loads Cloudflare's script once for any number of widgets, and remove takes its widget and host away", async () => {
    const { createInvisibleCaptcha } = await load();
    const a = createInvisibleCaptcha();
    createInvisibleCaptcha();
    expect(document.querySelectorAll("script[data-turnstile]")).toHaveLength(1);
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalledTimes(2));
    const host = api.render.mock.calls[0][0];
    a.remove();
    expect(api.remove).toHaveBeenCalledWith("w-1");
    expect(host.isConnected).toBe(false);
  });
});

describe("oneShotCaptchaToken", () => {
  it("draws a widget, takes its token, and removes it", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "0x-site-key");
    const { oneShotCaptchaToken } = await load();
    const pending = oneShotCaptchaToken();
    scriptLoads();
    await vi.waitFor(() => expect(api.render).toHaveBeenCalled());
    options.callback("tok-once");
    await expect(pending).resolves.toEqual({ token: "tok-once", failed: false });
    expect(api.remove).toHaveBeenCalledWith("w-1");
  });
});
