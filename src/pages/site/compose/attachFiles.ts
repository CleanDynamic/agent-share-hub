/* TF-06 — attach files straight onto a prompt.

   Each file is added to the build, then listed as an input of the prompt, one after the other so the inputs
   keep the order the files were given. `add` resolves with the new file's node id, or null when the file was
   refused or failed (it has already told the maker); that file is skipped and the rest carry on. */

import type { Use } from "@/lib/build/graph";

export async function attachFiles(
  stepId: string,
  files: readonly File[],
  add: (file: File) => Promise<{ id: string } | null>,
  link: (stepId: string, use: Use) => void,
): Promise<void> {
  for (const file of files) {
    const node = await add(file);
    if (node) link(stepId, { kind: "file", node_id: node.id });
  }
}
