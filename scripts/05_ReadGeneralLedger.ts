/**
 * 05 - Read General Ledger              (Internal Review Agent - reader script)
 * Run against: the Yardi General Ledger detail export (.xlsx). READ-ONLY - writes nothing.
 * Returns:     a SUMMARY per account (never the 9,000+ detail rows - that would not fit in a flow),
 *              the accrual clear-down test for every account asked for, and a short list of
 *              entries worth a human look.
 * Inputs:      accrualAccountsCsv - the accounts to run the clear-down test on, e.g. "22005-000,22010-000,22080-000".
 *                                   Leave blank to use every 22xxx account in the file.
 *              largeEntry         - dollar size at which a manual journal entry is listed (default 25000).
 *              staleDays          - how far before the period an entry's transaction date may fall before it is
 *                                   listed (default 90). Yardi routinely posts late-June bank activity into July,
 *                                   so a date a few weeks back is normal and is NOT flagged.
 */
interface GLAccount { account: string; name: string; beginning: number; debits: number; credits: number; ending: number; entries: number; manualEntries: number; }
interface GLAccrual { account: string; name: string; clearedToZero: boolean; lowestAbsBalance: number; reversalDebits: number; newAccruals: number; firstNewBeforeClear: string; }
interface GLEntry { account: string; date: string; description: string; control: string; amount: number; reason: string; }
interface GLResult {
  ok: boolean; propertyCode: string; propertyName: string; period: string; book: string;
  accountCount: number; entryCount: number; wrongPostPeriod: number; issues: string[];
  accounts: GLAccount[]; accruals: GLAccrual[]; flagged: GLEntry[]; manual: GLEntry[];
}

function main(workbook: ExcelScript.Workbook, accrualAccountsCsv?: string, largeEntry?: number, staleDays?: number): GLResult {
  const out: GLResult = { ok: false, propertyCode: "", propertyName: "", period: "", book: "", accountCount: 0, entryCount: 0, wrongPostPeriod: 0, issues: [], accounts: [], accruals: [], flagged: [], manual: [] };
  const big = largeEntry === undefined || largeEntry === null || largeEntry <= 0 ? 25000 : largeEntry;
  const stale = staleDays === undefined || staleDays === null || staleDays <= 0 ? 90 : staleDays;
  const want = (accrualAccountsCsv ?? "").split(",").map(s => s.trim()).filter(s => s !== "");

  const ws = workbook.getWorksheets()[0]; if (!ws) { out.issues.push("Workbook has no sheets."); return out; }
  const used = ws.getUsedRange(); if (!used) { out.issues.push("General Ledger is empty."); return out; }
  const grid = used.getValues(), c0 = used.getColumnIndex();
  const cell = (r: (string | number | boolean)[], c: number) => r[c - c0];

  // ---- header block
  for (let i = 0; i < Math.min(grid.length, 8); i++) {
    const t = txt(cell(grid[i], 0));
    const code = t.match(/^(.*)\(([^)]+)\)\s*$/);
    if (code && out.propertyCode === "") { out.propertyName = code[1].trim(); out.propertyCode = code[2].trim().toLowerCase(); }
    else if (/^period\s*=/i.test(t)) out.period = lastMonthYear(t);
    else if (/^book\s*=/i.test(t)) out.book = t.replace(/^book\s*=\s*/i, "").split(";")[0].trim();
  }
  if (out.propertyCode === "") out.issues.push("Property code not found in the GL header.");
  if (out.period === "") out.issues.push("Period not found in the GL header.");
  const periodStart = out.period === "" ? "" : `${out.period.substring(3)}-${out.period.substring(0, 2)}-01`;
  const periodEnd = out.period === "" ? "" : endOfPeriod(out.period);

  // ---- walk the sections: "Beginning Balance" row ... entries ... "Ending Balance" row
  let acct = "", name = "", beginning = 0, entries = 0, manual = 0;
  let cleared = false, low = 0, revD = 0, newA = 0, firstNew = "", started = false;
  const track = (a: string) => want.length === 0 ? a.substring(0, 2) === "22" : want.indexOf(a) >= 0;

  for (let i = 0; i < grid.length; i++) {
    const row = grid[i], a = txt(cell(row, 0)), remark = txt(cell(row, 10));

    if (isAcct(a) && remark.indexOf("Beginning Balance") >= 0) {
      acct = a; name = txt(cell(row, 4)); beginning = toNum(cell(row, 9)); entries = 0; manual = 0;
      cleared = false; low = Math.abs(beginning); revD = 0; newA = 0; firstNew = ""; started = true;
      continue;
    }
    if (started && remark.indexOf("Ending Balance") >= 0) {
      const d = toNum(cell(row, 7)), c = toNum(cell(row, 8)), e = toNum(cell(row, 9));
      if (isNaN(d) || isNaN(c) || isNaN(e)) out.issues.push(`${acct}: ending balance row could not be read.`);
      else out.accounts.push({ account: acct, name, beginning, debits: d, credits: c, ending: e, entries, manualEntries: manual });
      if (track(acct)) out.accruals.push({ account: acct, name, clearedToZero: cleared || r2(beginning) === 0, lowestAbsBalance: r2(low), reversalDebits: r2(revD), newAccruals: r2(newA), firstNewBeforeClear: firstNew });
      started = false; acct = "";
      continue;
    }
    if (!started || acct === "") continue;

    const date = toDate(cell(row, 2));
    if (date === "") continue;                                            // batch subtotal or spacer row, not an entry
    const postPeriod = toDate(cell(row, 3));
    const desc = txt(cell(row, 4)), control = txt(cell(row, 5));
    const dr = toNum(cell(row, 7)), cr = toNum(cell(row, 8)), bal = toNum(cell(row, 9));
    if (isNaN(dr) || isNaN(cr)) { out.issues.push(`${acct} ${date}: an amount is not numeric.`); continue; }
    entries++; out.entryCount++;
    const isManual = control.substring(0, 2) === "J-";        // C- resident charges, R- receipts, P- payables and K- invoices come from subledgers
    if (isManual) {
      manual++;
      if (out.manual.length < 1500) out.manual.push({ account: acct, date, description: desc.substring(0, 70), control, amount: r2(dr !== 0 ? dr : -cr), reason: "" });
    }

    // accrual clear-down: does the prior balance reverse to zero before new accruals go on?
    if (track(acct)) {
      const isReversal = /reversal of|reverses/i.test(desc);
      if (Math.abs(bal) < low) low = Math.abs(bal);
      if (r2(bal) === 0) cleared = true;
      if (isReversal) revD += dr + cr;
      else if (!isReversal && (dr !== 0 || cr !== 0)) { newA += dr + cr; if (!cleared && firstNew === "" && r2(beginning) !== 0) firstNew = `${date} ${desc.substring(0, 60)}`; }
    }

    // entries worth a look
    const amt = r2(dr !== 0 ? dr : -cr), abs = Math.abs(amt);
    let reason = "";
    const postedElsewhere = periodStart !== "" && postPeriod !== "" && postPeriod.substring(0, 7) !== periodStart.substring(0, 7);
    if (postedElsewhere) { out.wrongPostPeriod++; reason = `Posted to ${postPeriod.substring(0, 7)}, not the review period`; }
    else if (isManual && periodStart !== "" && date > periodEnd) reason = "Manual entry dated after the period end";
    else if (isManual && periodStart !== "" && date < addDays(periodStart, -stale)) reason = `Manual entry dated more than ${stale} days before the period`;
    else if (isManual && /reversal of|reversed by/i.test(desc)) reason = "";            // the accrual clear-down test already covers reversals
    else if (isManual && abs >= big) reason = `Manual journal entry of ${abs.toFixed(2)}`;
    else if (isManual && abs >= 1000 && abs === Math.round(abs / 1000) * 1000) reason = "Manual round-thousand entry";
    if (reason !== "" && out.flagged.length < 120) out.flagged.push({ account: acct, date, description: desc.substring(0, 90), control, amount: amt, reason });
  }

  out.accountCount = out.accounts.length;
  if (out.accountCount === 0) out.issues.push("No account sections were found - is this the Yardi General Ledger detail export?");
  out.ok = out.accountCount > 0 && out.propertyCode !== "" && out.period !== "";
  console.log(`GENERAL LEDGER READ: ${out.propertyCode} ${out.period} | ${out.accountCount} accounts | ${out.entryCount} entries | ${out.manual.length} manual entries | ${out.flagged.length} flagged | problems: ${out.issues.length}`);
  return out;
}

