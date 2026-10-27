/**
 * 06 - Read AME Report                    (Internal Review Agent - reader script)
 * Run against: ONE of the five Yardi AME reports (.xlsx). READ-ONLY - writes nothing.
 *     Aged Receivables | Payables Aging Report | Gross Potential Rent |
 *     Security Deposit Activity | Rent Roll with Lease Charges
 * The script works out which report it is from the title in the first rows, so the same script
 * is used five times, exactly like 03_ReadYardiFinancial.
 * Returns:  the report type, the property and period, and the report's OWN total lines.
 *           It never adds up the detail rows itself: a Yardi rent roll prints several charge rows
 *           per unit, so adding the column gives 1,117,548 where the report's own total says
 *           1,061,771. Totals come from the report's total rows only.
 */
interface AMEValue { key: string; label: string; amount: number; sourceCell: string; }
interface AMEResult {
  ok: boolean; reportType: string; propertyCode: string; propertyName: string; period: string;
  asOf: string; valueCount: number; issues: string[]; values: AMEValue[];
}
type Cell = string | number | boolean;

function main(workbook: ExcelScript.Workbook): AMEResult {
  const out: AMEResult = { ok: false, reportType: "", propertyCode: "", propertyName: "", period: "", asOf: "", valueCount: 0, issues: [], values: [] };
  const ws = workbook.getWorksheets()[0]; if (!ws) { out.issues.push("Workbook has no sheets."); return out; }
  const used = ws.getUsedRange(); if (!used) { out.issues.push("Report is empty."); return out; }
  const grid = used.getValues(), r0 = used.getRowIndex(), c0 = used.getColumnIndex();
  const at = (r: number, c: number): Cell => { const row = grid[r - r0]; return row === undefined ? "" : (row[c - c0] ?? ""); };
  const put = (key: string, label: string, amount: number, r: number, c: number) => {
    if (isNaN(amount)) { out.issues.push(`${label}: the total is not numeric.`); return; }
    out.values.push({ key, label, amount: r2(amount), sourceCell: addr(r, c) });
  };

  // ---- header: the title, then "610 West (mn610wes)" or a bare property code, then the period
  const head: string[] = [];
  for (let r = r0; r < Math.min(r0 + 6, r0 + grid.length); r++) head.push(txt(at(r, c0)));
  const title = head[0].toLowerCase();
  if (title.indexOf("aged receivable") >= 0) out.reportType = "AR";
  else if (title.indexOf("payables aging") >= 0) out.reportType = "AP";
  else if (title.indexOf("gross potential rent") >= 0) out.reportType = "GPR";
  else if (title.indexOf("security deposit activity") >= 0) out.reportType = "SD";
  else if (title.indexOf("rent roll") >= 0) out.reportType = "RR";
  else { out.issues.push(`"${head[0]}" is not one of the five AME reports this script reads.`); return out; }

  for (const h of head) {
    const code = h.match(/^(.*)\(([^)]+)\)\s*$/);
    if (code && out.propertyCode === "") { out.propertyName = code[1].trim(); out.propertyCode = code[2].trim().toLowerCase(); }
    else if (out.propertyCode === "" && /^[a-z]{2}[a-z0-9]{4,10}$/i.test(h)) out.propertyCode = h.toLowerCase();
    const my = h.match(/(?:month year|period)\s*[=:]\s*(\d{2})\/(\d{4})/i);
    if (my && out.period === "") out.period = `${my[1]}-${my[2]}`;
    const asOf = h.match(/as of\s*[=:]?\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (asOf && out.asOf === "") out.asOf = `${asOf[3]}-${pad(asOf[1])}-${pad(asOf[2])}`;
  }
  if (out.propertyCode === "") out.issues.push("Property code not found in the report header.");
  if (out.period === "") out.issues.push("Period not found in the report header.");

  const lastRow = r0 + grid.length - 1, width = c0 + (grid.length > 0 ? grid[0].length : 0) - 1;

  // ---- AR: the last row is the totals row. Unpaid charges = TB receivable; Prepays = TB prepaid rent.
  if (out.reportType === "AR") {
    let tr = -1;                                                                              // the totals row has no unit and no resident name
    for (let r = lastRow; r > r0; r--) { if (txt(at(r, c0 + 1)) === "" && txt(at(r, c0 + 3)) === "" && isNum(at(r, c0 + 4))) { tr = r; break; } }
    if (tr < 0) out.issues.push("Aged Receivables totals row not found.");
    else { put("arTotal", "Total unpaid charges", toNum(at(tr, c0 + 4)), tr, c0 + 4); put("arPrepays", "Prepays", toNum(at(tr, c0 + 9)), tr, c0 + 9);
           put("arOver90", "Over 90 days", toNum(at(tr, c0 + 8)), tr, c0 + 8); put("arBalance", "Net balance", toNum(at(tr, c0 + 10)), tr, c0 + 10); }
  }

  // ---- AP: the "Grand Total" row
  if (out.reportType === "AP") {
    let tr = -1;
    for (let r = lastRow; r > r0; r--) { if (/^grand total/i.test(txt(at(r, c0)))) { tr = r; break; } }
    if (tr < 0) out.issues.push("Payables Aging grand total row not found.");
    else { put("apTotal", "Grand total payables", toNum(at(tr, c0 + 9)), tr, c0 + 9); put("apOver90", "Over 90 days owed", toNum(at(tr, c0 + 13)), tr, c0 + 13); }
  }

  // ---- GPR: TWO market rent totals. The revenue-unit total excludes model and other non-revenue
  //      units; the grand total ("Totals") includes them and is the one the GL carries.
  if (out.reportType === "GPR") {
    let rev = -1, grand = -1, model = -1;
    for (let r = r0; r <= lastRow; r++) {
      const a = txt(at(r, c0)), b = txt(at(r, c0 + 1));
      if (a === out.propertyCode && b === "" && isNum(at(r, c0 + 5))) rev = r;          // revenue units subtotal
      if (a === out.propertyCode && /^totals?$/i.test(b)) grand = r;                                 // grand total incl. non-revenue
      if (/^total$/i.test(a) && /model/i.test(b)) model = r;
    }
    if (rev < 0 || grand < 0) out.issues.push("Gross Potential Rent totals rows not found.");
    else {
      put("gprMarketRent", "Market rent (grand total, includes non-revenue units)", toNum(at(grand, c0 + 5)), grand, c0 + 5);
      put("gprMarketRentRevenueUnits", "Market rent (revenue units only)", toNum(at(rev, c0 + 5)), rev, c0 + 5);
      put("gprLossGainToLease", "Loss / gain to lease", toNum(at(rev, c0 + 6)), rev, c0 + 6);
      put("gprVacancy", "Vacancy", toNum(at(rev, c0 + 8)), rev, c0 + 8);
      put("gprConcessions", "Concessions", toNum(at(rev, c0 + 10)), rev, c0 + 10);
      put("gprWriteOff", "Write off", toNum(at(rev, c0 + 11)), rev, c0 + 11);
      put("gprRentalIncome", "Rental income", toNum(at(rev, c0 + 12)), rev, c0 + 12);
      if (model >= 0) put("gprModel", "Model / non-revenue units", toNum(at(model, c0 + 5)), model, c0 + 5);
      else put("gprModel", "Model / non-revenue units", r2(toNum(at(grand, c0 + 5)) - toNum(at(rev, c0 + 5))), grand, c0 + 5);
    }
  }

  // ---- SD: the totals row. Deposits on hand is NOT the rent roll deposit figure - the two differ by
  //      refunds pending, by design, so they are never tied to each other.
  if (out.reportType === "SD") {
    let tr = -1;
    for (let r = lastRow; r > r0; r--) { if (txt(at(r, c0)) === out.propertyCode && txt(at(r, c0 + 1)) === "" && isNum(at(r, c0 + 8))) { tr = r; break; } }
    if (tr < 0) out.issues.push("Security Deposit Activity totals row not found.");
    else { put("sdOnHand", "Deposits on hand", toNum(at(tr, c0 + 8)), tr, c0 + 8);
           put("sdDelinquent", "(Prepaid) / delinquent deposits", toNum(at(tr, c0 + 9)), tr, c0 + 9);
           put("sdForfeited", "Deposits forfeited", toNum(at(tr, c0 + 10)), tr, c0 + 10);
           put("sdCurrentBilled", "Current deposits billed", toNum(at(tr, c0 + 6)), tr, c0 + 6);
           put("sdCurrentReceipts", "Current deposit receipts", toNum(at(tr, c0 + 7)), tr, c0 + 7); }
  }

  // ---- RR: the "Totals:" row of the Summary Groups block at the foot
  if (out.reportType === "RR") {
    let tr = -1, labelCol = c0;
    for (let r = lastRow; r > r0; r--) {
      for (let c = c0; c <= width; c++) { if (/^totals?:?$/i.test(txt(at(r, c)))) { tr = r; labelCol = c; break; } }
      if (tr >= 0 && rowHasNumbers(at, tr, c0, width)) break; else tr = -1;
    }
    if (tr < 0) out.issues.push("Rent Roll summary totals row not found.");
    else {
      const nums: number[] = [], cols: number[] = [];
      for (let c = labelCol + 1; c <= width; c++) { const v = at(tr, c); if (v !== "" && v !== undefined) { nums.push(toNum(v)); cols.push(c); } }
      // Summary block prints: square footage, market rent, lease charges, security deposit, other deposits, units...
      if (nums.length >= 2) put("rrMarketRent", "Market rent", nums[1], tr, cols[1]);
      if (nums.length >= 3) put("rrLeaseCharges", "Lease charges", nums[2], tr, cols[2]);
      if (nums.length >= 4) put("rrSecurityDeposits", "Security deposits (not comparable to deposits on hand)", nums[3], tr, cols[3]);
      if (nums.length < 2) out.issues.push("Rent Roll summary totals row has too few figures to read.");
    }
  }

  out.valueCount = out.values.length;
  out.ok = out.valueCount > 0 && out.propertyCode !== "" && out.period !== "";
  console.log(`${out.reportType} READ: ${out.propertyCode} ${out.period} | ${out.valueCount} totals | problems: ${out.issues.length}`);
  return out;
}

function rowHasNumbers(at: (r: number, c: number) => Cell, r: number, from: number, to: number): boolean {
  let n = 0; for (let c = from; c <= to; c++) { const v = at(r, c); if (typeof v === "number" || (typeof v === "string" && /^[\d(,.-]/.test(v.trim()) && v.trim() !== "")) n++; }
  return n >= 2;
}
function isNum(v: Cell | undefined): boolean { return txt(v) !== "" && !isNaN(toNum(v)); }
function txt(v: Cell | undefined): string { return String(v ?? "").trim(); }
function toNum(v: Cell | undefined): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim(); if (s === "") return NaN;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(s.replace(/[(),$\s-]/g, ""));
  return isNaN(n) ? NaN : (neg ? -n : n);
}
function pad(s: string): string { return s.length < 2 ? "0" + s : s; }
function r2(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
function addr(r: number, c: number): string { let s = "", n = c + 1; while (n > 0) { s = String.fromCharCode(65 + (n - 1) % 26) + s; n = Math.floor((n - 1) / 26); } return s + (r + 1); }
