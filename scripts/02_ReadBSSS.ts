/**
 * 02 - Read Balance Sheet Support Schedule   (Internal Review Agent - reader script)
 * Run against: the Greystar BS Support Schedule template (.xlsm or .xlsx). READ-ONLY - writes nothing.
 * Returns:     property code, period, and one supported balance per GL account, in TB sign
 *              (debits positive, credits negative).
 * Reads:       CY tab "ACCOUNT" blocks, plus the Prepaid Other, Real Estate Taxes, Property Insurance
 *              and Accrued Expenses schedule tabs. Everything is found by LABEL, not by fixed row,
 *              so inserted rows do not break it.
 */
interface BSSSRow { account: string; name: string; balance: number; sourceTab: string; sourceCell: string; }
interface BSSSItem { account: string; date: string; description: string; amount: number; sourceCell: string; }
interface BSSSResult {
  ok: boolean; propertyCode: string; propertyName: string; period: string; preparedBy: string;
  rowCount: number; issues: string[]; rows: BSSSRow[]; items: BSSSItem[];
}
type Cell = string | number | boolean;

function main(workbook: ExcelScript.Workbook): BSSSResult {
  const out: BSSSResult = { ok: false, propertyCode: "", propertyName: "", period: "", preparedBy: "", rowCount: 0, issues: [], rows: [], items: [] };

  // ---- Input-Instructions: property + period (labels in column A, values in column B)
  const info = sheetGrid(workbook, "Input-Instructions");
  if (info.length === 0) { out.issues.push("Input-Instructions tab not found - is this the Greystar BSSS template?"); return out; }
  for (const r of info.slice(0, 15)) {
    const label = txt(r[0]).toLowerCase();
    if (label === "property name") out.propertyName = txt(r[1]);
    if (label === "property code") out.propertyCode = txt(r[1]).toLowerCase();
    if (label === "month") out.period = serialToPeriod(r[1]);
    if (label === "prepared by") out.preparedBy = txt(r[1]);
  }
  if (!out.propertyCode) out.issues.push("Property Code is blank on Input-Instructions.");
  if (!out.period) out.issues.push("Month is blank or not a date on Input-Instructions.");

  // ---- CY tab: "ACCOUNT | code | name" blocks; the block total is the last number in column G
  const cy = sheetGrid(workbook, "CY");
  if (cy.length === 0) out.issues.push("CY tab not found.");
  const starts: number[] = [];
  cy.forEach((r, i) => { if (txt(r[0]).toUpperCase() === "ACCOUNT") starts.push(i); });
  starts.forEach((s, k) => {
    const acct = txt(cy[s][1]); if (acct === "") return;                  // unused template block
    if (!isAcct(acct)) { out.issues.push(`CY!B${s + 1}: "${acct}" is not a valid GL code.`); return; }
    const end = k + 1 < starts.length ? starts[k + 1] : cy.length;
    let totalRow = -1;
    for (let i = end - 1; i > s; i--) { if (cy[i][6] !== "" && cy[i][6] !== undefined) { totalRow = i; break; } }
    if (totalRow < 0 || typeof cy[totalRow][6] !== "number") { out.issues.push(`CY ${acct}: block total in column G is missing or not numeric.`); return; }
    out.rows.push({ account: acct, name: txt(cy[s][2]), balance: cy[totalRow][6] as number, sourceTab: "CY", sourceCell: `G${totalRow + 1}` });
    for (let i = s + 1; i < totalRow; i++) {                               // open items behind the balance (used for ageing)
      const amt = cy[i][6];
      if (typeof amt === "number" && amt !== 0) out.items.push({ account: acct, date: itemDate(cy[i][1]), description: txt(cy[i][2]), amount: r2(amt), sourceCell: `G${i + 1}` });
    }
  });

  // ---- Prepaid Other: "Total | account | amount" row
  const po = sheetGrid(workbook, "Prepaid Other");
  for (let i = 0; i < po.length; i++) for (let c = 0; c < po[i].length - 2; c++) {
    if (txt(po[i][c]).toLowerCase() === "total" && isAcct(txt(po[i][c + 1])) && typeof po[i][c + 2] === "number")
      out.rows.push({ account: txt(po[i][c + 1]), name: "Prepaid - Other", balance: po[i][c + 2] as number, sourceTab: "Prepaid Other", sourceCell: addr(i, c + 2) });
  }

  // ---- Prepaid / Accrued sections (same shape on both tabs). Accrued sections show positive = credit balance.
  section(workbook, out, "Real Estate Taxes", "prepaid taxes", "total prepaid", 1);
  section(workbook, out, "Real Estate Taxes", "accrued taxes", "total accrued", -1);
  section(workbook, out, "Property Insurance", "prepaid insurance", "total prepaid", 1);
  section(workbook, out, "Property Insurance", "accrued insurance", "total accrued", -1);

  // ---- Accrued Expenses tab: label row, GL code directly under it, "Total Calculated ..." further down
  const ae = sheetGrid(workbook, "Accrued Expenses");
  for (let i = 0; i + 1 < ae.length; i++) {
    const label = txt(ae[i][0]);
    if (!/^accrued /i.test(label) || !isAcct(txt(ae[i + 1][0]))) continue;
    const acct = txt(ae[i + 1][0]);
    let found = false;
    for (let j = i + 2; j < ae.length && !found; j++) for (let c = 0; c < ae[j].length - 1; c++) {
      if (/^total calculated/i.test(txt(ae[j][c])) && typeof ae[j][c + 1] === "number") {
        out.rows.push({ account: acct, name: label, balance: -(ae[j][c + 1] as number), sourceTab: "Accrued Expenses", sourceCell: addr(j, c + 1) });
        found = true; break;
      }
    }
    if (!found) out.issues.push(`Accrued Expenses ${acct}: total row not found.`);
  }

  out.rows.forEach(r => { r.balance = r2(r.balance); });
  out.rowCount = out.rows.length;
  if (out.rowCount === 0) out.issues.push("No supported accounts were read.");
  out.ok = out.rowCount > 0 && out.propertyCode !== "" && out.period !== "";
  console.log(`BSSS READ: ${out.propertyCode} ${out.period} | ${out.rowCount} supported accounts | ${out.items.length} open items | problems: ${out.issues.length}`);
  return out;
}

