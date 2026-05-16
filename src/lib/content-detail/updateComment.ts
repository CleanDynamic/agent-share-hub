import { supabase } from "@/integrations/supabase/client";

function extractPlainText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractPlainText).join("");
  if (typeof node !== "object") return "";
  let out = "";
  if (node.type === "text" && typeof node.text === "string") out += node.text;
  if (Array.isArray(node.content)) out += node.content.map(extractPlainText).join("");
  if (node.type && /paragraph|heading|listItem|blockquote/.test(node.type)) out += "\n";
  return out;
}

/**
 * Update a comment's body. RLS enforces:
 *  - caller is author
 *  - created_at within 5 minutes
 *  - comment not deleted
 */
export async function updateComment({
  commentId,
  body,
}: {
  commentId: string;
  body: any;
}) {
  const bodyText = extractPlainText(body).trim();
  const { data, error } = await (supabase as any)
    .from("primitive_comments")
    .update({
      body,
      body_text: bodyText,
      is_edited: true,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", commentId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "Could not edit comment. The 5-minute edit window may have passed.",
    );
  }
  return data;
}