function txt(v: string | number | boolean | undefined): string { return String(v ?? "").trim(); }
function isAcct(s: string): boolean { return /^\d{4,6}(-\d{2,4})?$/.test(s); }
function toNum(v: string | number | boolean | undefined): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim(); if (s === "") return 0;
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s);
  const n = parseFloat(s.replace(/[(),$\s-]/g, ""));
  return isNaN(n) ? NaN : (neg ? -n : n);
}
/** Yardi writes dates as real dates; accept text too. Returns "YYYY-MM-DD", or "" when the cell is not a date. */
function toDate(v: string | number | boolean | undefined): string {
  if (typeof v === "number" && v > 30000) return new Date(Math.round((v - 25569) * 86400000)).toISOString().substring(0, 10);
  const s = String(v ?? "").trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (!us) return "";
  return `${us[3]}-${pad(us[1])}-${pad(us[2])}`;
}
function addDays(d: string, n: number): string { return new Date(Date.parse(d) + n * 86400000).toISOString().substring(0, 10); }
function pad(s: string): string { return s.length < 2 ? "0" + s : s; }
function r2(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
function endOfPeriod(p: string): string { const m = parseInt(p.substring(0, 2), 10), y = parseInt(p.substring(3), 10); return new Date(Date.UTC(y, m, 0)).toISOString().substring(0, 10); }
function lastMonthYear(t: string): string {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const all = t.match(/[A-Za-z]{3}[a-z]*\s+\d{4}/g); if (!all) return "";
  const p = all[all.length - 1].split(/\s+/), m = months.indexOf(p[0].substring(0, 3).toLowerCase());
  return m < 0 ? "" : `${m < 9 ? "0" : ""}${m + 1}-${p[1]}`;
}
