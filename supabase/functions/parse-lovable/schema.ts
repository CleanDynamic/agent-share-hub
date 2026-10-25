import { z } from "zod/v4";

// The shape of the request. Too long a text is a 413, checked after this.
export const Body = z.object({
  raw_text: z.string().refine((value) => value.trim() !== "", "is empty. Drop the export file before parsing."),
  build_id: z.guid(),
  source_hint: z.string().nullish(),
});
