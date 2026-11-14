/**
 * The bot check: one invisible Cloudflare Turnstile widget (G6 to G9).
 *
 * The widget is the invisible kind, set on the Cloudflare dashboard: it draws nothing, so it is rendered into a hidden
 * host on <body>, fixed and 0 by 0, outside every layout. Nothing moves when it runs and nothing animates.
 *
 * The token proves nothing in the browser. It is sent with the request, and the auth service checks it with
 * Cloudflare (CAPTCHA protection in the Supabase dashboard). A token is good for one request, so the caller resets the
 * widget after every submission, successful or not, and the widget makes the next one in the background.
 *
 * The site key comes from VITE_TURNSTILE_SITE_KEY. The secret is never in this repository: it lives in the Supabase
 * dashboard. With the variable unset in development, Cloudflare's published always-pass invisible test key is used and
 * the console says so once. Unset in production, no widget is drawn and requests go without a token, so the server's
 * setting decides.
 */
import { useEffect, useMemo, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
/** Cloudflare's published test site key: invisible, always passes. */
export const TEST_SITE_KEY = "1x00000000000000000000BB";
/** How long a caller waits for a token before treating the check as failed. */
const TOKEN_WAIT_MS = 10_000;

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => boolean;
  "expired-callback": () => void;
  "refresh-expired": "auto";
  retry: "auto";
}

interface TurnstileApi {
  render: (host: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

/** What a caller gets: a token, or a failed check. With no site key there is no check: no token and no failure. */
export interface CaptchaResult {
  token: string | undefined;
  failed: boolean;
}

export interface Captcha {
  /** The current token, waiting up to 10 seconds for one. */
  token: () => Promise<CaptchaResult>;
  /** Forget the spent token and make a new one. Call after every submission. */
  reset: () => void;
  /** Take the widget and its host away. */
  remove: () => void;
}

let told = false;

export function turnstileSiteKey(): string | null {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  if (key) return key;
  if (import.meta.env.DEV) {
    if (!told) {
      told = true;
      // eslint-disable-next-line no-console -- G8: the one line that says the test key is in use, asserted by its tests
      console.info("[turnstile] VITE_TURNSTILE_SITE_KEY is not set: using Cloudflare's always-pass test key.");
    }
    return TEST_SITE_KEY;
  }
  if (!told) {
    told = true;
    // eslint-disable-next-line no-console -- the one line that says production has no site key, asserted by its tests
    console.warn("[turnstile] VITE_TURNSTILE_SITE_KEY is not set: requests are sent without a bot-check token.");
  }
  return null;
}

let script: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const tag = document.createElement("script");
    tag.src = SCRIPT_SRC;
    tag.async = true;
    tag.dataset.turnstile = "";
    tag.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")));
    tag.onerror = () => {
      script = null;
      reject(new Error("turnstile script failed"));
    };
    document.head.appendChild(tag);
  });
  return script;
}

export function createInvisibleCaptcha(): Captcha {
  const sitekey = turnstileSiteKey();
  if (!sitekey) {
    return { token: async () => ({ token: undefined, failed: false }), reset: () => {}, remove: () => {} };
  }

  let current: string | undefined;
  let failed = false;
  let removed = false;
  let widgetId: string | null = null;
  let api: TurnstileApi | null = null;
  let waiting: Array<(result: CaptchaResult) => void> = [];

  const settle = (result: CaptchaResult) => {
    const callers = waiting;
    waiting = [];
    for (const answer of callers) answer(result);
  };

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.dataset.turnstileHost = "";
  Object.assign(host.style, { position: "fixed", left: "0", top: "0", width: "0", height: "0", overflow: "hidden" });
  document.body.appendChild(host);

  loadScript().then(
    (loaded) => {
      if (removed) return;
      api = loaded;
      widgetId = loaded.render(host, {
        sitekey,
        callback: (token) => {
          current = token;
          failed = false;
          settle({ token, failed: false });
        },
        "error-callback": () => {
          current = undefined;
          failed = true;
          settle({ token: undefined, failed: true });
          return true;
        },
        "expired-callback": () => {
          current = undefined;
        },
        "refresh-expired": "auto",
        retry: "auto",
      });
    },
    () => {
      failed = true;
      settle({ token: undefined, failed: true });
    },
  );

  return {
    token: () => {
      if (current) return Promise.resolve({ token: current, failed: false });
      if (failed || removed) return Promise.resolve({ token: undefined, failed: true });
      return new Promise<CaptchaResult>((resolve) => {
        const timer = setTimeout(() => {
          waiting = waiting.filter((answer) => answer !== done);
          resolve({ token: undefined, failed: true });
        }, TOKEN_WAIT_MS);
        const done = (result: CaptchaResult) => {
          clearTimeout(timer);
          resolve(result);
        };
        waiting.push(done);
      });
    },
    reset: () => {
      current = undefined;
      failed = false;
      if (api && widgetId) api.reset(widgetId);
    },
    remove: () => {
      removed = true;
      settle({ token: undefined, failed: true });
      if (api && widgetId) api.remove(widgetId);
      host.remove();
    },
  };
}

/** For code outside a component (a settings call): draw a widget, take its token, take the widget away. */
export async function oneShotCaptchaToken(): Promise<CaptchaResult> {
  const captcha = createInvisibleCaptcha();
  try {
    return await captcha.token();
  } finally {
    captcha.remove();
  }
}

/** One widget for the life of the component that holds it. */
export function useTurnstile(): Pick<Captcha, "token" | "reset"> {
  const captcha = useRef<Captcha | null>(null);
  useEffect(() => {
    const made = createInvisibleCaptcha();
    captcha.current = made;
    return () => {
      made.remove();
      captcha.current = null;
    };
  }, []);
  return useMemo(
    () => ({
      token: () => captcha.current?.token() ?? Promise.resolve({ token: undefined, failed: true }),
      reset: () => captcha.current?.reset(),
    }),
    [],
  );
}
