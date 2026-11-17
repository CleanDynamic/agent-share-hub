// G14, G15: a field's error is tied to it (aria-describedby, aria-invalid="true") and said once: through the description, not
// also through a live region; after a submit that ends in an error, focus moves to the first invalid field.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { Lock, Mail } from "lucide-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { AuthField, AuthForm, FieldMessage } from "./AuthParts";

const describedText = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

describe("G14: a field's own error", () => {
  it("is tied with aria-describedby and aria-invalid=true while it shows, and is not a live region", () => {
    render(<AuthField label="Email" icon={Mail} value="x" onChange={() => undefined} error="Enter an email address." />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedText(input)).toBe("Enter an email address.");
    const message = document.getElementById(input.getAttribute("aria-describedby") as string) as HTMLElement;
    expect(message.getAttribute("aria-live")).toBeNull();
  });

  it("a form-level message is tied to the fields it names, and is not a live region when tied", () => {
    render(
      <form>
        <AuthField label="New password" icon={Lock} type="password" value="x" onChange={() => undefined} describedBy="form-error" invalid />
        <FieldMessage id="form-error" live={false}>
          Couldn&apos;t change the password. Try again.
        </FieldMessage>
      </form>,
    );
    const input = screen.getByLabelText("New password");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedText(input)).toContain("Couldn't change the password.");
    expect(document.getElementById("form-error")?.getAttribute("aria-live")).toBeNull();
  });
});

function Login({ fail }: { fail: "field" | "form" }) {
  const [error, setError] = useState("");
  return (
    <AuthForm onSubmit={() => setError(fail === "field" ? "That password is not right." : "Couldn't sign in. Try again.")}>
      <AuthField label="Email" icon={Mail} value="a@b.c" onChange={() => undefined} />
      <AuthField label="Password" icon={Lock} type="password" value="x" onChange={() => undefined} error={fail === "field" ? error : undefined} describedBy={fail === "form" && error ? "login-error" : undefined} />
      {fail === "form" ? <FieldMessage id="login-error" live={false}>{error}</FieldMessage> : null}
      <button type="submit">Sign in</button>
    </AuthForm>
  );
}

describe("G15: after a submit that ends in an error", () => {
  it("focus moves to the first invalid field", async () => {
    render(<Login fail="field" />);
    const submit = screen.getByRole("button", { name: "Sign in" });
    submit.focus();
    await act(async () => fireEvent.click(submit));
    expect(document.activeElement).toBe(screen.getByLabelText("Password"));
  });

  it("with no invalid field, focus moves to the first field the error describes", async () => {
    render(<Login fail="form" />);
    const submit = screen.getByRole("button", { name: "Sign in" });
    submit.focus();
    await act(async () => fireEvent.click(submit));
    const password = screen.getByLabelText("Password");
    expect(document.activeElement).toBe(password);
    expect(describedText(password)).toBe("Couldn't sign in. Try again.");
  });
});
