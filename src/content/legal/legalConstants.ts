// Prompt 9 (G17, G18): the legal texts' versions and the minimum age, in one tiny file so the sign-up form and the
// acceptance dialog can read them without downloading the texts.
//
// A version is the text's `lastUpdated` date (privacy.ts and terms.ts read theirs from here). The same two dates are
// held in the database (public.legal_versions(), migration 20261117120000); legalConstants.test.ts fails if they differ.
// When a text changes: change its date here, add a migration that replaces legal_versions(), and members are asked again.

export const TERMS_VERSION = "2026-11-06";
export const PRIVACY_VERSION = "2026-11-06";

/** The minimum age for an account, 13 or 18. null until the owner answers (docs/legal/owner-answers.md 3.1). */
export const MINIMUM_AGE: 13 | 18 | null = null;
