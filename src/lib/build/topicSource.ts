// UX-07 P6: the maker's opt-out, `builds.allow_as_post_source` (20261107130000_ux04_posts.sql; the prompt calls it
// allow_as_topic_source). On by default. Off, nobody else can start a topic from the build: the post attachment trigger refuses it,
// and the New post window's picker no longer lists it (listAttachableWork). Topics already started keep their link and credit.
//
// Read here; written with the build's other header fields, through the composer's `edit` (updateBuild), so it rides the same
// debounced, serial save as the title. It never blocks publishing and is not a checklist item.

import { supabase } from "@/integrations/supabase/client";

import { buildLayerError } from "./types";

/** Whether other people may start a topic from this build. A build that predates the column, or one not found, reads as on. */
export async function getTopicSourceSetting(buildId: string): Promise<boolean> {
  const { data, error } = await supabase.from("builds").select("allow_as_post_source").eq("id", buildId).limit(1).maybeSingle();
  if (error) throw buildLayerError("getTopicSourceSetting", error);
  return (data as { allow_as_post_source?: boolean | null } | null)?.allow_as_post_source !== false;
}

/** The header patch that sets it: what the composer's `edit` writes. */
export const topicSourcePatch = (on: boolean) => ({ allow_as_post_source: on });
