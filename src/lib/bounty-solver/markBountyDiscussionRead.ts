import { supabase } from "@/integrations/supabase/client";
import { resolveBountyRowId } from "./resolveBountyRowId";

export async function markBountyDiscussionRead(args: {
  bountyId: string;
  userId: string;
}): Promise<void> {
  const { bountyId, userId } = args;

  // NS-P47 shim (removed in NS-P50). The primary key of this table is
  // (bounty_id, user_id) and bounty_id is now a public.bounties id, so both the
  // row and the conflict target need the resolved header id.
  const bountyRowId = await resolveBountyRowId(bountyId);

  await (supabase as any)
    .from("bounty_comment_last_read")
    .upsert(
      {
        bounty_id: bountyRowId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      } as any,
      { onConflict: "bounty_id,user_id" },
    );
}
