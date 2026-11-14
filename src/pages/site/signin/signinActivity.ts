/* What the halftone layer needs to know from the forms, with no React between them: whether a sign-in is out (the
   signing-in ripple, Reference C). The Sign in and Join free views say so while their request or a provider is out; the
   layer reads it each frame. */

let signingIn = false;

export function setSigningIn(value: boolean) {
  signingIn = value;
}

export function isSigningIn(): boolean {
  return signingIn;
}
