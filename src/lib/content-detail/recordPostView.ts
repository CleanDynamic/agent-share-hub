import { supabase } from "@/integrations/supabase/client";

const BOT_REGEX =
  /(googlebot|bingbot|duckduckbot|yandex|baiduspider|slurp|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|openai|gptbot|chatgpt-user|anthropic|claudebot|perplexity|cohere|applebot|crawler|spider|bot\/)/i;

export function isBotUserAgent(ua?: string | null): boolean {
  if (!ua) return false;
  return BOT_REGEX.test(ua);
}

export async function recordPostView({
  postId,
  viewerId,
  userAgent,
  referrer,
}: {
  postId: string;
  viewerId?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
}): Promise<void> {
  if (!postId) return;
  const ua = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : null);
  const ref = referrer ?? (typeof document !== "undefined" ? document.referrer : null);
  const isBot = isBotUserAgent(ua);

  const { error } = await (supabase as any)
    .from("post_view_log")
    .insert({
      post_id: postId,
      viewer_id: viewerId ?? null,
      user_agent: ua,
      referrer: ref,
      is_bot_or_crawler: isBot,
    });
  if (error) console.warn("[recordPostView] log insert failed", error);

  if (!isBot) {
    try {
      await supabase.rpc("increment_content_view_count", { _content_id: postId });
    } catch (e) {
      console.warn("[recordPostView] view count rpc failed", e);
    }
  }
}
