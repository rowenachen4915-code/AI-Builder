/**
 * 03 - Read Yardi Financial Report      (Internal Review Agent - reader script)
 * ONE script for THREE files. Run it once against each of:
 *    - 12 Month Statement (T12)      - Budget Comparison      - Balance Sheet (With Period Change)
 * READ-ONLY - writes nothing. Returns the report title, property, period, the column headings,
 * and every account row with its numbers, tagged as "detail" or "total" and with its section heading.
 */
interface FinRow { account: string; name: string; section: string; kind: string; values: number[]; }
interface FinResult {
  ok: boolean; reportTitle: string; propertyCode: string; propertyName: string; period: string; book: string;
  columns: string[]; rowCount: number; issues: string[]; rows: FinRow[];
}

function main(workbook: ExcelScript.Workbook): FinResult {
  const out: FinResult = { ok: false, reportTitle: "", propertyCode: "", propertyName: "", period: "", book: "", columns: [], rowCount: 0, issues: [], rows: [] };
  const sheets = workbook.getWorksheets();
  if (sheets.length === 0) { out.issues.push("Workbook has no sheets."); return out; }
  const grid = readGrid(sheets[0]);
  if (grid.length < 6) { out.issues.push("Report is empty."); return out; }

  // Header block (first rows of column A)
  let firstAcct = -1;
  for (let i = 0; i < grid.length; i++) { if (isAcct(txt(grid[i][0]))) { firstAcct = i; break; } }
  if (firstAcct < 0) { out.issues.push("No GL account rows found - is this a Yardi financial report saved as .xlsx?"); return out; }
  for (let i = 0; i < Math.min(firstAcct, 8); i++) {
    const t = txt(grid[i][0]); if (t === "") continue;
    const code = t.match(/^(.*)\(([^)]+)\)\s*$/);
    if (code && !out.propertyCode) { out.propertyName = code[1].trim(); out.propertyCode = code[2].trim().toLowerCase(); }
    else if (/^period\s*=/i.test(t)) out.period = lastMonthYear(t);
    else if (/^book\s*=/i.test(t)) out.book = t.replace(/^book\s*=\s*/i, "").split(";")[0].trim();
    else if (!out.reportTitle && i > 0) out.reportTitle = t;
  }
  if (!out.propertyCode) out.issues.push("Property code not found in the report header.");
  if (!out.period) out.issues.push("Period not found in the report header.");

  // Column headings: the label rows sit directly above the first account row, from column C across (may be stacked on two rows)
  const width = grid[firstAcct].length;
  for (let c = 2; c < width; c++) {
    const parts: string[] = [];
    for (let i = Math.max(0, firstAcct - 3); i < firstAcct; i++) { const p = txt(grid[i][c]); if (p !== "" && txt(grid[i][0]) === "") parts.push(p); }
    out.columns.push(parts.join(" "));
  }
  while (out.columns.length > 0 && out.columns[out.columns.length - 1] === "") out.columns.pop();

  // Account rows
  let section = "";
  for (let i = firstAcct; i < grid.length; i++) {
    const acct = txt(grid[i][0]), name = txt(grid[i][1]);
    if (!isAcct(acct)) continue;
    const cells = grid[i].slice(2, 2 + out.columns.length);
    if (cells.every(v => v === "" || v === undefined)) { section = name; continue; }                // heading row
    const values = cells.map(v => typeof v === "number" ? v : toNum(v));
    let bad = false;                                                                                  // "N/A" is normal in % columns
    values.forEach((v, k) => { if (isNaN(v)) { if (out.columns[k].indexOf("%") < 0) bad = true; values[k] = 0; } });
    if (bad) { out.issues.push(`Row ${i + 1} (${acct}): an amount is not numeric.`); continue; }
    const kind = /^total\b/i.test(name) || /-(09\d|\d99)$/.test(acct) ? "total" : "detail";
    out.rows.push({ account: acct, name, section, kind, values });
  }
  out.rowCount = out.rows.length;
  out.ok = out.rowCount > 0 && out.propertyCode !== "" && out.period !== "";
  console.log(`${out.reportTitle.toUpperCase()} READ: ${out.propertyCode} ${out.period} | ${out.rowCount} rows | ${out.columns.length} columns | problems: ${out.issues.length}`);
  return out;
}

function readGrid(ws: ExcelScript.Worksheet): (string | number | boolean)[][] {
  const used = ws.getUsedRange(); if (!used) return [];
  const vals = used.getValues(), r0 = used.getRowIndex(), c0 = used.getColumnIndex();
  const width = c0 + (vals.length ? vals[0].length : 0);
  const grid: (string | number | boolean)[][] = [];
  for (let i = 0; i < r0; i++) grid.push(new Array<string>(width).fill(""));
  for (const v of vals) grid.push(new Array<string | number | boolean>(c0).fill("").concat(v));
  return grid;
}
function txt(v: string | number | boolean | undefined): string { return String(v ?? "").trim(); }
function isAcct(s: string): boolean { return /^\d{4,6}(-\d{2,4})?$/.test(s); }
function toNum(v: string | number | boolean | undefined): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim(); if (s === "") return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(s.replace(/[(),$%\s-]/g, ""));
  return isNaN(n) ? NaN : (neg ? -n : n);
}
function lastMonthYear(t: string): string {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const all = t.match(/[A-Za-z]{3}[a-z]*\s+\d{4}/g); if (!all) return "";
  const p = all[all.length - 1].split(/\s+/), m = months.indexOf(p[0].substring(0, 3).toLowerCase());
  return m < 0 ? "" : `${m < 9 ? "0" : ""}${m + 1}-${p[1]}`;
}
