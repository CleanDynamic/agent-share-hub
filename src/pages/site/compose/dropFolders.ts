/* CA-04 P4 — what was dropped, with where each file sat.

   A dropped folder arrives as one entry, not as its files. Each entry is walked (a folder's files, its folders' files,
   to eight levels, at most 200 files) so a skill's folder keeps its SKILL.md beside the files that go with it. A file
   dropped on its own sits nowhere: its path is its name. */

const MAX_FILES = 200;
const MAX_DEPTH = 8;

interface Entry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath?: string;
  file?: (done: (file: File) => void, failed: (error: unknown) => void) => void;
  createReader?: () => { readEntries: (done: (entries: Entry[]) => void, failed: (error: unknown) => void) => void };
}

const fileOf = (entry: Entry) => new Promise<File>((resolve, reject) => entry.file?.(resolve, reject));

async function childrenOf(entry: Entry): Promise<Entry[]> {
  const reader = entry.createReader?.();
  if (!reader) return [];
  const all: Entry[] = [];
  // readEntries hands its entries over in batches until it hands over none.
  for (;;) {
    const batch = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

const entriesOf = (data: DataTransfer): Entry[] =>
  Array.from(data.items ?? [])
    .map((item) => (typeof (item as { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry === "function" ? (item as unknown as { webkitGetAsEntry: () => Entry | null }).webkitGetAsEntry() : null))
    .filter((entry): entry is Entry => entry !== null);

/** Whether a drop holds a folder, which has to be walked. */
export const holdsFolder = (data: DataTransfer): boolean => entriesOf(data).some((entry) => entry.isDirectory);

/** The files of a drop and their paths ("order-forms/SKILL.md"), folders walked. */
export async function readDrop(data: DataTransfer): Promise<{ files: File[]; paths: string[] }> {
  const entries = entriesOf(data);
  if (!entries.some((entry) => entry.isDirectory)) {
    const files = Array.from(data.files);
    return { files, paths: files.map((file) => file.name) };
  }
  const files: File[] = [];
  const paths: string[] = [];
  const walk = async (entry: Entry, path: string, depth: number) => {
    if (files.length >= MAX_FILES || depth > MAX_DEPTH) return;
    if (entry.isFile) {
      files.push(await fileOf(entry));
      paths.push(path);
      return;
    }
    for (const child of await childrenOf(entry)) await walk(child, `${path}/${child.name}`, depth + 1);
  };
  for (const entry of entries) await walk(entry, entry.name, 0);
  return { files, paths };
}
