// CA-05 P7 — test cases sent with a Check: a .csv, .json or .jsonl file, and how many cases it holds.
//
// PURE. A count is given only when the file's rows can be counted EXACTLY; otherwise there is none and the Check
// says nothing of it. A csv's first record is its header and is not a case. A json file is counted when it is a list
// at the top; a jsonl file when every non-empty line is JSON. Nothing is guessed, and an empty file has no cases.

/** The most text read to count cases. */
export const TEST_FILE_MAX_BYTES = 5 * 1024 * 1024;

export const isTestFileName = (name: string): boolean => /\.(csv|json|jsonl)$/i.test(name);

/** The records of a csv (RFC 4180: quotes, doubled quotes, line breaks inside quotes), or null when a quote is left open or one is out of place. */
function csvRecords(text: string): number | null {
  let records = 0;
  let inQuotes = false;
  let fieldStart = true;
  let rowHasContent = false;
  const body = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') {
        if (body[i + 1] === '"') i += 1;
        else {
          inQuotes = false;
          // After a closing quote only a separator or the end of the line may follow.
          const next = body[i + 1];
          if (next !== undefined && next !== "," && next !== "\n" && next !== "\r") return null;
        }
      }
      continue;
    }
    if (c === '"') {
      if (!fieldStart) return null;
      inQuotes = true;
      rowHasContent = true;
      fieldStart = false;
    } else if (c === ",") {
      fieldStart = true;
      rowHasContent = true;
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && body[i + 1] === "\n") i += 1;
      if (rowHasContent) records += 1;
      rowHasContent = false;
      fieldStart = true;
    } else {
      fieldStart = false;
      rowHasContent = true;
    }
  }
  if (inQuotes) return null;
  if (rowHasContent) records += 1;
  return records;
}

/** How many cases a test file holds, or null when they cannot be counted exactly (or there are none). */
export function countCases(name: string, text: string): number | null {
  const kind = /\.(csv|json|jsonl)$/i.exec(name)?.[1]?.toLowerCase();
  if (!kind) return null;
  let count: number | null = null;
  if (kind === "csv") {
    const records = csvRecords(text);
    count = records === null ? null : records - 1;
  } else if (kind === "json") {
    try {
      const value: unknown = JSON.parse(text);
      count = Array.isArray(value) ? value.length : null;
    } catch {
      count = null;
    }
  } else {
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    try {
      lines.forEach((line) => JSON.parse(line));
      count = lines.length;
    } catch {
      count = null;
    }
  }
  return count !== null && count > 0 ? count : null;
}

/** "Tested on 40 cases". */
export const casesLine = (cases: number): string => `Tested on ${cases.toLocaleString("en-GB")} ${cases === 1 ? "case" : "cases"}`;
