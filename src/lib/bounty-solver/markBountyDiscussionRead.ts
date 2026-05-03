import { supabase } from "@/integrations/supabase/client";

export async function markBountyDiscussionRead(args: {
  bountyId: string;
  userId: string;
}): Promise<void> {
  const { bountyId, userId } = args;
  await (supabase as any)
    .from("bounty_comment_last_read")
    .upsert(
      {
        bounty_id: bountyId,
        user_id: userId,
        last_read_at: new Date().toISOString(),
      } as any,
      { onConflict: "bounty_id,user_id" },
    );
}
