// UI-P36 — the cards' bodies and the pieces they are made of: the providers, the
// "or with email" rule, the field style, the checkbox row and the primary action,
// at the reference's desktop and phone numbers, and the behaviour every existing
// auth spec relies on (placeholders, labels, the disabled gate, the reveal, the
// checkbox's shape, one polite error under the field it is about).
//
// Token-valued styles are asserted through static markup, because jsdom's CSS
// parser drops every `var()`; behaviour is asserted on the rendered tree.

import { fireEvent, render, screen, within } from "@testing-library/react";
import { User } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthCheck, AuthField, FieldMessage, OrRule, PrimaryAction, ProviderButtons } from "./AuthParts";
import { LoginForm, type LoginFormProps } from "./LoginForm";
import { ResetConfirmForm, ResetLinkError, ResetRequestForm, ResetSent, LinkChecking } from "./ResetForms";
import { SignupForm, type SignupFormProps } from "./SignupForm";
import { setViewport } from "./signinTest";

const inRouter = (node: ReactElement) => <MemoryRouter>{node}</MemoryRouter>;
const markup = (node: ReactElement) => renderToStaticMarkup(inRouter(node));
const show = (node: ReactElement) => render(inRouter(node));

beforeEach(() => setViewport("desktop"));
afterEach(() => setViewport("desktop"));

const login = (over: Partial<LoginFormProps> = {}): LoginFormProps => ({
  emailOrUsername: "",
  password: "",
  rememberMe: true,
  onEmailOrUsernameChange: () => {},
  onPasswordChange: () => {},
  onRememberMeChange: () => {},
  canSubmit: true,
  isSubmitting: false,
  onSubmit: () => {},
  onProvider: () => {},
  loadingProvider: null,
  ...over,
});

const signup = (over: Partial<SignupFormProps> = {}): SignupFormProps => ({
  displayName: "",
  username: "",
  email: "",
  password: "",
  agreedToTerms: false,
  onDisplayNameChange: () => {},
  onUsernameChange: () => {},
  onEmailChange: () => {},
  onPasswordChange: () => {},
  onAgreedToTermsChange: () => {},
  usernameValidation: { state: "idle" },
  emailValidation: { state: "idle" },
  passwordStrength: "weak",
  canSubmit: true,
  isSubmitting: false,
  onSubmit: () => {},
  onProvider: () => {},
  loadingProvider: null,
  ...over,
});

