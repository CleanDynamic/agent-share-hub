/* The sign-in dialog's place in the address (D1): `?signin=<view>` on whatever page the person is on.

   Opening, and every change of view, is a push, so Back steps out of reset to sign in and then closes. Each push carries
   how deep into the dialog it is (`signinDepth` in the history state), so closing steps back exactly that far and the
   address is the page's own again. A dialog that arrived by address (an emailed link, /login from a guard) has no depth:
   closing it replaces the address with the page's, without the dialog's parameters. */

import { safeReturnPath } from "@/lib/auth/safeReturnPath";

export const SIGNIN_PARAM = "signin";

export type SignInView = "login" | "signup" | "reset" | "verify";

export const SIGNIN_VIEWS: readonly SignInView[] = ["login", "signup", "reset", "verify"];

/** The parameters an address-opened dialog brings with it: the destination, and what an emailed link carries. */
const DIALOG_KEYS = [SIGNIN_PARAM, "redirect", "returnTo", "token", "token_hash", "code", "type", "error", "error_description"] as const;

export function viewOf(search: string | URLSearchParams): SignInView | null {
  const value = new URLSearchParams(search).get(SIGNIN_PARAM);
  return SIGNIN_VIEWS.includes(value as SignInView) ? (value as SignInView) : null;
}

/** The same page with the dialog on `view`; anything else in the query stays (the destination, a token). */
export function withView(search: string, view: SignInView): string {
  const next = new URLSearchParams(search);
  next.set(SIGNIN_PARAM, view);
  return `?${next.toString()}`;
}

/** The page with the dialog opened over it from inside the app: on `view`, coming back here once signed in. */
export function openOver(pathname: string, search: string, view: SignInView = "login"): string {
  const next = new URLSearchParams(search);
  next.set("redirect", `${pathname}${search}`);
  next.set(SIGNIN_PARAM, view);
  return `${pathname}?${next.toString()}`;
}

/** The page without the dialog: for a dialog that arrived by address, every parameter it brought is taken off. */
export function withoutDialog(search: string): string {
  const next = new URLSearchParams(search);
  for (const key of DIALOG_KEYS) next.delete(key);
  const written = next.toString();
  return written ? `?${written}` : "";
}

/** How many pushes deep the current entry is, from its history state. */
export function depthOf(state: unknown): number {
  const depth = (state as { signinDepth?: unknown } | null)?.signinDepth;
  return typeof depth === "number" && depth > 0 ? depth : 0;
}

/** The history state for the next push into the dialog. */
export const deeper = (state: unknown) => ({ signinDepth: depthOf(state) + 1 });

/** The address a retired sign-in page now opens: Home, with the dialog on its view, keeping the query, the path's token and the hash. */
export function addressFor(view: SignInView, search: string, hash: string, token?: string): { pathname: string; search: string; hash: string } {
  const next = new URLSearchParams(search);
  // G16: a return address arriving at a legacy address goes through the gate on the way in.
  for (const key of ["redirect", "returnTo"]) {
    const value = next.get(key);
    if (value !== null) next.set(key, safeReturnPath(value));
  }
  if (token && !next.has("token")) next.set("token", token);
  next.set(SIGNIN_PARAM, view);
  return { pathname: "/", search: `?${next.toString()}`, hash };
}
