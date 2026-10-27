/**
 * 01 - Read Trial Balance            (Internal Review Agent - reader script)
 * Run against: the Yardi Trial Balance workbook (.xlsx). READ-ONLY - writes nothing.
 * Returns:     property code, period, and every account row, for the compare script.
 */
interface TBRow { account: string; name: string; forward: number; debit: number; credit: number; ending: number; }
interface TBResult {
  ok: boolean; propertyCode: string; propertyName: string; period: string; book: string;
  rowCount: number; sumEnding: number; arithmeticAgreement: number; issues: string[]; rows: TBRow[];
}

function main(workbook: ExcelScript.Workbook): TBResult {
  const out: TBResult = { ok: false, propertyCode: "", propertyName: "", period: "", book: "",
    rowCount: 0, sumEnding: 0, arithmeticAgreement: 0, issues: [], rows: [] };

  // Pick the sheet that says "Trial Balance" near the top; fall back to the first sheet.
  let grid: (string | number | boolean)[][] = [];
  for (const ws of workbook.getWorksheets()) {
    const g = readGrid(ws);
    if (grid.length === 0) grid = g;
    if (g.slice(0, 8).some(r => r.some(c => /trial balance/i.test(String(c))))) { grid = g; break; }
  }
  if (grid.length === 0) { out.issues.push("Workbook is empty."); return out; }

  // Header block: "610 West (mn610wes)", "Period = Jul 2026", "Book = Accrual"
  for (const r of grid.slice(0, 8)) {
    const t = String(r[0] ?? "").trim();
    const code = t.match(/^(.*)\(([^)]+)\)\s*$/);
    if (code && !out.propertyCode) { out.propertyName = code[1].trim(); out.propertyCode = code[2].trim().toLowerCase(); }
    if (/^period\s*=/i.test(t)) out.period = lastMonthYear(t);
    if (/^book\s*=/i.test(t)) out.book = t.replace(/^book\s*=\s*/i, "").trim();
  }
  if (!out.propertyCode) out.issues.push("Property code not found in the TB header.");
  if (!out.period) out.issues.push("Period not found in the TB header.");

  // Column layout: locate the Debit / Credit header row. Forward is left of Debit, Ending right of Credit.
  let dCol = -1, cCol = -1, hdrRow = -1;
  for (let i = 0; i < Math.min(grid.length, 15) && hdrRow < 0; i++) {
    const labels = grid[i].map(c => String(c).trim().toLowerCase());
    if (labels.indexOf("debit") >= 0 && labels.indexOf("credit") >= 0) { dCol = labels.indexOf("debit"); cCol = labels.indexOf("credit"); hdrRow = i; }
  }
  if (hdrRow < 0) { out.issues.push("Debit/Credit column headers not found - is this a Yardi Trial Balance export?"); return out; }
  const fCol = dCol - 1, eCol = cCol + 1;

  let agree = 0;
  for (let i = hdrRow + 1; i < grid.length; i++) {
    const acct = String(grid[i][0] ?? "").trim();
    if (!/^\d{4,6}(-\d{2,4})?$/.test(acct)) continue;               // skips blanks, headings and the Total row
    const row: TBRow = { account: acct, name: String(grid[i][1] ?? "").trim(),
      forward: toNum(grid[i][fCol]), debit: toNum(grid[i][dCol]), credit: toNum(grid[i][cCol]), ending: toNum(grid[i][eCol]) };
    if (isNaN(row.ending)) { out.issues.push(`Row ${i + 1} (${acct}): ending balance is not numeric.`); continue; }
    if (r2(row.forward + row.debit - row.credit) === r2(row.ending)) agree++;
    out.rows.push(row);
  }
  out.rowCount = out.rows.length;
  out.sumEnding = r2(out.rows.reduce((s, r) => s + r.ending, 0));
  out.arithmeticAgreement = out.rowCount ? Math.round((agree / out.rowCount) * 10000) / 10000 : 0;
  if (out.rowCount === 0) out.issues.push("No account rows were read.");
  out.ok = out.rowCount > 0 && out.propertyCode !== "" && out.period !== "";
  console.log(`TRIAL BALANCE READ: ${out.propertyCode} ${out.period} | ${out.rowCount} accounts | in balance: ${out.sumEnding === 0} | problems: ${out.issues.length}`);
  return out;
}

/** Used range as a grid anchored at A1, so grid[r][c] always lines up with the sheet. */
function readGrid(ws: ExcelScript.Worksheet): (string | number | boolean)[][] {
  const used = ws.getUsedRange();
  if (!used) return [];
  const vals = used.getValues(), r0 = used.getRowIndex(), c0 = used.getColumnIndex();
  const width = c0 + (vals.length ? vals[0].length : 0);
  const grid: (string | number | boolean)[][] = [];
  for (let i = 0; i < r0; i++) grid.push(new Array<string>(width).fill(""));
  for (const v of vals) grid.push(new Array<string | number | boolean>(c0).fill("").concat(v));
  return grid;
}
function toNum(v: string | number | boolean | undefined): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim(); if (s === "") return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(s.replace(/[(),$\s-]/g, ""));
  return isNaN(n) ? NaN : (neg ? -n : n);
}
function r2(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
/** "Period = Jul 2026" or "Period = Jan 2026-Jul 2026"  ->  "07-2026" (last month named). */
function lastMonthYear(t: string): string {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const all = t.match(/[A-Za-z]{3}[a-z]*\s+\d{4}/g); if (!all) return "";
  const p = all[all.length - 1].split(/\s+/), m = months.indexOf(p[0].substring(0, 3).toLowerCase());
  return m < 0 ? "" : `${m < 9 ? "0" : ""}${m + 1}-${p[1]}`;
}