describe("ProviderButtons", () => {
  it("is one button per provider, named Continue with Google, GitHub and X", () => {
    show(<ProviderButtons onProvider={() => {}} loadingProvider={null} />);
    for (const name of ["Continue with Google", "Continue with GitHub", "Continue with X"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("reports the provider that was clicked", () => {
    const onProvider = vi.fn();
    show(<ProviderButtons onProvider={onProvider} loadingProvider={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with GitHub" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with X" }));
    expect(onProvider.mock.calls.map(([provider]) => provider)).toEqual(["google", "github", "x"]);
  });

  it("waits on the one that was clicked: a spinner in its place, and every button disabled", () => {
    const { container } = show(<ProviderButtons onProvider={() => {}} loadingProvider="github" />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
    expect(container.querySelectorAll("svg.animate-spin")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Continue with GitHub" }).querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("draws each at 44 tall in 14px 500 type on --glass-2 with a --line hairline, 10px between mark and words, at the 16px mark", () => {
    const html = markup(<ProviderButtons onProvider={() => {}} loadingProvider={null} />);
    // UI-P52 density pass: Button takes the drawn 44/14 and renders 36/13.
    expect(html).toContain("height:36px");
    expect(html).toContain("font-size:13px");
    expect(html).toContain("font-weight:500");
    expect(html).toContain("background:var(--glass-2)");
    expect(html).toContain("border:1px solid var(--line)");
    expect(html).toContain("border-radius:var(--r-control)");
    // UI-P52 density pass: 10px between mark and words renders 7.
    expect(html).toContain("gap:7px");
    expect(html).toContain('width="16" height="16"');
  });

  it("is 48 tall in 15px type on a phone", () => {
    setViewport("phone");
    render(inRouter(<ProviderButtons onProvider={() => {}} loadingProvider={null} />));
    const style = screen.getByRole("button", { name: "Continue with Google" }).getAttribute("style")!;
    // UI-P52 density pass: 48 → 39 by the table, held at the 44px touch floor;
    // the type 15 → 14.
    expect(style).toContain("height: 44px");
    expect(style).toContain("font-size: 14px");
  });
});

describe("OrRule", () => {
  it("is two 1px --line rules either side of a 10px eyebrow, 12px apart with 4px 0 around it", () => {
    const html = markup(<OrRule>or with email</OrRule>);
    // UI-P52 density pass: 12 → 9.
    expect(html).toContain("gap:9px");
    expect(html).toContain("margin:4px 0");
    expect(html).toContain("height:1px");
    expect(html).toContain("background:var(--line)");
    expect(html.match(/flex-grow:1/g)).toHaveLength(2);
    expect(html).toContain("font-size:10px");
    expect(html).toContain("text-transform:uppercase");
    expect(html).toContain("or with email");
  });

  it("is 10px apart with 2px 0 around it on a phone", () => {
    setViewport("phone");
    const { container } = render(<OrRule>or with email</OrRule>);
    const style = container.firstElementChild!.getAttribute("style")!;
    // UI-P52 density pass: 10 → 7; the 2px is under the table's floor.
    expect(style).toContain("gap: 7px");
    expect(style).toContain("margin: 2px 0px");
  });
});

describe("AuthField", () => {
  const field = (over: Partial<Parameters<typeof AuthField>[0]> = {}) => (
    <AuthField label="Email or username" icon={User} value="" onChange={() => {}} {...over} />
  );

  it("is a label around a 10px eyebrow and the box, 7px apart", () => {
    const html = markup(field());
    expect(html).toContain("<label");
    // UI-P52 density pass: 7 → 5.
    expect(html).toContain("flex-direction:column;gap:5px");
    expect(html).toContain("Email or username");
    expect(html).toContain("font-size:10px");
  });

  it("draws the box 44 tall (content box) with 0 14px padding, radius 12, --field, a 1px --line border, 10px between icon and input", () => {
    const html = markup(field());
    // UI-P52 density pass: the box 44 → 36, its padding 0 14px → 0 10px and the gap 10 → 7.
    expect(html).toContain("height:36px");
    expect(html).toContain("box-sizing:content-box");
    expect(html).toContain("padding:0 10px");
    expect(html).toContain("border-radius:var(--r-control)");
    expect(html).toContain("background:var(--field)");
    expect(html).toContain("border:1px solid var(--line)");
    expect(html).toContain("gap:7px");
    expect(html).toContain("color:var(--text2)");
  });

  it("is 48 tall on a phone", () => {
    setViewport("phone");
    const { container } = render(field());
    // UI-P52 density pass: 48 → 39 by the table, held at the 44px touch floor.
    expect(container.querySelector("label > span:last-child")!.getAttribute("style")).toContain("height: 44px");
  });

  it("sets the input in 14px Figtree on --text, and leaves the 16px below 768px to the stylesheet's own rule", () => {
    const html = markup(field());
    // UI-P52 density pass: 14 → 13.
    expect(html).toContain("font-size:13px");
    expect(html).toContain("color:var(--text)");
    // The stylesheet's !important fill and border are switched off with utilities, not a new class.
    expect(html).toContain("!bg-transparent");
    expect(html).toContain("!border-0");
  });

  it("is found by its label and by its placeholder, as the specs find it", () => {
    show(field({ placeholder: "Email or username" }));
    expect(screen.getByLabelText("Email or username")).toBeTruthy();
    expect(screen.getByPlaceholderText("Email or username")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email or username" })).toBeTruthy();
  });

  it("reports what is typed", () => {
    const onChange = vi.fn();
    show(field({ onChange }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ada" } });
    expect(onChange).toHaveBeenCalledWith("ada");
  });

  it("reveals and hides a password, and says so", () => {
    show(field({ label: "Password", showPasswordToggle: true, value: "hunter22", placeholder: "Enter your password" }));
    const input = screen.getByPlaceholderText("Enter your password");
    expect(input.getAttribute("type")).toBe("password");
    const reveal = screen.getByRole("button", { name: "Show password" });
    expect(reveal.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(reveal);
    expect(input.getAttribute("type")).toBe("text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(hide);
    expect(input.getAttribute("type")).toBe("password");
  });

  it("is found by its exact label even with the reveal inside it", () => {
    show(field({ label: "Password", showPasswordToggle: true }));
    expect(screen.getByLabelText("Password", { exact: true }).tagName).toBe("INPUT");
  });

  it("gives the reveal a 44px target", () => {
    // UI-P52 density pass: 44 → 36 above 768px, as the tightened board; a phone keeps its 44px target.
    const { unmount } = show(field({ label: "Password", showPasswordToggle: true }));
    const style = screen.getByRole("button", { name: "Show password" }).getAttribute("style")!;
    expect(style).toContain("width: 36px");
    expect(style).toContain("height: 36px");
    unmount();
    setViewport("phone");
    show(field({ label: "Password", showPasswordToggle: true }));
    const phone = screen.getByRole("button", { name: "Show password" }).getAttribute("style")!;
    expect(phone).toContain("width: 44px");
    expect(phone).toContain("height: 44px");
  });

  it("says one thing under the field it is about, in --cat-breakage, announced politely", () => {
    const html = markup(field({ error: "Wrong email or password" }));
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("color:var(--cat-breakage)");
    expect(html).toContain("Wrong email or password");
    expect(html).toContain("border:1px solid var(--cat-breakage)");

    show(field({ error: "Wrong email or password" }));
    const input = screen.getByRole("textbox");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const message = screen.getByText("Wrong email or password");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
  });

  it("keeps the live region there, empty, when there is nothing to say", () => {
    show(field());
    const regions = screen.getAllByTestId("field-message");
    expect(regions).toHaveLength(1);
    expect(regions[0].getAttribute("aria-live")).toBe("polite");
    expect(regions[0].textContent).toBe("");
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByRole("textbox").hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows a validation's message under the field: breakage when invalid, evidence when good", () => {
    const { rerender } = show(field({ validation: { state: "invalid", message: "Username must be at least 3 characters" } }));
    expect(screen.getByText("Username must be at least 3 characters").getAttribute("style")).toBeTruthy();
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
    expect(renderToStaticMarkup(inRouter(field({ validation: { state: "invalid", message: "Taken" } })))).toContain("color:var(--cat-breakage)");

    rerender(inRouter(field({ validation: { state: "valid", message: "Username available" } })));
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("false");
    expect(renderToStaticMarkup(inRouter(field({ validation: { state: "valid", message: "Username available" } })))).toContain(
      "color:var(--evidence)",
    );
  });

  it("shows the state of the check at the right of the box, and a helper line under it", () => {
    const { container, rerender } = show(field({ validation: { state: "checking" }, helperText: "buildgallery.ai/profile/ada" }));
    expect(container.querySelector("svg.animate-spin")).not.toBeNull();
    expect(screen.getByText("buildgallery.ai/profile/ada")).toBeTruthy();
    rerender(inRouter(field({ validation: { state: "valid" } })));
    expect(container.querySelector("svg.animate-spin")).toBeNull();
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("reports leaving the field", () => {
    const onBlur = vi.fn();
    show(field({ onBlur }));
    fireEvent.focus(screen.getByRole("textbox"));
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});

describe("FieldMessage", () => {
  it("has no margin while it is empty, and a 6px one once it says something", () => {
    const { rerender, getByTestId } = render(<FieldMessage />);
    expect(getByTestId("field-message").style.marginTop).toBe("0px");
    rerender(<FieldMessage>Please choose an available username.</FieldMessage>);
    // UI-P52 density pass: 6 → 4.
    expect(getByTestId("field-message").style.marginTop).toBe("4px");
  });
});

describe("AuthCheck", () => {
  it("is label[for] > div, with the input in the div and the words after it: a click on the box ticks it", () => {
    const onChange = vi.fn();
    const { container } = render(
      <AuthCheck id="terms" checked={false} onChange={onChange}>
        I agree
      </AuthCheck>,
    );
    const label = container.querySelector('label[for="terms"]')!;
    const box = label.querySelector(":scope > div")!;
    expect(box.querySelector("input#terms")).not.toBeNull();
    fireEvent.click(box.lastElementChild!);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("is a checkbox with an accessible name, checked as it is told", () => {
    const { rerender } = render(
      <AuthCheck id="remember" checked onChange={() => {}}>
        Keep me signed in
      </AuthCheck>,
    );
    expect(screen.getByRole("checkbox", { name: "Keep me signed in" })).toBeChecked();
    rerender(
      <AuthCheck id="remember" checked={false} onChange={() => {}}>
        Keep me signed in
      </AuthCheck>,
    );
    expect(screen.getByRole("checkbox", { name: "Keep me signed in" })).not.toBeChecked();
  });

  it("draws the words 13px in the quiet ink, 8px from a square box", () => {
    const html = markup(
      <AuthCheck id="remember" checked onChange={() => {}}>
        Keep me signed in
      </AuthCheck>,
    );
    // UI-P52 density pass: the words 13 → 12 and 8 → 6 from the box, as the tightened board's row.
    expect(html).toContain("font-size:12px");
    expect(html).toContain("color:var(--text2)");
    expect(html).toContain("gap:6px");
    expect(html).toContain("border-radius:5px");
    expect(html).toContain("background:var(--action)");
  });

  it("takes a 28px target and gives the 12px back, so the row stays as tall as the reference's 19", () => {
    const { container } = render(
      <AuthCheck id="remember" checked onChange={() => {}}>
        Keep me signed in
      </AuthCheck>,
    );
    const style = container.querySelector("label")!.getAttribute("style")!;
    expect(style).toContain("padding: 6px 0px");
    expect(style).toContain("margin: -6px 0px");
    expect(style).toContain("line-height: 19px");
  });
});

describe("PrimaryAction", () => {
  it("is the one primary: --action on --on-action, 46 tall in 15px type, and full width", () => {
    const html = markup(<PrimaryAction>Sign in</PrimaryAction>);
    expect(html).toContain('data-variant="primary"');
    // UI-P52 density pass: drawn 46/15, rendered 38/14.
    expect(html).toContain("height:38px");
    expect(html).toContain("font-size:14px");
    expect(html).toContain("background:var(--action)");
    expect(html).toContain("color:var(--on-action)");
    expect(html).toContain("width:100%");
    expect(html).toContain('type="submit"');
  });

  it("is 48 tall on a phone", () => {
    setViewport("phone");
    render(<PrimaryAction>Sign in</PrimaryAction>);
    // UI-P52 density pass: a primary button that was 44 or taller stays 44 on a phone.
    expect(screen.getByRole("button", { name: "Sign in" }).getAttribute("style")).toContain("height: 44px");
  });

  it("is disabled while the form is not ready, and while the request is out, saying what it is doing", () => {
    const { rerender } = render(<PrimaryAction disabled>Sign in</PrimaryAction>);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    rerender(
      <PrimaryAction loading loadingText="Signing in...">
        Sign in
      </PrimaryAction>,
    );
    const busy = screen.getByRole("button", { name: "Signing in..." });
    expect(busy).toBeDisabled();
    expect(busy.querySelector("svg.animate-spin")).not.toBeNull();
  });
});

describe("LoginForm", () => {
  it("is the providers, the rule, both fields, the remember row and the one primary, in the reference's order", () => {
    show(<LoginForm {...login()} />);
    const inOrder = [
      screen.getByRole("button", { name: "Continue with Google" }),
      screen.getByRole("button", { name: "Continue with GitHub" }),
      screen.getByRole("button", { name: "Continue with X" }),
      screen.getByText("or with email"),
      screen.getByLabelText("Email or username", { exact: true }),
      screen.getByLabelText("Password", { exact: true }),
      screen.getByRole("checkbox", { name: "Keep me signed in" }),
      screen.getByRole("link", { name: "Forgot password?" }),
      screen.getByRole("button", { name: "Sign in" }),
    ];
    for (let i = 1; i < inOrder.length; i++) {
      expect(
        inOrder[i - 1].compareDocumentPosition(inOrder[i]) & Node.DOCUMENT_POSITION_FOLLOWING,
        `${i} follows ${i - 1}`,
      ).toBeTruthy();
    }
  });

  it("keeps the placeholders and labels the existing specs find the fields by", () => {
    show(<LoginForm {...login()} />);
    expect(screen.getByPlaceholderText("Email or username")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter your password")).toBeTruthy();
    expect(screen.getByLabelText("Email or username")).toBeTruthy();
    expect(screen.getByLabelText("Password", { exact: true })).toBeTruthy();
    expect(screen.getByPlaceholderText("Email or username").getAttribute("autocomplete")).toBe("username");
    expect(screen.getByPlaceholderText("Enter your password").getAttribute("autocomplete")).toBe("current-password");
  });

  it("has exactly one button named Sign in, and it is the form's", () => {
    show(<LoginForm {...login()} />);
    expect(screen.getAllByRole("button", { name: "Sign in" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Sign in" }).getAttribute("type")).toBe("submit");
  });

  it("disables Sign in until the page says it can be sent", () => {
    const { rerender } = show(<LoginForm {...login({ canSubmit: false })} />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    rerender(inRouter(<LoginForm {...login({ canSubmit: true })} />));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("sends on submit, and says so while it is out", () => {
    const onSubmit = vi.fn();
    const { rerender } = show(<LoginForm {...login({ onSubmit })} />);
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    rerender(inRouter(<LoginForm {...login({ onSubmit, isSubmitting: true })} />));
    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
  });

  it("reports each field, and the remember box", () => {
    const onEmailOrUsernameChange = vi.fn();
    const onPasswordChange = vi.fn();
    const onRememberMeChange = vi.fn();
    const { container } = show(<LoginForm {...login({ onEmailOrUsernameChange, onPasswordChange, onRememberMeChange })} />);
    fireEvent.change(screen.getByPlaceholderText("Email or username"), { target: { value: "ada_l" } });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), { target: { value: "hunter22" } });
    fireEvent.click(container.querySelector('label[for="remember"] > div')!.lastElementChild!);
    expect(onEmailOrUsernameChange).toHaveBeenCalledWith("ada_l");
    expect(onPasswordChange).toHaveBeenCalledWith("hunter22");
    expect(onRememberMeChange).toHaveBeenCalledWith(false);
  });

  it("offers Keep me signed in ticked as it is told, and Forgot password? in --action to /reset-password", () => {
    show(<LoginForm {...login({ rememberMe: true })} />);
    expect(screen.getByRole("checkbox", { name: "Keep me signed in" })).toBeChecked();
    const forgot = screen.getByRole("link", { name: "Forgot password?" });
    expect(forgot.getAttribute("href")).toBe("/reset-password");
    expect(renderToStaticMarkup(inRouter(<LoginForm {...login()} />))).toContain("color:var(--action)");
  });

  it("says Forgot? on a phone and still reads as Forgot password?", () => {
    setViewport("phone");
    show(<LoginForm {...login()} />);
    const forgot = screen.getByRole("link", { name: "Forgot password?" });
    expect(forgot.getAttribute("href")).toBe("/reset-password");
    // Visually "Forgot?", named as the whole sentence.
    expect(forgot.textContent).toBe("Forgot?");
  });

  it("puts the one error under the password, announced politely, and nowhere else", () => {
    show(<LoginForm {...login({ error: "Wrong email or password" })} />);
    const password = screen.getByPlaceholderText("Enter your password");
    const message = screen.getByText("Wrong email or password");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(password.getAttribute("aria-invalid")).toBe("true");
    expect(password.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByPlaceholderText("Email or username").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getAllByText("Wrong email or password")).toHaveLength(1);
  });

  it("is a column of the card's own rhythm: 12px on a desktop and 10px on a phone", () => {
    const { container, unmount } = show(<LoginForm {...login()} />);
    // UI-P52 density pass: 12 / 10 → 9 / 7.
    expect(container.querySelector("form")!.getAttribute("style")).toContain("gap: 9px");
    unmount();
    setViewport("phone");
    const phone = show(<LoginForm {...login()} />);
    expect(phone.container.querySelector("form")!.getAttribute("style")).toContain("gap: 7px");
  });
});

describe("SignupForm", () => {
  it("has the existing signup fields, with the placeholders the specs find them by", () => {
    show(<SignupForm {...signup()} />);
    for (const placeholder of ["Your name", "username", "you@example.com", "At least 8 characters"]) {
      expect(screen.getByPlaceholderText(placeholder)).toBeTruthy();
    }
    for (const label of ["Display name", "Username", "Email", "Password"]) {
      expect(screen.getByLabelText(label, { exact: true })).toBeTruthy();
    }
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("type")).toBe("email");
    expect(screen.getByPlaceholderText("At least 8 characters").getAttribute("autocomplete")).toBe("new-password");
    expect(screen.getByPlaceholderText("Your name").getAttribute("autocomplete")).toBe("name");
  });

  it("lower-cases the username as it is typed, and shows the address it will have", () => {
    const onUsernameChange = vi.fn();
    const { rerender } = show(<SignupForm {...signup({ onUsernameChange })} />);
    fireEvent.change(screen.getByPlaceholderText("username"), { target: { value: "Ada_L" } });
    expect(onUsernameChange).toHaveBeenCalledWith("ada_l");
    expect(screen.queryByText(/buildgallery\.ai\/profile\//)).toBeNull();
    rerender(inRouter(<SignupForm {...signup({ username: "ada_l" })} />));
    expect(screen.getByText("buildgallery.ai/profile/ada_l")).toBeTruthy();
  });

  it("shows the checks under the field they are about", () => {
    show(
      <SignupForm
        {...signup({
          usernameValidation: { state: "invalid", message: "Username must be at least 3 characters" },
          emailValidation: { state: "invalid", message: "Please enter a valid email" },
        })}
      />,
    );
    expect(screen.getByPlaceholderText("username").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Username must be at least 3 characters").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText("Please enter a valid email").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByPlaceholderText("At least 8 characters").getAttribute("aria-invalid")).toBe("false");
  });

  it("reports leaving the email, for its check", () => {
    const onEmailBlur = vi.fn();
    show(<SignupForm {...signup({ onEmailBlur })} />);
    fireEvent.blur(screen.getByPlaceholderText("you@example.com"));
    expect(onEmailBlur).toHaveBeenCalledTimes(1);
  });

  it("shows the strength meter once there is a password, with the word the page worked out", () => {
    const { rerender } = show(<SignupForm {...signup({ password: "", passwordStrength: "weak" })} />);
    expect(screen.queryByRole("img", { name: /Password strength/ })).toBeNull();
    rerender(inRouter(<SignupForm {...signup({ password: "abcdefgh1", passwordStrength: "fair" })} />));
    expect(screen.getByRole("img", { name: "Password strength: Fair" })).toBeTruthy();
  });

  it("keeps the terms box the shape the join spec clicks, with the two links in the words", () => {
    const onAgreedToTermsChange = vi.fn();
    const { container } = show(<SignupForm {...signup({ onAgreedToTermsChange })} />);
    const box = container.querySelector('label[for="terms"] > div')!;
    expect(box.querySelector("input#terms")).not.toBeNull();
    fireEvent.click(box.lastElementChild!);
    expect(onAgreedToTermsChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("link", { name: "Terms of Service" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe("/privacy");
  });

  it("disables Create account until the page says it can be sent, and says what it is doing", () => {
    const { rerender } = show(<SignupForm {...signup({ canSubmit: false })} />);
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    rerender(inRouter(<SignupForm {...signup({ canSubmit: true })} />));
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
    rerender(inRouter(<SignupForm {...signup({ isSubmitting: true })} />));
    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled();
  });

  it("puts the form's one error under the terms, announced politely", () => {
    show(<SignupForm {...signup({ error: "That email is already registered — try signing in instead." })} />);
    const message = screen.getByText("That email is already registered — try signing in instead.");
    expect(message.getAttribute("aria-live")).toBe("polite");
    expect(message.previousElementSibling!.matches('label[for="terms"]')).toBe(true);
  });

  it("has the same three providers as Sign in", () => {
    show(<SignupForm {...signup()} />);
    expect(screen.getAllByRole("button", { name: /^Continue with/ })).toHaveLength(3);
    expect(screen.getByText("or with email")).toBeTruthy();
  });
});

describe("ResetRequestForm", () => {
  const request = (over = {}) => ({
    email: "",
    onEmailChange: () => {},
    canSubmit: true,
    isSubmitting: false,
    onSubmit: () => {},
    ...over,
  });

  it("keeps the existing words, and the title the entrance spec looks for", () => {
    show(<ResetRequestForm {...request()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Reset your password" })).toBeTruthy();
    expect(screen.getByText(/Enter your email and we'll send a link that lets you set a new password/)).toBeTruthy();
    expect(screen.getByText(/The link works once and expires after an hour\./)).toBeTruthy();
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("type")).toBe("email");
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
  });

  it("is the join form's field, with its error under it and its gate on the button", () => {
    const { rerender } = show(<ResetRequestForm {...request({ error: "Please enter a valid email." })} />);
    expect(screen.getByText("Please enter a valid email.").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByPlaceholderText("you@example.com").getAttribute("aria-invalid")).toBe("true");
    rerender(inRouter(<ResetRequestForm {...request({ canSubmit: false })} />));
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeDisabled();
    rerender(inRouter(<ResetRequestForm {...request({ isSubmitting: true })} />));
    expect(screen.getByRole("button", { name: "Sending..." })).toBeDisabled();
  });
});

describe("ResetConfirmForm", () => {
  const confirm = (over = {}) => ({
    password: "",
    confirmPassword: "",
    passwordStrength: "weak" as const,
    onPasswordChange: () => {},
    onConfirmPasswordChange: () => {},
    canSubmit: true,
    isSubmitting: false,
    onSubmit: () => {},
    ...over,
  });

  it("keeps the existing words and both password fields", () => {
    show(<ResetConfirmForm {...confirm()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Choose a new password" })).toBeTruthy();
    expect(screen.getByText(/Your reset link is valid\./)).toBeTruthy();
    expect(screen.getByLabelText("New password", { exact: true })).toBeTruthy();
    expect(screen.getByLabelText("Confirm password", { exact: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
  });

  it("shows the strength under the new password, the mismatch under the confirmation and the refusal under both", () => {
    show(
      <ResetConfirmForm
        {...confirm({ password: "abcdefgh1", passwordStrength: "fair", mismatchError: "Passwords don't match", error: "Please choose a stronger password." })}
      />,
    );
    expect(screen.getByRole("img", { name: "Password strength: Fair" })).toBeTruthy();
    expect(screen.getByText("Passwords don't match").getAttribute("aria-live")).toBe("polite");
    expect(screen.getByLabelText("Confirm password", { exact: true }).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Please choose a stronger password.").getAttribute("aria-live")).toBe("polite");
  });

  it("says what it is doing while the new password is out", () => {
    show(<ResetConfirmForm {...confirm({ isSubmitting: true })} />);
    expect(screen.getByRole("button", { name: "Updating..." })).toBeDisabled();
  });
});

describe("the reset and link states", () => {
  it("says to check the inbox, naming the address, with the way back", () => {
    show(<ResetSent email="ada@example.com" />);
    expect(screen.getByRole("heading", { level: 2, name: "Check your inbox" })).toBeTruthy();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText(/it works once and expires after an hour/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to sign in" }).getAttribute("href")).toBe("/login");
  });

  it("says the link does not work, offers a new one, and says the password has not changed", () => {
    const onRequestNew = vi.fn();
    show(<ResetLinkError onRequestNew={onRequestNew} />);
    expect(screen.getByRole("heading", { level: 2, name: "This reset link doesn't work" })).toBeTruthy();
    expect(screen.getByText(/your password has not changed/)).toBeTruthy();
    const request = screen.getByRole("button", { name: "Request a new one" });
    expect(request.getAttribute("type")).toBe("button");
    fireEvent.click(request);
    expect(onRequestNew).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Back to sign in" })).toBeTruthy();
  });

  it("says it is checking, as a status, without printing a code comment into the card", () => {
    const { container } = show(<LinkChecking title="Checking your reset link…">We&apos;re confirming the link is still valid.</LinkChecking>);
    expect(screen.getByRole("heading", { level: 2, name: "Checking your reset link…" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("We're confirming the link is still valid.");
    expect(container.textContent).not.toContain("/*");
  });
});
