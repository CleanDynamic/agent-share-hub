// Part A, G2 and G7: the "Enter your code" view. A six-digit field (numeric, one-time-code), signed in only once the
// code verifies, the dialog's rect and row 1 unchanged; five wrong codes end the attempt and go back to the password view.

import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pendingCodeFactor = vi.fn();
const abandonCodeStep = vi.fn();
const verifyCode = vi.fn();
const redeemBackupCode = vi.fn();
const resolvePostAuthRoute = vi.fn();
let tries = 0;

vi.mock("@/lib/auth/codeStep", () => ({
  MAX_CODE_TRIES: 5,
  pendingCodeFactor: () => pendingCodeFactor(),
  abandonCodeStep: () => abandonCodeStep(),
  recordWrongTry: () => ++tries,
  clearTries: () => {
    tries = 0;
  },
  wrongTries: () => tries,
}));
vi.mock("@/lib/auth/mfa", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/mfa")>();
  return { ...real, verifyCode: (...args: unknown[]) => verifyCode(...args), redeemBackupCode: (...args: unknown[]) => redeemBackupCode(...args) };
});
vi.mock("@/lib/auth/postAuthRoute", () => ({ resolvePostAuthRoute: (...args: unknown[]) => resolvePostAuthRoute(...args) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isLoggedIn: true, user: { id: "u-1" } }) }));
vi.mock("@/lib/auth/turnstile", () => ({ useTurnstile: () => ({ token: async () => ({ token: "tok", failed: false }), reset: () => undefined }), oneShotCaptchaToken: async () => ({ token: "tok", failed: false }) }));

import { MFA_COPY } from "@/lib/auth/mfa";
import { SettingsError } from "@/lib/settings/useAction";

import { CODE_COPY } from "./CodePanel";
import { renderDialog } from "./signinTest";

const field = () => screen.getByLabelText(CODE_COPY.label) as HTMLInputElement;
const verify = () => screen.getByRole("button", { name: CODE_COPY.verify });
const enter = (value: string) => fireEvent.change(field(), { target: { value } });
const dialogBox = () => {
  const node = screen.getByRole("dialog");
  return { width: node.style.width, height: node.style.height };
};

beforeEach(() => {
  tries = 0;
  for (const fn of [pendingCodeFactor, abandonCodeStep, verifyCode, redeemBackupCode, resolvePostAuthRoute]) fn.mockReset();
  pendingCodeFactor.mockResolvedValue("f1");
  abandonCodeStep.mockResolvedValue(undefined);
  resolvePostAuthRoute.mockResolvedValue("/home");
});
afterEach(cleanup);

