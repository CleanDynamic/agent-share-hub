// Part A, G1: Settings, Account, "Two-step sign-in". Add an authenticator (QR code and the key as text, then one code to
// confirm), the list with names and dates, Remove. Adding asks for the password, or a fresh code when one exists.

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("@/lib/errors/report", () => ({ reportError: vi.fn() }));

import { MFA_COPY, type Authenticator, type Enrolment } from "@/lib/auth/mfa";
import { SettingsError } from "@/lib/settings/useAction";

import { TwoStepGroup, type TwoStepGroupProps } from "./TwoStepGroup";

const phone: Authenticator = { id: "f1", name: "Phone", createdAt: "2026-11-01T10:00:00Z" };
const enrolment: Enrolment = { factorId: "new", qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" };

function props(over: Partial<TwoStepGroupProps> = {}): TwoStepGroupProps {
  return {
    factors: [],
    hasPassword: true,
    onBeginAdd: vi.fn(async () => enrolment),
    onFinishAdd: vi.fn(async () => null),
    onCancelAdd: vi.fn(async () => undefined),
    onRemove: vi.fn(async () => undefined),
    ...over,
  };
}

const group = () => screen.getByRole("region", { name: MFA_COPY.group });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(within(group()).getByRole("button", { name }));

afterEach(cleanup);

describe("with no authenticator", () => {
  it("says it is not set up and offers Add an authenticator", () => {
    render(<TwoStepGroup {...props()} />);
    expect(within(group()).getByText(MFA_COPY.none)).toBeTruthy();
    expect(within(group()).getByRole("button", { name: MFA_COPY.add })).toBeEnabled();
  });

  it("asks for the password first, then shows the QR code and the key as text, then confirms with one code", async () => {
    const p = props();
    render(<TwoStepGroup {...p} />);
    click(MFA_COPY.add);
    expect(screen.queryByLabelText(/^Code from/)).toBeNull();
    type("Name (optional)", "My phone");
    type("Password", "secret-pass");
    click("Continue");
    await waitFor(() => expect(p.onBeginAdd).toHaveBeenCalledWith({ name: "My phone", password: "secret-pass", code: null }));

    const qr = await screen.findByRole("img", { name: "QR code for your authenticator app" });
    expect(qr.getAttribute("src")).toBe(enrolment.qrCode);
    expect(screen.getByTestId("totp-secret").textContent).toBe(enrolment.secret);

    const field = screen.getByLabelText(MFA_COPY.confirmCode);
    expect(field.getAttribute("inputmode")).toBe("numeric");
    expect(field.getAttribute("autocomplete")).toBe("one-time-code");
    type(MFA_COPY.confirmCode, "123456");
    click("Confirm");
    await waitFor(() => expect(p.onFinishAdd).toHaveBeenCalledWith("new", "123456"));
    expect(await screen.findByText(MFA_COPY.added)).toBeTruthy();
  });

  it("shows the refusal and stays on the step when the password is wrong", async () => {
    const p = props({ onBeginAdd: vi.fn(async () => { throw new SettingsError(MFA_COPY.wrongPassword); }) });
    render(<TwoStepGroup {...p} />);
    click(MFA_COPY.add);
    type("Password", "nope");
    click("Continue");
    expect(await screen.findByText(MFA_COPY.wrongPassword)).toBeTruthy();
    expect(screen.queryByRole("img", { name: "QR code for your authenticator app" })).toBeNull();
  });

  it("clears the half-finished authenticator when the member cancels at the QR code", async () => {
    const p = props();
    render(<TwoStepGroup {...p} />);
    click(MFA_COPY.add);
    type("Password", "secret-pass");
    click("Continue");
    await screen.findByRole("img", { name: "QR code for your authenticator app" });
    click("Cancel");
    await waitFor(() => expect(p.onCancelAdd).toHaveBeenCalledWith("new"));
  });

  it("is off for a member with no password, and says to set one first", () => {
    render(<TwoStepGroup {...props({ hasPassword: false })} />);
    expect(within(group()).getByText(MFA_COPY.setPasswordFirst)).toBeTruthy();
    expect(within(group()).getByRole("button", { name: MFA_COPY.add })).toBeDisabled();
  });
});

describe("with an authenticator", () => {
  it("lists it with its name and the date it was added", () => {
    render(<TwoStepGroup {...props({ factors: [phone] })} />);
    expect(within(group()).getByText("Phone")).toBeTruthy();
    expect(within(group()).getByText("Added 1 Nov 2026")).toBeTruthy();
  });

  it("adding another asks for a fresh code from it, never the password", async () => {
    const p = props({ factors: [phone] });
    render(<TwoStepGroup {...p} />);
    click(MFA_COPY.add);
    expect(screen.queryByLabelText("Password")).toBeNull();
    type("Code from Phone", "654321");
    click("Continue");
    await waitFor(() => expect(p.onBeginAdd).toHaveBeenCalledWith({ name: "", password: null, code: "654321" }));
  });

  it("removing asks for a fresh code from that authenticator", async () => {
    const p = props({ factors: [phone] });
    render(<TwoStepGroup {...p} />);
    click("Remove Phone");
    type("Code from Phone", "111222");
    click(MFA_COPY.remove);
    await waitFor(() => expect(p.onRemove).toHaveBeenCalledWith(phone, "111222"));
    expect(await screen.findByText(MFA_COPY.removed)).toBeTruthy();
  });
});

it("says so in one line when the authenticators could not be loaded", () => {
  render(<TwoStepGroup {...props({ factors: null })} />);
  expect(within(group()).getByText(/Couldn't load your authenticators/)).toBeTruthy();
});

describe("G5: backup codes", () => {
  const codes = ["AAAAA-BBBBB", "CCCCC-DDDDD", "EEEEE-FFFFF", "GGGGG-HHHHH", "JJJJJ-KKKKK", "MMMMM-NNNNN", "PPPPP-QQQQQ", "RRRRR-SSSSS", "TTTTT-UUUUU", "VVVVV-WWWWW"];

  it("after the first authenticator, shows ten codes once, then they are gone", async () => {
    const p = props({ onFinishAdd: vi.fn(async () => codes) });
    render(<TwoStepGroup {...p} />);
    click(MFA_COPY.add);
    type("Password", "secret-pass");
    click("Continue");
    await screen.findByRole("img", { name: "QR code for your authenticator app" });
    type(MFA_COPY.confirmCode, "123456");
    click("Confirm");
    const list = await screen.findByRole("list", { name: MFA_COPY.backupTitle });
    expect(within(list).getAllByRole("listitem").map((item) => item.textContent)).toEqual(codes);
    expect(screen.getByText(MFA_COPY.backupSave)).toBeTruthy();
    click(MFA_COPY.backupDone);
    expect(screen.queryByRole("list", { name: MFA_COPY.backupTitle })).toBeNull();
    expect(screen.queryByText(codes[0])).toBeNull();
    expect(screen.getByText(MFA_COPY.added)).toBeTruthy();
  });

  it("says how many are left, and makes a new set only after a fresh code", async () => {
    const onRegenerate = vi.fn(async () => codes);
    render(<TwoStepGroup {...props({ factors: [phone], backupLeft: 7, onRegenerate })} />);
    expect(within(group()).getByText(MFA_COPY.backupLeft(7))).toBeTruthy();
    click(MFA_COPY.backupNew);
    expect(screen.getByText(MFA_COPY.backupNewNote)).toBeTruthy();
    type("Code from Phone", "222333");
    click(MFA_COPY.backupNew);
    await waitFor(() => expect(onRegenerate).toHaveBeenCalledWith("222333"));
    expect(await screen.findByRole("list", { name: MFA_COPY.backupTitle })).toBeTruthy();
  });

  it("from a session a backup code verified, removes a lost authenticator without its code", async () => {
    const p = props({ factors: [phone], recovered: true });
    render(<TwoStepGroup {...p} />);
    click("Remove Phone");
    expect(screen.getByText(MFA_COPY.recoveredRemove)).toBeTruthy();
    expect(screen.queryByLabelText("Code from Phone")).toBeNull();
    click(MFA_COPY.remove);
    await waitFor(() => expect(p.onRemove).toHaveBeenCalledWith(phone, ""));
  });

  it("has no Backup codes row before there is an authenticator", () => {
    render(<TwoStepGroup {...props({ onRegenerate: vi.fn(async () => codes) })} />);
    expect(screen.queryByText(MFA_COPY.backupTitle)).toBeNull();
  });
});
