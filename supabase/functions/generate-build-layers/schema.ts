import { z } from "zod/v4";

// The shape of the request. Which layers are valid is requestedLayers' job.
export const Body = z.object({
  build_id: z.guid(),
  layers: z.array(z.unknown()).nullish(),
  force: z.boolean().optional(),
});
