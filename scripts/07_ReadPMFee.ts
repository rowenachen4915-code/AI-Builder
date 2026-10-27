/**
 * 07 - Read PM Fee Calculation            (Internal Review Agent - reader script)
 * Run against: the monthly Property Management Fee workbook (.xlsm). READ-ONLY - writes nothing.
 * Returns:     the contract terms, the fee base and every adjustment, the recomputed fee, and the
 *              trailing monthly base from the Annual tab.
 * Why formulas matter: a base line is supposed to be a SUMIFS drawing from the Yardi Report tab, and
 *              an adjustment line is supposed to be typed in by hand. The script records which is
 *              which, because a typed-over base line and a hand-keyed adjustment are the two things
 *              a reviewer has to check.
 */
interface FeeLine { row: number; label: string; amount: number; glAccount: string; hardcoded: boolean; }
interface MonthBase { month: string; base: number; }
interface PMFeeResult {
  ok: boolean; propertyCode: string; propertyName: string; period: string;
  feeRate: number; minimumFee: number; maximumFee: number; applicationFeeCharged: number; state: string;
  baseTotal: number; baseTotalCheck: number; baseLineSum: number; hardcodedBaseLines: number;
  reductionsTotal: number; adjustmentsTotal: number; adjustedBase: number;
  feePercent: number; feeEarned: number; feeDue: number; postedAdjustment: number;
  retailFee: number; reportFeeRate: number; reportFeePosted: number;
  trailing: MonthBase[]; issues: string[]; baseLines: FeeLine[]; reductions: FeeLine[]; adjustments: FeeLine[];
}
type Cell = string | number | boolean;

