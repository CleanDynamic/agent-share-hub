/* BG-P30 — where a sweep's findings land.
 *
 * CSV rather than JSON because the audience is an operator deciding which
 * survivors to accept, and a spreadsheet is the tool for that. One row per
 * DISTINCT pairing, with the count of places it renders, so a page that puts
 * `--text2` on `--glass` two hundred times contributes one row and a 200.
 */

import fs from "node:fs";
import path from "node:path";

export const OUT_DIR = path.resolve(process.cwd(), "e2e/audit/out");

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function writeCsv(file: string, header: string[], rows: unknown[][]): string {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const target = path.join(OUT_DIR, file);
  const body = [header.join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
  fs.writeFileSync(target, body + "\n", "utf8");
  return target;
}

export function writeText(file: string, text: string): string {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const target = path.join(OUT_DIR, file);
  fs.writeFileSync(target, text.endsWith("\n") ? text : text + "\n", "utf8");
  return target;
}
