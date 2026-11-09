// UX-15 P2: the six sections of Settings, their addresses and their names.
//
// PURE. `/settings` is the list; `/settings/:section` is one section. An address with a section this file does not know shows `/settings`.

export const SETTINGS_PATH = "/settings";

export const SECTIONS = [
  { key: "account", label: "Account", note: "Email, password, sign-in methods and devices" },
  { key: "notifications", label: "Notifications", note: "What you hear about" },
  { key: "privacy", label: "Privacy and blocking", note: "Your profile and the people you have blocked" },
  { key: "apps", label: "Connected apps", note: "Apps that can use your account" },
  { key: "data", label: "Your data", note: "Download your data or delete your account" },
  { key: "appearance", label: "Appearance", note: "Light, dark or your system's setting" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

/** The section an address names, or null for no section or one that does not exist. */
export function sectionOf(param: string | undefined): SectionKey | null {
  return SECTIONS.find((section) => section.key === param)?.key ?? null;
}

export function sectionLabel(key: SectionKey): string {
  return SECTIONS.find((section) => section.key === key)!.label;
}

export function settingsPath(key?: SectionKey): string {
  return key ? `${SETTINGS_PATH}/${key}` : SETTINGS_PATH;
}