/** A schedule section: "<Label>: | | account" header, a "Total ..." column heading, totals on the row under "Rounding Difference". */
function section(wb: ExcelScript.Workbook, out: BSSSResult, tab: string, label: string, totalHeading: string, sign: number): void {
  const g = sheetGrid(wb, tab); if (g.length === 0) return;               // optional tab
  for (let i = 0; i < g.length; i++) {
    const c0 = g[i].findIndex(v => txt(v).toLowerCase().replace(/:$/, "") === label);
    if (c0 < 0) continue;
    const acct = g[i].map(v => txt(v)).find(v => isAcct(v)) ?? "";
    if (acct === "") { out.issues.push(`${tab}: no GL code beside "${label}".`); return; }
    let totalCol = -1;
    for (let h = i + 1; h <= i + 2 && h < g.length && totalCol < 0; h++) totalCol = g[h].findIndex(v => txt(v).toLowerCase() === totalHeading);
    let totalRow = -1;
    for (let j = i + 1; j < g.length && j < i + 60; j++) if (g[j].some(v => /^rounding difference$/i.test(txt(v)))) { totalRow = j + 1; break; }
    if (totalCol < 0 || totalRow < 0 || totalRow >= g.length || typeof g[totalRow][totalCol] !== "number") { out.issues.push(`${tab} ${acct}: section total not found.`); return; }
    out.rows.push({ account: acct, name: label.replace(/\b\w/g, m => m.toUpperCase()), balance: sign * (g[totalRow][totalCol] as number), sourceTab: tab, sourceCell: addr(totalRow, totalCol) });
    return;
  }
}

function sheetGrid(wb: ExcelScript.Workbook, name: string): Cell[][] {
  const ws = wb.getWorksheet(name); if (!ws) return [];
  const used = ws.getUsedRange(); if (!used) return [];
  const vals = used.getValues(), r0 = used.getRowIndex(), c0 = used.getColumnIndex();
  const width = c0 + (vals.length ? vals[0].length : 0);
  const grid: Cell[][] = [];
  for (let i = 0; i < r0; i++) grid.push(new Array<Cell>(width).fill(""));
  for (const v of vals) grid.push(new Array<Cell>(c0).fill("").concat(v));
  return grid;
}
function isAcct(s: string): boolean { return /^\d{4,6}(-\d{2,4})?$/.test(s); }
function txt(v: Cell | undefined): string { return String(v ?? "").trim(); }
function r2(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
function addr(r: number, c: number): string { let s = "", n = c + 1; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s + (r + 1); }
/** Item "Period" cell -> "YYYY-MM-DD". Accepts a real date or text like 02/25 or 02/2025. Blank when unreadable. */
function itemDate(v: Cell | undefined): string {
  if (typeof v === "number" && v > 30000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().substring(0, 10);
  const m = txt(v).match(/^(\d{1,2})[\/.-](\d{2}|\d{4})$/);
  if (!m) return "";
  const mm = parseInt(m[1], 10), yy = parseInt(m[2], 10); if (mm < 1 || mm > 12) return "";
  return `${yy < 100 ? 2000 + yy : yy}-${mm < 10 ? "0" : ""}${mm}-01`;
}
/** Excel date serial -> "MM-YYYY". */
function serialToPeriod(v: Cell | undefined): string {
  if (typeof v !== "number" || v < 30000) return "";
  const d = new Date(Math.round((v - 25569) * 86400000));
  const m = d.getUTCMonth() + 1; return `${m < 10 ? "0" : ""}${m}-${d.getUTCFullYear()}`;
}
