// UX-12 P3: the one place the two flags live. Set one to true when its text has been filled in and reviewed, and update its
// `lastUpdated` in privacy.ts or terms.ts. While a flag is false the page carries a draft notice and `noindex`, and the footer
// and sign-up links to it stay hidden. A test fails the build if a flag is true and a `{{NEED:` remains in that text.
//
// This file is separate and tiny so the footer and the sign-up form can read the flags without downloading the text.

export const PRIVACY_REVIEWED = false;
export const TERMS_REVIEWED = false;
