// D1: the sign-in dialog's place in the address.
import { describe, expect, it } from "vitest";

import { addressFor, deeper, depthOf, openOver, viewOf, withoutDialog, withView } from "./signinUrl";

describe("the dialog in the address", () => {
  it("reads the view, and nothing that is not one", () => {
    expect(viewOf("?signin=reset")).toBe("reset");
    expect(viewOf("?signin=nope")).toBeNull();
    expect(viewOf("?q=x")).toBeNull();
  });

  it("opens over the page it was asked from, coming back to it", () => {
    expect(openOver("/builds", "?q=agents")).toBe("/builds?q=agents&redirect=%2Fbuilds%3Fq%3Dagents&signin=login");
  });

  it("changes view and keeps everything else", () => {
    expect(withView("?redirect=%2Fx&signin=login", "reset")).toBe("?redirect=%2Fx&signin=reset");
  });

  it("takes every parameter an address brought off when it closes, and keeps the page's own", () => {
    expect(withoutDialog("?view=maps&signin=reset&token=t&code=c&redirect=%2Fx&type=email&error=e&error_description=d")).toBe("?view=maps");
    expect(withoutDialog("?signin=login")).toBe("");
  });

  it("counts how deep into the dialog an entry is", () => {
    expect(depthOf(null)).toBe(0);
    expect(depthOf(deeper(null))).toBe(1);
    expect(depthOf(deeper(deeper(null)))).toBe(2);
  });

  it("sends a retired address to Home on its view, with its query, its path token and its hash", () => {
    expect(addressFor("reset", "?redirect=%2Fx", "#access_token=a", "tok")).toEqual({ pathname: "/", search: "?redirect=%2Fx&token=tok&signin=reset", hash: "#access_token=a" });
    expect(addressFor("verify", "?token_hash=h&type=signup", "", undefined)).toEqual({ pathname: "/", search: "?token_hash=h&type=signup&signin=verify", hash: "" });
    // G16: a legacy address's return goes through safeReturnPath on the way in.
    expect(addressFor("login", "?redirect=https%3A%2F%2Fexample.com", "")).toEqual({ pathname: "/", search: "?redirect=%2F&signin=login", hash: "" });
    expect(addressFor("login", "?returnTo=%2F%2Fexample.com&redirect=%2Flibrary", "")).toEqual({ pathname: "/", search: "?returnTo=%2F&redirect=%2Flibrary&signin=login", hash: "" });
  });
});
