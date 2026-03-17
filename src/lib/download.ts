import { supabase } from "@/integrations/supabase/client";
import { insertNotification } from "@/lib/notifications";

export function getDownloadLabel(contentType: string, monetisationType: string, priceGbp?: number): string {
  if (monetisationType === "paid") {
    return `Unlock for £${(priceGbp ?? 0).toFixed(2)}`;
  }
  switch (contentType) {
    case "Workflow Template":
    case "Agent Stack":
      return "Download Template";
    case "Integration Guide":
    case "Evaluation Framework":
      return "Read Guide";
    default:
      return "Download Free";
  }
}

export async function triggerDownload(contentId: string, fileUrl: string | null): Promise<{ newCount?: number; error?: string }> {
  if (!fileUrl) return { error: "No file available for this item." };

  // Get signed URL (valid for 60 seconds)
  const { data: signedData, error: signError } = await supabase.storage
    .from("content-files")
    .createSignedUrl(fileUrl, 60);

  if (signError || !signedData?.signedUrl) {
    return { error: "Could not generate download link. Please try again." };
  }

  // Open download
  const a = document.createElement("a");
  a.href = signedData.signedUrl;
  a.download = fileUrl.split("/").pop() || "download";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Increment count (fire and forget)
  const { data: { user } } = await supabase.auth.getUser();

  await Promise.all([
    supabase.rpc("increment_download_count", { _content_id: contentId }),
    supabase.from("downloads").insert({
      content_id: contentId,
      user_id: user?.id ?? null,
    }),
  ]);

  // Send download notification (fire and forget)
  if (user) {
    const { data: contentRow } = await supabase
      .from("content_items")
      .select("creator_id, title")
      .eq("id", contentId)
      .maybeSingle();
    if (contentRow && contentRow.creator_id !== user.id) {
      const { data: myProfile } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      insertNotification({
        recipient_id: contentRow.creator_id,
        actor_id: user.id,
        notification_type: "new_download",
        content_id: contentId,
        metadata: { content_title: contentRow.title, downloader: myProfile?.username || "" },
      });
    }
  }

  // Fetch updated count
  const { data: updated } = await supabase
    .from("content_items")
    .select("download_count")
    .eq("id", contentId)
    .maybeSingle();

  return { newCount: updated?.download_count };
}
