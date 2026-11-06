// UX-10 P6 and P8: Customise profile's one write, pinning from an item's ···, and a build's own display.
//
// Save writes every field and the pins' order in ONE request (save_profile, 20261109120000), in one transaction. Pin to profile
// is one insert the database places and checks (three at most, only what the person made); Unpin is one delete. A build's display
// is written only by its maker (build_profile_display's policy). No write here notifies anyone.

import { supabase } from "@/integrations/supabase/client";
import { buildLayerError } from "@/lib/build/types";
import { db } from "@/lib/openbuilds/types";

import { aboutProblem, linksProblem, oneLineProblem, pinsProblem, settingsProblem, storedSettings, type BuildDisplay, type Pin, type ProfileSettings } from "./settings";

export interface ProfileDraft {
  displayName: string;
  oneLine: string;
  location: string;
  links: string[];
  about: string;
  settings: ProfileSettings;
  pins: Pin[];
}

/** Why Save would be refused, or null. Checked before the request. */
export function draftProblem(draft: ProfileDraft): string | null {
  const links = draft.links.map((link) => link.trim()).filter(Boolean);
  return oneLineProblem(draft.oneLine) ?? aboutProblem(draft.about) ?? linksProblem(links) ?? pinsProblem(draft.pins) ?? settingsProblem(storedSettings(draft.settings));
}

/** The draft as save_profile takes it. */
export function savePayload(draft: ProfileDraft): Record<string, unknown> {
  return {
    display_name: draft.displayName.trim(),
    bio: draft.oneLine.trim(),
    location: draft.location.trim(),
    links: draft.links.map((link) => link.trim()).filter(Boolean),
    about: draft.about.trim(),
    profile_settings: storedSettings(draft.settings),
    pins: draft.pins.map((pin) => ({ kind: pin.kind, id: pin.id })),
  };
}

type Rpc = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

/** Everything Customise profile holds, in one request. */
export async function saveProfile(draft: ProfileDraft): Promise<void> {
  const problem = draftProblem(draft);
  if (problem) throw new Error(problem);
  const { error } = await (supabase.rpc as unknown as Rpc)("save_profile", { p: savePayload(draft) });
  if (error) throw buildLayerError("saveProfile", error);
}

/** The person's pins, in order. One request. */
export async function listPins(userId: string): Promise<Pin[]> {
  const { data, error } = await db.from("profile_pins").select("item_kind, item_id, position").eq("user_id", userId).order("position", { ascending: true }).limit(3);
  if (error) throw buildLayerError("listPins", error);
  return ((data ?? []) as { item_kind: Pin["kind"]; item_id: string }[]).map((row) => ({ kind: row.item_kind, id: row.item_id }));
}

/** Pin to profile: the database takes the next free place, and refuses a fourth. */
export async function pinToProfile(userId: string, pin: Pin): Promise<void> {
  const { error } = await db.from("profile_pins").insert({ user_id: userId, item_kind: pin.kind, item_id: pin.id });
  if (error) throw buildLayerError("pinToProfile", error);
}

export async function unpinFromProfile(userId: string, pin: Pin): Promise<void> {
  const { error } = await db.from("profile_pins").delete().eq("user_id", userId).eq("item_kind", pin.kind).eq("item_id", pin.id);
  if (error) throw buildLayerError("unpinFromProfile", error);
}

/** One build's own display on the maker's profile. */
export async function setBuildDisplay(buildId: string, display: BuildDisplay): Promise<void> {
  const { error } = await db.from("build_profile_display").upsert({ build_id: buildId, display, updated_at: new Date().toISOString() });
  if (error) throw buildLayerError("setBuildDisplay", error);
}
