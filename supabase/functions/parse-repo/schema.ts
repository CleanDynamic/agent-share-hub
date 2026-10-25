import { z } from "zod/v4";

const MAX_URL_CHARS = 500;

// The shape of the request. Whether the URL is a GitHub repository is checked after this.
export const Body = z.object({
  repo_url: z.string().refine((value) => value.trim() !== "", "is required").max(MAX_URL_CHARS, "is too long to be a repository URL"),
  build_id: z.guid(),
  source_hint: z.string().nullish(),
});