describe("the view", () => {
  it("is Enter your code, with one six-digit field for the number pad and the phone's code autofill", async () => {
    renderDialog("code");
    expect(screen.getByRole("heading", { name: CODE_COPY.title })).toBeTruthy();
    expect(field().getAttribute("inputmode")).toBe("numeric");
    expect(field().getAttribute("autocomplete")).toBe("one-time-code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    expect(verify()).toBeDisabled();
    enter("12345");
    expect(verify()).toBeDisabled();
    enter("123456");
    expect(verify()).toBeEnabled();
  });

  it("keeps the dialog's rect, and row 1 is Back to sign in as on every view but Sign in and Join", () => {
    renderDialog("login");
    const login = dialogBox();
    // jsdom is narrower than 840, so the dialog draws its one-column form (480); the point is that it is a real size.
    expect(["840px", "480px"]).toContain(login.width);
    expect(login.height).toBe("540px");
    cleanup();
    renderDialog("code");
    expect(dialogBox()).toEqual(login);
    expect(screen.getByTestId("signin-back").textContent).toBe("Back to sign in");
  });

  it("tells a member with no authenticator and no backup codes to contact support (D4), and offers no way round", () => {
    renderDialog("code");
    expect(screen.getByText(CODE_COPY.support)).toBeTruthy();
    expect(screen.queryByText(/email.*link/i)).toBeNull();
  });

  it("goes back to the password view when no code is owed", async () => {
    pendingCodeFactor.mockResolvedValue(null);
    const where = renderDialog("code");
    await waitFor(() => expect(where.at()).toBe("/?signin=login"));
  });
});

describe("verifying", () => {
  it("signs in only once the code verifies, then goes to the destination", async () => {
    verifyCode.mockResolvedValue(undefined);
    const where = renderDialog("code", "redirect=%2Fgallery");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    enter("123456");
    fireEvent.click(verify());
    await waitFor(() => expect(where.at()).toBe("/gallery"));
    expect(verifyCode).toHaveBeenCalledWith("f1", "123456");
  });

  it("with no destination, goes where the profile says", async () => {
    verifyCode.mockResolvedValue(undefined);
    const where = renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    enter("123456");
    fireEvent.click(verify());
    await waitFor(() => expect(where.at()).toBe("/home"));
    expect(resolvePostAuthRoute).toHaveBeenCalledWith("u-1");
  });

  it("a wrong code stays on the view, says how many tries are left, and signs nobody in", async () => {
    verifyCode.mockRejectedValue(new SettingsError(MFA_COPY.wrongCode));
    const where = renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    enter("000000");
    fireEvent.click(verify());
    expect(await screen.findByText(CODE_COPY.wrong(4))).toBeTruthy();
    expect(where.at()).toBe("/?signin=code");
    expect(field().value).toBe("");
  });
});

describe("G7: five wrong codes in a row", () => {
  it("end the attempt: the half-signed-in session is signed out and the member is back on the password view, told why", async () => {
    verifyCode.mockRejectedValue(new SettingsError(MFA_COPY.wrongCode));
    const where = renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      enter("000000");
      fireEvent.click(verify());
      expect(await screen.findByText(CODE_COPY.wrong(5 - attempt))).toBeTruthy();
    }
    expect(abandonCodeStep).not.toHaveBeenCalled();
    enter("000000");
    fireEvent.click(verify());
    await waitFor(() => expect(abandonCodeStep).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(where.at()).toBe("/?signin=login"));
    expect(await screen.findByText(CODE_COPY.ended)).toBeTruthy();
  });

  it("a field that is not six digits never reached the server and is not a try", async () => {
    verifyCode.mockRejectedValue(new SettingsError(MFA_COPY.codeShape));
    renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    enter("123456");
    fireEvent.click(verify());
    expect(await screen.findByText(MFA_COPY.codeShape)).toBeTruthy();
    expect(tries).toBe(0);
  });
});

describe("G5: a backup code in place of the code", () => {
  const useBackup = () => fireEvent.click(screen.getByRole("button", { name: CODE_COPY.useBackup }));
  const backupField = () => screen.getByLabelText(CODE_COPY.backupLabel) as HTMLInputElement;

  it("turns the field into a backup-code field, and back", async () => {
    renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    useBackup();
    expect(backupField().getAttribute("inputmode")).toBe("text");
    expect(backupField().getAttribute("autocomplete")).toBe("off");
    fireEvent.click(screen.getByRole("button", { name: CODE_COPY.useCode }));
    expect(field().getAttribute("inputmode")).toBe("numeric");
  });

  it("signs in with one backup code, through mfa-recovery, and never the authenticator check", async () => {
    redeemBackupCode.mockResolvedValue(undefined);
    const where = renderDialog("code", "redirect=%2Fgallery");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    useBackup();
    fireEvent.change(backupField(), { target: { value: "ABCDE-FGHJK" } });
    fireEvent.click(verify());
    await waitFor(() => expect(where.at()).toBe("/gallery"));
    expect(redeemBackupCode).toHaveBeenCalledWith("ABCDE-FGHJK");
    expect(verifyCode).not.toHaveBeenCalled();
  });

  it("a refused backup code says why and counts as a try", async () => {
    redeemBackupCode.mockRejectedValue(new SettingsError("That backup code didn't work."));
    renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    useBackup();
    fireEvent.change(backupField(), { target: { value: "ABCDE-FGHJK" } });
    fireEvent.click(verify());
    expect(await screen.findByText(CODE_COPY.wrong(4))).toBeTruthy();
    expect(tries).toBe(1);
  });

  it("is not sent until it has ten characters", async () => {
    renderDialog("code");
    await waitFor(() => expect(pendingCodeFactor).toHaveBeenCalled());
    useBackup();
    fireEvent.change(backupField(), { target: { value: "ABCDE" } });
    expect(verify()).toBeDisabled();
  });
});