function main(workbook: ExcelScript.Workbook): PMFeeResult {
  const out: PMFeeResult = { ok: false, propertyCode: "", propertyName: "", period: "", feeRate: 0, minimumFee: 0, maximumFee: 0,
    applicationFeeCharged: 0, state: "", baseTotal: 0, baseTotalCheck: 0, baseLineSum: 0, hardcodedBaseLines: 0,
    reductionsTotal: 0, adjustmentsTotal: 0, adjustedBase: 0, feePercent: 0, feeEarned: 0, feeDue: 0, postedAdjustment: 0,
    retailFee: 0, reportFeeRate: 0, reportFeePosted: 0, trailing: [], issues: [], baseLines: [], reductions: [], adjustments: [] };

  const calc = workbook.getWorksheet("Calculation");
  if (!calc) { out.issues.push("Calculation tab not found - is this the PM Fee workbook?"); return out; }
  const used = calc.getUsedRange(); if (!used) { out.issues.push("Calculation tab is empty."); return out; }
  const vals = used.getValues(), forms = used.getFormulas(), r0 = used.getRowIndex(), c0 = used.getColumnIndex();
  const v = (r: number, c: number): Cell => { const row = vals[r - 1 - r0]; return row === undefined ? "" : (row[c - 1 - c0] ?? ""); };
  const f = (r: number, c: number): string => { const row = forms[r - 1 - r0]; return row === undefined ? "" : String(row[c - 1 - c0] ?? ""); };
  const typed = (r: number, c: number): boolean => { const s = f(r, c).trim(); return s !== "" && s.charAt(0) !== "="; };

  // ---- contract terms (labels in column B, values in column C; the template keeps these fixed)
  out.propertyName = txt(v(7, 3)); out.propertyCode = txt(v(8, 3)).toLowerCase(); out.period = monthYear(v(9, 3));
  out.feeRate = toNum(v(10, 3)); out.minimumFee = toNum(v(11, 3)); out.maximumFee = toNum(v(11, 14));
  out.applicationFeeCharged = toNum(v(13, 3)); out.state = txt(v(14, 3));
  if (out.propertyCode === "") out.issues.push("Yardi Code is blank on the Calculation tab.");
  if (out.period === "") out.issues.push("Current Period is blank or not a date on the Calculation tab.");
  if (out.feeRate <= 0 || out.feeRate >= 1) out.issues.push(`PM Fee % reads ${out.feeRate}; it should be a rate such as 0.025.`);

  // ---- find the anchor rows by their labels in column H, so inserted rows do not break anything
  let rTotalBase = -1, rAdjHead = -1, rAdjBase = -1, rPercent = -1, rEarned = -1, rDue = -1, rPosted = -1, rRetail = -1;
  for (let r = r0 + 1; r < r0 + vals.length + 1; r++) {
    const h = txt(v(r, 8)).toLowerCase().replace(/:$/, "");
    if (h === "total base") rTotalBase = r;
    else if (h === "adjustments") rAdjHead = r;
    else if (h === "adjusted base") rAdjBase = r;
    else if (h === "% fee") rPercent = r;
    else if (h === "fee earned") rEarned = r;
    else if (h === "property management fee due") rDue = r;
    else if (h === "adjustment" && rDue > 0 && rPosted < 0) rPosted = r;
    else if (h === "retail fee") rRetail = r;
  }
  if (rTotalBase < 0 || rAdjBase < 0 || rDue < 0) { out.issues.push("The Calculation tab does not have the expected Total Base / Adjusted Base / Fee Due rows."); return out; }

  // ---- base lines: charge name in D, amount in I, normally a SUMIFS off the Yardi Report tab
  for (let r = 7; r < rTotalBase - 1; r++) {
    const label = txt(v(r, 4)); if (label === "") continue;
    const amt = toNum(v(r, 9)); if (isNaN(amt)) { out.issues.push(`Row ${r}: "${label}" has a non-numeric amount.`); continue; }
    const hard = typed(r, 9); if (hard) out.hardcodedBaseLines++;
    out.baseLines.push({ row: r, label, amount: r2(amt), glAccount: txt(v(r, 10)), hardcoded: hard });
  }
  out.baseLineSum = r2(out.baseLines.reduce((s, l) => s + l.amount, 0));
  out.baseTotal = r2(toNum(v(rTotalBase, 9)));
  out.baseTotalCheck = r2(toNum(v(rTotalBase, 12)));                       // the template's own validation in column L

  // ---- everything between Total Base and Adjusted Base: Greystar reductions (formulas) then adjustments (typed)
  for (let r = rTotalBase + 1; r < rAdjBase; r++) {
    const label = txt(v(r, 8)); if (label === "" || label.toLowerCase().indexOf("adjustments") === 0) continue;
    const amt = toNum(v(r, 9)); if (isNaN(amt)) continue;
    // A Greystar reduction is a formula the template works out; an adjustment is typed in by hand,
    // which is what tells you the income came in as a journal entry rather than a resident charge.
    const line: FeeLine = { row: r, label, amount: r2(amt), glAccount: txt(v(r, 10)), hardcoded: typed(r, 9) };
    if (line.hardcoded) out.adjustments.push(line); else out.reductions.push(line);
  }
  out.reductionsTotal = r2(out.reductions.reduce((s, l) => s + l.amount, 0));
  out.adjustmentsTotal = r2(out.adjustments.reduce((s, l) => s + l.amount, 0));
  out.adjustedBase = r2(toNum(v(rAdjBase, 9)));
  if (rPercent > 0) out.feePercent = r2(toNum(v(rPercent, 9)));
  if (rEarned > 0) out.feeEarned = r2(toNum(v(rEarned, 9)));
  out.feeDue = r2(toNum(v(rDue, 9)));
  if (rPosted > 0) out.postedAdjustment = r2(toNum(v(rPosted, 9)));
  if (rRetail > 0) out.retailFee = r2(toNum(v(rRetail, 9)));

  // ---- Yardi Report tab: the system's own fee figures, which are not always the ones used
  const yr = workbook.getWorksheet("Yardi Report");
  if (yr) {
    const yu = yr.getUsedRange();
    if (yu) {
      const yv = yu.getValues(), yr0 = yu.getRowIndex(), yc0 = yu.getColumnIndex();
      for (let i = 0; i < yv.length; i++) for (let c = 0; c < yv[i].length - 1; c++) {
        const lab = txt(yv[i][c]).toLowerCase();
        if (lab.indexOf("management fee percentage") >= 0) out.reportFeeRate = toNum(yv[i][c + 1]);
        if (lab.indexOf("management fee posted") >= 0) out.reportFeePosted = r2(toNum(yv[i][c + 1]));
        if (i + yr0 === 1 && c + yc0 === 0) { /* title row, nothing to do */ }
      }
    }
  }

  // ---- Annual tab: the same calculation, one column per month. Read its labelled rows.
  const ann = workbook.getWorksheet("Annual");
  if (!ann) out.issues.push("Annual tab not found - the revenue trend test cannot run.");
  else {
    const au = ann.getUsedRange();
    if (!au) out.issues.push("Annual tab is empty.");
    else {
      const av = au.getValues(), ac0 = au.getColumnIndex();
      let hdr = -1, labelCol = -1;
      for (let i = 0; i < av.length && hdr < 0; i++) for (let c = 0; c < av[i].length; c++) if (txt(av[i][c]).toLowerCase().indexOf("ytd total") >= 0) { hdr = i; labelCol = 2 - ac0; break; }
      if (hdr < 0) out.issues.push("Annual tab header row not found.");
      else {
        const months: string[] = [], cols: number[] = [];
        for (let c = 0; c < av[hdr].length; c++) { const m = monthYear(av[hdr][c]); if (m !== "") { months.push(m); cols.push(c); } }
        let baseRow = -1;
        for (let i = hdr + 1; i < av.length; i++) if (txt(av[i][labelCol]).toLowerCase().replace(/:$/, "") === "total base") { baseRow = i; break; }
        if (baseRow < 0) out.issues.push("Annual tab has no Total Base row.");
        else months.forEach((m, k) => { const x = av[baseRow][cols[k]]; if (typeof x === "number") out.trailing.push({ month: m, base: r2(x) }); });
      }
    }
  }

  out.ok = out.propertyCode !== "" && out.period !== "" && out.feeDue !== 0;
  console.log(`PM FEE READ: ${out.propertyCode} ${out.period} | base ${out.baseTotal.toFixed(2)} | ${out.adjustments.length} adjustments | fee due ${out.feeDue.toFixed(2)} | ${out.trailing.length} months | problems: ${out.issues.length}`);
  return out;
}

function txt(v: Cell | undefined): string { return String(v ?? "").trim(); }
function toNum(v: Cell | undefined): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim(); if (s === "") return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(s.replace(/[(),$%\s-]/g, ""));
  return isNaN(n) ? NaN : (neg ? -n : n);
}
function r2(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
/** An Excel date serial or a date-like string -> "MM-YYYY". */
function monthYear(v: Cell | undefined): string {
  if (typeof v === "number" && v > 30000) { const d = new Date(Math.round((v - 25569) * 86400000)); const m = d.getUTCMonth() + 1; return `${m < 10 ? "0" : ""}${m}-${d.getUTCFullYear()}`; }
  const s = txt(v); const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[2]}-${iso[1]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (us) return `${us[1].length < 2 ? "0" : ""}${us[1]}-${us[3]}`;
  return "";
}
