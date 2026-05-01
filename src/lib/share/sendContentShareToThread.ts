import { sendContentShareMessage } from "@/lib/messaging/sendMessage";
import type { Message, SharedContentType } from "@/lib/messaging/types";

export interface SendContentShareToThreadArgs {
  threadId: string;
  contentType: SharedContentType;
  contentId: string;
  note?: string;
}

/**
 * Thin wrapper around the messaging layer's content-share sender.
 * Centralises the share-to-thread call site so the share UI doesn't have to
 * import directly from the messaging module.
 */
export async function sendContentShareToThread({
  threadId,
  contentType,
  contentId,
  note,
}: SendContentShareToThreadArgs): Promise<Message> {
  return sendContentShareMessage(threadId, contentType, contentId, note);
}
