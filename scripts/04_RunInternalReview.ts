/**
 * 04 - Run Internal Review                    (Internal Review Agent - the rule engine)
 * Run against: the NEW report workbook (a fresh copy of Internal_Review_Report_Template).
 * Inputs:      what the reader scripts and the two PDF prompts returned, passed in as JSON text.
 *              Leave an input blank ("") when that source was not provided - the script handles it.
 * Does:        every review module, start to finish. It never stops at the first exception.
 * Writes:      Executive Summary, Source Validation, Exceptions, Warnings, Reviewed_Monitor, Passed Controls,
 *              Review History, and a full "All Results" sheet (one row per test, with a stable FindingKey).
 * Returns:     run status (Review Complete / Not Started, never a readiness verdict), counts and the exception/warning list.
 */
interface TBRow { account: string; name: string; forward: number; debit: number; credit: number; ending: number; }
interface TBResult { ok: boolean; propertyCode: string; propertyName: string; period: string; book: string; rowCount: number; sumEnding: number; arithmeticAgreement: number; issues: string[]; rows: TBRow[]; }
interface BSSSRow { account: string; name: string; balance: number; sourceTab: string; sourceCell: string; }
interface BSSSItem { account: string; date: string; description: string; amount: number; sourceCell: string; }
interface BSSSResult { ok: boolean; propertyCode: string; period: string; preparedBy: string; rowCount: number; issues: string[]; rows: BSSSRow[]; items: BSSSItem[]; }
interface FinRow { account: string; name: string; section: string; kind: string; values: number[]; }
interface FinResult { ok: boolean; reportTitle: string; propertyCode: string; period: string; book: string; columns: string[]; rowCount: number; issues: string[]; rows: FinRow[]; }
interface GLAccount { account: string; name: string; beginning: number; debits: number; credits: number; ending: number; entries: number; manualEntries: number; }
interface GLAccrual { account: string; name: string; clearedToZero: boolean; lowestAbsBalance: number; reversalDebits: number; newAccruals: number; firstNewBeforeClear: string; }
interface GLEntry { account: string; date: string; description: string; control: string; amount: number; reason: string; }
interface GLResult { ok: boolean; propertyCode: string; period: string; book: string; accountCount: number; entryCount: number; wrongPostPeriod: number; issues: string[]; accounts: GLAccount[]; accruals: GLAccrual[]; flagged: GLEntry[]; manual: GLEntry[]; }
interface RecItem { date: string; reference: string; description: string; amount: number; }
interface BankRec { accountName: string; bankAccountLast4: string; glAccount: string; reconciliationDate: string; bankStatementBalance: number;
  outstandingDepositsTotal: number; outstandingChecksTotal: number; reconcilingItemsTotal: number; otherItemsTotal: number;
  reconciledBankBalance: number; glBalance: number; difference: number;
  outstandingDeposits: RecItem[]; outstandingChecks: RecItem[]; reconcilingItems: RecItem[]; otherItems: RecItem[]; }
interface BankRecFile { bankRecs: BankRec[]; }
interface Mortgage { servicer: string; loanNumberLast4: string; statementDate: string; paymentDueDate: string; principalBalance: number; interestDue: number;
  taxEscrowBalance: number; insuranceEscrowBalance: number; replacementReserveBalance: number; otherReserveBalance: number; }
interface MortgageFile { mortgages: Mortgage[]; }
interface SourceFile { type: string; file: string; status: string; }
interface AMEValue { key: string; label: string; amount: number; sourceCell: string; }
interface AMEResult { ok: boolean; reportType: string; propertyCode: string; propertyName: string; period: string; asOf: string; valueCount: number; issues: string[]; values: AMEValue[]; }
interface AMETie { key: string; label: string; accounts: string; basis: string; sign: number; status: string; }
interface FeeLine { row: number; label: string; amount: number; glAccount: string; hardcoded: boolean; }
interface MonthBase { month: string; base: number; }
interface PMFeeResult { ok: boolean; propertyCode: string; propertyName: string; period: string; feeRate: number; minimumFee: number; maximumFee: number;
  applicationFeeCharged: number; state: string; baseTotal: number; baseTotalCheck: number; baseLineSum: number; hardcodedBaseLines: number;
  reductionsTotal: number; adjustmentsTotal: number; adjustedBase: number; feePercent: number; feeEarned: number; feeDue: number; postedAdjustment: number;
  retailFee: number; reportFeeRate: number; reportFeePosted: number; trailing: MonthBase[]; issues: string[]; baseLines: FeeLine[]; reductions: FeeLine[]; adjustments: FeeLine[]; }
interface CoverageRule { from: number; to: number; coverage: string; note: string; }
interface AgedRule { accountPrefix: string; ruleId: string; category: string; days: number; }
interface MajorRule { label: string; section: string; }
interface RuleSet {
  name: string; balanceSheetFrom: number; balanceSheetTo: number; coverage: CoverageRule[];
  feeExpenseAccounts: string; feeAccrualAccounts: string; feeSpikePct: number; feeSpikeAmt: number; feeTrailingMonths: number;
  ameTies: AMETie[]; sdCashAccounts: string; sdLiabilityAccounts: string; sdOwedAccounts: string; clearingAccounts: string; debitAccounts: string; creditAccounts: string;
  ytdPct: number; ytdAmt: number; depreciationAccounts: string; depreciationPct: number;
  cashFrom: number; cashTo: number; escrowFrom: number; escrowTo: number; debtFrom: number; debtTo: number; accruedInterestPrefix: string;
  aged: AgedRule[]; utilitySection: string; contractSection: string; major: MajorRule[];
  trendFrom: number; trendTo: number; trendMonths: number; recurringMonths: number;
  glLargeEntry: number; majorPct: number; majorAmt: number; utilPct: number; t12Pct: number; t12Amt: number; minChange: number; cashMonitorDays: number; cashWarningDays: number; cashExceptionDays: number;
}
interface Finding { resultId: string; findingKey: string; ruleId: string; findingType: string; propertyCode: string; reviewPeriod: string; category: string; item: string;
  test: string; status: string; source1: string; source2: string; sourceValue: string; comparisonValue: string; difference: string; finding: string; requiredAction: string; }
interface RecSummary { account: string; glAccount: string; reconciled: number; glBalance: number; difference: number; oldest: number; over30: number; status: string; }
interface ReviewSummary { overallStatus: string; ruleset: string; exceptions: number; warnings: number; monitor: number; passed: number; summary: string; findingsText: string; findings: Finding[]; }

function main(workbook: ExcelScript.Workbook, propertyCode: string, reviewPeriod: string, reviewAttempt: string, submissionType: string, reportFileName: string,
              sourcesJson: string, tbJson: string, bsssJson: string, t12Json: string, bcJson: string, bsJson: string, glJson: string,
              bankRecJson: string, mortgageJson: string, ameJson: string, pmFeeJson: string, rulesetJson?: string): ReviewSummary {
  // propertyCode may carry the client's own Yardi code after a comma ("rpresshi,c6us0871") when the reports come from a
  // client-owned Yardi. The first code is ours and names everything; a file carrying any of the codes is the right property.
  const codes = propertyCode.split(/[,;|]/).map(c => c.trim().toLowerCase()).filter(c => c !== "");
  const code = codes.length > 0 ? codes[0] : "", isOurs = (c: string | undefined) => c !== undefined && codes.indexOf(String(c).trim().toLowerCase()) >= 0;
  // reviewPeriod may carry a second period after a comma ("09-2026,08-2026") when the manager, asked by the agent, accepted
  // files that turned out to be for a different month. The first period names the report and the keys; the accounting
  // (ageing, posting period, trailing months) runs on the period the files actually cover.
  const periods = reviewPeriod.split(/[,;|]/).map(x => x.trim()).filter(x => x !== "");
  const period = periods.length > 0 ? periods[0] : "", acctPeriod = periods.length > 1 ? periods[1] : period;
  const isOurPeriod = (x: string | undefined) => x !== undefined && periods.indexOf(String(x).trim()) >= 0;
  const attempt = reviewAttempt.trim() === "" ? "R1" : reviewAttempt.trim();
  const rules = pick(rulesetJson) !== "" ? JSON.parse(pick(rulesetJson)) as RuleSet : defaultRuleset();
  const all: Finding[] = [];
  const EX = "Exception", WA = "Warning", MO = "Reviewed / Monitor", PA = "Pass";
  const add = (ruleId: string, category: string, item: string, test: string, status: string, s1: string, s2: string,
               v1: number | string, v2: number | string, diff: number | string, finding: string, action: string) => {
    all.push({ resultId: `${code}_${period}_${attempt}_${("000" + (all.length + 1)).slice(-4)}`, findingKey: `${code}|${period}|${ruleId}|${item}`,
      ruleId, findingType: status === PA ? "N/A" : status === MO ? "Reviewed / Monitor" : "New", propertyCode: code, reviewPeriod: period, category, item, test, status,
      source1: s1, source2: s2, sourceValue: fmt(v1), comparisonValue: fmt(v2), difference: fmt(diff), finding, requiredAction: action });
  };
  const periodEnd = endOfPeriod(acctPeriod);

  // ---------------------------------------------------------------- read inputs (a bad or blank input never crashes the run)
  // Each reader's result is recognised by a list it always carries, even when it arrives wrapped in the flow step's output.
  const tb = reader<TBResult>(tbJson, "rows"), bs = reader<BSSSResult>(bsssJson, "rows"), t12 = reader<FinResult>(t12Json, "rows"),
    bc = reader<FinResult>(bcJson, "rows"), bal = reader<FinResult>(bsJson, "rows"), gl = reader<GLResult>(glJson, "accounts");
  const recList = recsFrom(pick(bankRecJson)), debtList = dig(pick(mortgageJson), "mortgages", 0) as Mortgage[] | undefined;
  const recs: BankRecFile | undefined = recList ? { bankRecs: recList } : undefined, debt: MortgageFile | undefined = debtList ? { mortgages: debtList } : undefined;
  const asList = <T>(v: T[] | undefined): T[] => Array.isArray(v) ? v : [];
  const sources = asList(parse<SourceFile[]>(sourcesJson)).filter(x => x && typeof x.type === "string");
  const ameList = asList(parse<AMEResult[]>(ameJson)).filter(a => a && Array.isArray(a.values));
  const fee = reader<PMFeeResult>(pmFeeJson, "issues");
  // Something was passed in but it is not a reader's result (for example "[]" typed into the flow box): say so, don't crash.
  const unusable: [string, string][] = [["Trial Balance", tbJson], ["BS Support Schedule", bsssJson], ["12 Month Statement", t12Json], ["Budget Comparison", bcJson],
    ["Balance Sheet", bsJson], ["General Ledger", glJson], ["PM Fee workbook", pmFeeJson]];
  const got = [tb, bs, t12, bc, bal, gl, fee];
  unusable.forEach((u, i) => { const t = pick(u[1]); if (t !== "" && t !== "null" && got[i] === undefined)
    add("SRC-03", "Source Validation", u[0], "Source file could be read completely", WA, "Run Review input", "", t.length > 40 ? t.substring(0, 40) + "..." : t, "", "",
      `The ${u[0]} input to the review was not the reader's result, so its tests did not run.`, `Check the ${u[0]} box in the Run Review step passes the reader step's result.`); });
  const ame: { [k: string]: AMEResult } = {}; ameList.forEach(a => { if (a && a.ok) ame[a.reportType] = a; });
  const ameVal = (type: string, key: string): AMEValue | undefined => { const r = ame[type]; return r ? r.values.filter(v => v.key === key)[0] : undefined; };
  const tbMap: { [k: string]: TBRow } = {}; if (tb) tb.rows.forEach(r => { tbMap[r.account] = r; });
  const num = (a: string) => parseInt(a.split("-")[0], 10);
  // Account class from the leading digit, which holds on both Greystar's 5-digit chart (12010-000) and 4-digit client
  // charts (1510-2420): 1 assets, 2-3 liabilities and equity, 4-9 income statement.
  const lead = (a: string) => parseInt(a.trim().charAt(0), 10);
  const liabEquity = (a: string) => lead(a) === 2 || lead(a) === 3, incomeStmt = (a: string) => lead(a) >= 4;
  // Yardi's T12 and Budget Comparison print revenue (and the balance sheet lines of a cash-flow tree) with the opposite
  // sign to the TB: everything from 1 to 4. Expenses (5-9) print as on the TB.
  const creditNormal = (a: string) => lead(a) >= 1 && lead(a) <= 4;
  // The T12 and Budget Comparison ties exist to catch a report exported before the last entry posted, which changes the
  // amount. Which sign a line prints with depends on the client's reporting tree (CBRE prints capex and interest income
  // the other way round from Greystar), and the report is system-generated, so the ties compare the amount, not the sign.
  const same = (x: number, y: number) => r2(Math.abs(x)) === r2(Math.abs(y));
  const tbRange = (from: number, to: number) => tb ? tb.rows.filter(r => num(r.account) >= from && num(r.account) <= to && r2(r.ending) !== 0) : [];

  // ---------------------------------------------------------------- SOURCE VALIDATION
  const supported: { [k: string]: boolean } = {}; if (bs) bs.rows.forEach(r => { supported[r.account] = true; });
  const cashNeedingRec = tbRange(rules.cashFrom, rules.cashTo).filter(r => !supported[r.account]);
  const debtAccounts = tbRange(rules.debtFrom, rules.debtTo);
  const match = (ok: boolean | undefined, got: string | undefined) => ok === undefined ? "Not checked" : got === undefined ? "Not read" : ok ? "Yes" : `No (${got})`;
  const src = (type: string, label: string, required: boolean, provided: boolean, propOk: boolean | undefined, prop: string | undefined, perOk: boolean | undefined, per: string | undefined, note: string) => {
    const s = sources.filter(x => x.type.toUpperCase() === type)[0];
    let status = s && s.status ? s.status : provided ? "Found" : required ? "Missing" : "Not Applicable";
    // Bank recs may come one PDF per account. Several PDFs that were all read is not "Multiple Versions"; a duplicate rec is caught by CASH-06.
    if (type === "BANKREC" && status === "Multiple Versions" && provided) status = "Found";
    const row = [s ? s.file : "", provided ? match(propOk, prop) : "", provided ? match(perOk, per) : "", status, note];
    if (status === "Missing" && required) add("SRC-01", "Source Validation", label, "Required source is in the Internal Review folder", EX, "Internal Review folder", "", "Missing", "Found", "", `${label} is required and was not found.`, `Save the ${label} in the Internal Review folder and re-run.`);
    else if (status === "Multiple Versions") add("SRC-01", "Source Validation", label, "One version of each source", EX, "Internal Review folder", "", "Multiple", "1", "", `More than one ${label} was found; the review cannot choose for you.`, "Keep only the final version in the folder (move drafts to an Archive subfolder).");
    else if (provided && (propOk === false || perOk === false)) add("SRC-02", "Source Validation", label, "File is for the requested property and period (read from inside the file)", EX, label, "Review request", `${prop ?? ""} ${per ?? ""}`.trim(), `${code} ${period}`, "", `${label} is for a different property or period.`, `Replace with the ${label} for ${code} ${period}.`);
    else if (provided) add("SRC-02", "Source Validation", label, "File is for the requested property and period", PA, label, "Review request", `${prop ?? ""} ${per ?? ""}`.trim(), `${code} ${period}`, "", propOk === undefined ? "Found. Property and period are not machine-checked for this file type." : prop && prop !== code ? `Correct property and period (the file uses the client's Yardi code ${prop}, accepted for ${code}).` : per && per !== period ? `Correct property; the file is for ${per}, accepted by the manager as the ${period} review.` : "Correct property and period.", "");
    return row;
  };
  const okP = (r: { ok: boolean; propertyCode: string } | undefined) => r ? r.ok && isOurs(r.propertyCode) : undefined;
  const okM = (r: { ok: boolean; period: string } | undefined) => r ? r.ok && isOurPeriod(r.period) : undefined;
  const glProvided = sources.some(x => x.type.toUpperCase() === "GL" && x.status === "Found");
  // SRC-05: the ruleset's account ranges are written for one chart of accounts. On another chart (CBRE's 1510-2420 against
  // Greystar's 11020-000) the range-based tests find no accounts and would otherwise report Pass having tested nothing.
  if (tb && tb.rows.length > 0) {
    const outside = tb.rows.filter(r => { const n = num(r.account); return isNaN(n) || n < rules.balanceSheetFrom || n > 99999; }).length;
    if (outside * 2 > tb.rows.length) add("SRC-05", "Source Validation", "Chart of accounts", "The TB's chart of accounts matches the ruleset's account ranges", WA,
      "Trial Balance", `Ruleset: ${rules.name}`, `${outside} of ${tb.rows.length} accounts outside the ranges`, "", "",
      `The TB uses a different chart of accounts from the ruleset (${rules.name}). Tests that find accounts by number range did not test anything, even where they show Pass: BSSS coverage (BSSS-02), cash accounts needing a rec (CASH-04), AR/AP Other ageing, accrual clear-down, utilities, contract services, depreciation, major expenses and the T12 trend tests. The tie-outs (TB, BSSS schedules, Balance Sheet, T12, Budget Comparison, GL, bank recs) did run.`,
      "Review the untested areas by hand until a ruleset for this client's chart is set up.");
  }
  // SRC-04: a review that only ran because the manager accepted a different code or period says so, visibly, with who and when.
  if (codes.length > 1 || periods.length > 1) {
    const conf = sources.filter(x => x.type.toUpperCase() === "CONFIRMATION" && x.status === "Accepted")[0];
    add("SRC-04", "Source Validation", "Manager confirmation", "Files identified as a different property or period were accepted by the reviewing manager", MO,
      "Review request", "Files", `${code} ${period}`, `${codes.length > 1 ? codes.slice(1).join("/") : code} ${acctPeriod}`, "",
      `The files are coded ${codes.length > 1 ? codes.slice(1).join("/") : code} for ${acctPeriod} and were accepted as the ${code} ${period} review${conf ? ` (${conf.file})` : " (confirmation details were not supplied by the flow)"}.`,
      "No action if this was intended. If not, move the files to the right property and period folder and run the review again.");
  }
  const srcRows = [
    src("BSSS", "Balance Sheet Support Schedule", true, !!bs, okP(bs), bs?.propertyCode, okM(bs), bs?.period, bs ? `Prepared by ${bs.preparedBy}` : ""),
    src("TB", "Trial Balance", true, !!tb, okP(tb), tb?.propertyCode, okM(tb), tb?.period, tb ? `Book: ${tb.book}` : ""),
    src("GL", "General Ledger Detail", true, !!gl || glProvided, gl ? okP(gl) : undefined, gl?.propertyCode, gl ? okM(gl) : undefined, gl?.period, gl ? `${gl.accountCount} accounts, ${gl.entryCount} entries` : "Presence checked only - the GL was not read"),
    src("T12", "T12", true, !!t12, okP(t12), t12?.propertyCode, okM(t12), t12?.period, ""),
    src("BC", "Budget Comparison", true, !!bc, okP(bc), bc?.propertyCode, okM(bc), bc?.period, ""),
    src("BANKREC", "Bank Reconciliation", cashNeedingRec.length > 0, !!recs, undefined, undefined, undefined, undefined, cashNeedingRec.length > 0 ? `Required: ${cashNeedingRec.length} cash account(s) on the TB` : "No cash on the TB"),
    src("MORTGAGE", "Mortgage Statement", debtAccounts.length > 0, !!debt, undefined, undefined, undefined, undefined, debtAccounts.length > 0 ? "Required: mortgage payable on the TB" : "No debt on the TB") ];
  [tb, bs, t12, bc, bal, gl].forEach(r => { if (r) (r.issues as string[]).forEach(m => add("SRC-03", "Source Validation", "", "Source file could be read completely", WA, "Reader", "", "", "", "", m, "Correct the file so it can be read, then re-run.")); });
  const tbGood = !!tb && okP(tb) === true && okM(tb) === true;

  // ---------------------------------------------------------------- TRIAL BALANCE
  if (tbGood && tb) {
    add("TB-01", "Trial Balance", "All accounts", "Ending balances sum to $0.00", tb.sumEnding === 0 ? PA : EX, "Trial Balance", "", tb.sumEnding, 0, tb.sumEnding, tb.sumEnding === 0 ? "Trial Balance is in balance." : "Trial Balance is out of balance.", tb.sumEnding === 0 ? "" : "Re-export the full Trial Balance (all accounts, one book).");
    if (tb.arithmeticAgreement < 1) add("TB-02", "Trial Balance", "All accounts", "Forward + Debit - Credit = Ending on every row", EX, "Trial Balance", "", tb.arithmeticAgreement, 1, "", "Columns may have been misread.", "Send this export to the tool owner before relying on the review.");
  }

  // ---------------------------------------------------------------- BSSS
  if (tbGood && tb && bs && okP(bs) && okM(bs)) {
    const seen: { [k: string]: BSSSRow } = {}, dup: { [k: string]: boolean } = {};
    bs.rows.forEach(r => { if (seen[r.account]) dup[r.account] = true; else seen[r.account] = r; });
    for (const r of bs.rows) {
      const where = `BSSS ${r.sourceTab}!${r.sourceCell}`, t = tbMap[r.account], tbBal = t ? r2(t.ending) : 0, diff = r2(r.balance - tbBal), item = `${r.account} ${t ? t.name : r.name}`;
      const T = "Schedule total = TB ending balance";
      if (dup[r.account]) { if (seen[r.account] === r) add("BSSS-03", "BSSS", item, "Each account supported once", EX, where, "", "", "", "", "Account is supported in more than one place on the BSSS; tie-out not performed.", "Support each account in one place only."); }
      else if (!t && r.balance === 0) add("BSSS-01", "BSSS", item, T, PA, where, "Trial Balance", 0, "not on TB", 0, "No balance on the BSSS and the account is not on the TB.", "");
      else if (!t) add("BSSS-01", "BSSS", item, T, EX, where, "Trial Balance", r.balance, "not on TB", r.balance, "BSSS supports a balance for an account that is not on the TB.", "Remove the schedule or correct the GL code on the BSSS.");
      else if (diff === 0) add("BSSS-01", "BSSS", item, T, PA, where, "Trial Balance", r.balance, tbBal, 0, "BSSS ties to the TB.", "");
      else if (r2(r.balance + tbBal) === 0) add("BSSS-01", "BSSS", item, T, EX, where, "Trial Balance", r.balance, tbBal, diff, "Amounts agree but the sign is reversed on the BSSS.", "Enter the balance with the TB sign (credits negative).");
      else add("BSSS-01", "BSSS", item, T, EX, where, "Trial Balance", r.balance, tbBal, diff, "BSSS does not tie to the TB.", "Correct the BSSS or post the correcting entry before release.");
    }
    for (const t of tb.rows) {
      const n = num(t.account), b = r2(t.ending);
      if (b === 0 || seen[t.account] || n < rules.balanceSheetFrom || n > rules.balanceSheetTo) continue;
      const rule = rules.coverage.filter(c => n >= c.from && n <= c.to)[0], item = `${t.account} ${t.name}`, T = "Balance sheet account with a balance has support";
      if (!rule) add("BSSS-02", "BSSS", item, T, WA, "Trial Balance", "BSSS", b, "no schedule", "", "No BSSS schedule and no coverage rule for this account.", "Add support, or ask the tool owner to classify this account.");
      else if (rule.coverage === "BSSS") add("BSSS-02", "BSSS", item, T, EX, "Trial Balance", "BSSS", b, "no schedule", "", "This account requires a BSSS schedule and none was found.", "Add a schedule for this account to the BSSS.");
      else if (rule.coverage !== "NONE") add("BSSS-02", "BSSS", item, T, MO, "Trial Balance", rule.note, b, "", "", `Supported outside the BSSS: ${rule.note}.`, "");
    }
    // AR-01 / AP-01: open items older than the limit
    for (const a of rules.aged) {
      const items = bs.items.filter(i => i.account.indexOf(a.accountPrefix) === 0);
      let flagged = 0;
      for (const i of items) {
        const age = i.date === "" ? -1 : daysBetween(i.date, periodEnd);
        if (age > a.days || age < 0) { flagged++; add(a.ruleId, a.category, `${i.account} ${i.description}`, `Open item age <= ${a.days} days`, EX, `BSSS CY!${i.sourceCell}`, "", i.amount, "", age < 0 ? "no date" : `${age} days`, age < 0 ? "Open item has no readable date." : `Open item is ${age} days old.`, "Clear the item or document why it remains open."); }
      }
      if (flagged === 0) add(a.ruleId, a.category, `${a.accountPrefix} (${items.length} open item(s))`, `Open item age <= ${a.days} days`, PA, "BSSS CY", "", "", "", "", items.length === 0 ? "No open items." : "All open items are within the limit.", "");
    }
  }

  // ---------------------------------------------------------------- BALANCE SHEET vs TB (catches a report run before the last entry posted)
  if (tbGood && bal && okP(bal) && okM(bal)) {
    let bad = 0, tested = 0;
    for (const r of bal.rows.filter(x => x.kind === "detail")) {
      const t = tbMap[r.account];
      if (/current year|net income/i.test(r.name) && tb) {                                         // Yardi carries this line at $0 on the TB, so tie it to TB net income
        const ni = r2(-tb.rows.filter(x => incomeStmt(x.account)).reduce((s, x) => s + x.ending, 0)), b = r2(r.values[0]); tested++;
        if (b !== ni) { bad++; add("BS-02", "Balance Sheet", `${r.account} ${r.name}`, "Current year earnings = net income per the TB", EX, "Balance Sheet", "Trial Balance (income and expense accounts)", b, ni, r2(b - ni), "Current year earnings on the Balance Sheet do not agree to the TB - the Balance Sheet was run before the final entries.", "Re-run the Balance Sheet after the final entry and replace the file."); }
        continue;
      }
      const sign = liabEquity(r.account) ? -1 : 1, b = r2(r.values[0] * sign), tbBal = t ? r2(t.ending) : 0; tested++;
      if (b !== tbBal) { bad++; add("BS-01", "Balance Sheet", `${r.account} ${r.name}`, "Balance Sheet balance = TB ending balance", EX, "Balance Sheet", "Trial Balance", b, tbBal, r2(b - tbBal), "Balance Sheet does not agree to the TB - the reports were run at different times.", "Re-run the Balance Sheet after the final entry and replace the file."); }
    }
    if (bad === 0) add("BS-01", "Balance Sheet", `${tested} accounts`, "Balance Sheet balance = TB ending balance", PA, "Balance Sheet", "Trial Balance", "", "", 0, "Every Balance Sheet account agrees to the TB.", "");
  }

  // ---------------------------------------------------------------- CASH (bank reconciliations read from the PDF)
  const recSummary: RecSummary[] = [];
  if (tbGood && recs && recs.bankRecs) {
    const used: { [k: string]: boolean } = {};
    for (const b of recs.bankRecs) {
      const label = `${b.accountName} (x${b.bankAccountLast4})`;
      const foot = r2(b.bankStatementBalance + b.outstandingDepositsTotal - b.outstandingChecksTotal + b.reconcilingItemsTotal + b.otherItemsTotal);
      const footOk = foot === r2(b.reconciledBankBalance);
      add("CASH-00", "Cash", label, "PDF read check: bank balance +/- the subtotals = the reconciled balance on the report", footOk ? PA : EX, "Bank Rec PDF", "", foot, b.reconciledBankBalance, r2(foot - b.reconciledBankBalance), footOk ? "The reconciliation read from the PDF foots." : "The subtotals read from the PDF do not foot to the reconciled balance. Do not rely on the cash tests below.", footOk ? "" : "Review this bank rec manually; send the PDF to the tool owner.");
      // Each section's listed lines must add up to that section's own subtotal. A miss here does not
      // affect the tie-out (the subtotals are used for that) - it means the ageing list is incomplete.
      const sect = (kind: string, list: RecItem[], stated: number) => {
        const got = sum(list), d = r2(got - stated);
        if (d !== 0) add("CASH-00", "Cash", `${label} - ${kind}`, `PDF read check: the ${list.length} listed ${kind.toLowerCase()} add to the ${kind.toLowerCase()} subtotal`, WA, "Bank Rec PDF lines", "Bank Rec PDF subtotal", got, stated, d, `${list.length} ${kind.toLowerCase()} were read but they do not add to the subtotal on the report, so a line was misread or missed. The tie-out above still stands; the ageing test for this section may be incomplete.`, "Check this section of the reconciliation by eye; send the PDF to the tool owner so the reader can be tightened.");
      };
      sect("Outstanding deposits", b.outstandingDeposits, b.outstandingDepositsTotal);
      sect("Outstanding checks", b.outstandingChecks, b.outstandingChecksTotal);
      sect("Reconciling items", b.reconcilingItems, b.reconcilingItemsTotal);
      sect("Other items", b.otherItems, b.otherItemsTotal);
      const readOk = footOk;
      let t = tbMap[b.glAccount];
      if (!t) t = tbRange(rules.cashFrom, rules.cashTo).filter(r => !used[r.account] && r2(r.ending) === r2(b.glBalance))[0];
      // One PDF per account is normal; two recs for the same account means a draft and a final, or the same file twice.
      if (t && used[t.account]) add("CASH-06", "Cash", `${t.account} ${t.name}`, "Each cash account has one reconciliation", EX, `Bank Rec ${label}`, "Bank Rec", "", "", "",
        "More than one bank reconciliation was provided for this cash account.", "Keep only the final reconciliation in the Internal Review folder (move drafts to an Archive subfolder).");
      if (t) used[t.account] = true;
      const T1 = "Bank rec GL balance = TB cash; reconciled difference = $0.00";
      let tieOk = false;
      if (!t) add("CASH-01", "Cash", label, T1, EX, "Bank Rec", "Trial Balance", b.glBalance, "no match", "", "No TB cash account matches this reconciliation.", "Confirm the reconciliation is for this property and period.");
      else { const d = r2(b.glBalance - t.ending); tieOk = d === 0 && r2(b.difference) === 0; add("CASH-01", "Cash", `${t.account} ${t.name}`, T1, tieOk ? PA : EX, `Bank Rec ${label}`, "Trial Balance", b.glBalance, r2(t.ending), d, tieOk ? "Bank rec ties to the TB with no unreconciled difference." : `Bank rec does not tie (unreconciled difference ${fmt(b.difference)}).`, tieOk ? "" : "Correct the reconciliation before release."); }
      if (b.reconciliationDate.substring(0, 7) !== periodEnd.substring(0, 7)) add("CASH-05", "Cash", label, "Reconciliation date falls in the review month", WA, "Bank Rec", "", b.reconciliationDate, acctPeriod, "", "Reconciliation date is outside the review month.", "Confirm the correct month's reconciliation was saved.");
      // Every outstanding item is aged at period end: Monitor over 30 days, Warning over 60, Exception over 90.
      let oldest = -1, over30 = 0;
      const ageTest = (ruleId: string, kind: string, list: RecItem[]) => {
        const T = `${kind}s outstanding ${rules.cashMonitorDays} days or less (Monitor over ${rules.cashMonitorDays}, Warning over ${rules.cashWarningDays}, Exception over ${rules.cashExceptionDays})`;
        let n = 0;
        for (const i of list) {
          const age = daysBetween(i.date, periodEnd);
          if (age > oldest) oldest = age;
          if (age <= rules.cashMonitorDays) continue;
          n++; over30++;
          const st = age > rules.cashExceptionDays ? EX : age > rules.cashWarningDays ? WA : MO;
          add(ruleId, "Cash", `${label} - ${kind} ${i.reference} ${i.description}`.trim(), T, st, "Bank Rec", "", i.amount, i.date, `${age} days`, `${kind} dated ${i.date} is ${age} days old at period end.`, st === MO ? `Follow up so it clears before ${rules.cashWarningDays} days.` : "Research and clear, void/reissue, or document why it remains.");
        }
        if (n === 0 && list.length > 0) add(ruleId, "Cash", `${label} - ${list.length} ${kind.toLowerCase()}(s)`, T, PA, "Bank Rec", "", "", "", "", `Nothing outstanding over ${rules.cashMonitorDays} days.`, "");
      };
      // Only age the lines of a reconciliation whose PDF read foots. If it does not, the lines are not trustworthy (the
      // prompt may have picked up cleared items as outstanding, as on Shiloh 09-2026) and CASH-00 already says so.
      if (footOk) {
        ageTest("CASH-02", "Outstanding check", b.outstandingChecks);
        ageTest("CASH-03", "Outstanding deposit", b.outstandingDeposits);
        ageTest("CASH-03", "Reconciling item", b.reconcilingItems);
        ageTest("CASH-03", "Other item", b.otherItems);
      }
      const recStatus = !footOk || !tieOk || oldest > rules.cashExceptionDays ? "Exception" : oldest > rules.cashWarningDays ? "Warning" : oldest > rules.cashMonitorDays ? "Monitor" : "Clean";
      recSummary.push({ account: label, glAccount: t ? t.account : "no match", reconciled: r2(b.reconciledBankBalance), glBalance: r2(b.glBalance), difference: r2(b.difference), oldest: oldest < 0 ? 0 : oldest, over30, status: recStatus });
    }
    cashNeedingRec.filter(r => !used[r.account]).forEach(r => {
      add("CASH-04", "Cash", `${r.account} ${r.name}`, "Every TB cash account has a bank reconciliation", EX, "Trial Balance", "Bank Rec", r2(r.ending), "no rec", "", "No bank reconciliation was found for this cash account.", "Add the reconciliation to the bank rec package.");
      recSummary.push({ account: `${r.name} - no reconciliation provided`, glAccount: r.account, reconciled: 0, glBalance: r2(r.ending), difference: 0, oldest: 0, over30: 0, status: "Exception" });
    });
  }

  // ---------------------------------------------------------------- MORTGAGE (statement read from the PDF)
  if (tbGood && debt && debt.mortgages && debt.mortgages.length > 0) {
    const m = debt.mortgages, tot = (f: (x: Mortgage) => number) => r2(m.reduce((s, x) => s + (f(x) || 0), 0)), who = m.map(x => `${x.servicer} x${x.loanNumberLast4}`).join(", ");
    const tbDebt = r2(-debtAccounts.reduce((s, r) => s + r.ending, 0)), p = tot(x => x.principalBalance);
    add("DEBT-01", "Mortgage", debtAccounts.map(r => r.account).join(", ") || "Mortgage payable", "Statement principal = TB mortgage payable", p === tbDebt ? PA : EX, `Mortgage statement ${who}`, "Trial Balance", p, tbDebt, r2(p - tbDebt), p === tbDebt ? "Principal ties to the TB." : "Principal does not tie to the TB.", p === tbDebt ? "" : "Post the principal entry or obtain the correct statement.");
    const esc = tbRange(rules.escrowFrom, rules.escrowTo);
    const escTest = (word: RegExp, label: string, stmt: number) => {
      const rows = esc.filter(r => word.test(r.name)), t = r2(rows.reduce((s, r) => s + r.ending, 0));
      if (rows.length === 0 && stmt === 0) return;
      add("DEBT-02", "Mortgage", rows.map(r => r.account).join(", ") || label, `${label} escrow per statement = TB`, stmt === t ? PA : WA, `Mortgage statement ${who}`, "Trial Balance", stmt, t, r2(stmt - t), stmt === t ? `${label} escrow ties to the TB.` : `${label} escrow differs from the TB (statement date vs month-end timing is the usual cause).`, stmt === t ? "" : "Reconcile the escrow activity and document the timing difference.");
    };
    escTest(/tax/i, "Tax", tot(x => x.taxEscrowBalance)); escTest(/insur/i, "Insurance", tot(x => x.insuranceEscrowBalance)); escTest(/replac|reserve|rehab/i, "Replacement reserve", r2(tot(x => x.replacementReserveBalance) + tot(x => x.otherReserveBalance)));
    const acc = tb ? tb.rows.filter(r => r.account.indexOf(rules.accruedInterestPrefix) === 0) : [], accBal = r2(-acc.reduce((s, r) => s + r.ending, 0)), intDue = tot(x => x.interestDue);
    if (acc.length > 0) add("DEBT-03", "Mortgage", acc.map(r => r.account).join(", "), "Interest due on the next payment = accrued interest on the TB", intDue === accBal ? PA : WA, `Mortgage statement ${who}`, "Trial Balance", intDue, accBal, r2(intDue - accBal), intDue === accBal ? "Accrued interest agrees to the statement." : "Accrued interest differs from the interest billed.", intDue === accBal ? "" : "Recalculate the interest accrual.");
    const next = nextPeriodStart(acctPeriod);
    m.filter(x => x.paymentDueDate.substring(0, 7) !== next.substring(0, 7)).forEach(x => add("DEBT-04", "Mortgage", `${x.servicer} x${x.loanNumberLast4}`, "Statement is the one billed for the month after the review period", WA, "Mortgage statement", "", x.paymentDueDate, next, "", "Statement payment date does not follow the review period.", "Confirm the correct month's statement was saved."));
  }

  // ---------------------------------------------------------------- GENERAL LEDGER
  if (tbGood && gl && okP(gl) && okM(gl)) {
    let bad = 0;
    for (const a of gl.accounts) {
      const t = tbMap[a.account], net = r2(a.debits - a.credits), item = `${a.account} ${a.name}`;
      if (!t) { bad++; add("GL-01", "General Ledger", item, "Every GL account section agrees to the TB", EX, "General Ledger", "Trial Balance", r2(a.ending), "not on TB", r2(a.ending), "GL has an account that is not on the Trial Balance.", "Re-run both reports for the same period and book."); continue; }
      const tNet = r2(t.debit - t.credit);
      if (r2(a.beginning) !== r2(t.forward) || net !== tNet || r2(a.ending) !== r2(t.ending)) {
        bad++; add("GL-01", "General Ledger", item, "Every GL account section agrees to the TB (beginning, activity, ending)", EX, "General Ledger", "Trial Balance", r2(a.ending), r2(t.ending), r2(a.ending - t.ending), "GL does not agree to the TB - the reports were run at different times.", "Re-run the General Ledger after the final entry and replace the file.");
      }
    }
    if (bad === 0) add("GL-01", "General Ledger", `${gl.accounts.length} accounts, ${gl.entryCount} entries`, "Every GL account section agrees to the TB (beginning, activity, ending)", PA, "General Ledger", "Trial Balance", "", "", 0, "Every GL account agrees to the TB.", "");

    if (gl.wrongPostPeriod > 0) add("GL-03", "General Ledger", `${gl.wrongPostPeriod} entries`, "Every entry is posted to the review period", EX, "General Ledger", "Review request", gl.wrongPostPeriod, 0, "", "Entries in this GL are posted to a different accounting period.", "Confirm the GL was run for the review period only.");
    else add("GL-03", "General Ledger", `${gl.entryCount} entries`, "Every entry is posted to the review period", PA, "General Ledger", "Review request", 0, 0, "", "All entries are posted to the review period.", "");

    // ACCR-01: the prior accrual must reverse to zero before the new month's accrual goes on
    for (const a of gl.accruals) {
      const item = `${a.account} ${a.name}`, T = "Prior accrual clears to $0.00 before the new accrual is posted";
      if (a.clearedToZero) add("ACCR-01", "Accruals", item, T, PA, "General Ledger", "", r2(a.reversalDebits), r2(a.newAccruals), 0, "Prior accrual reversed in full before the new accrual was posted.", "");
      else add("ACCR-01", "Accruals", item, T, EX, "General Ledger", "", r2(a.reversalDebits), r2(a.newAccruals), a.lowestAbsBalance, a.firstNewBeforeClear === "" ? "The prior accrual never cleared to zero this month." : `A new accrual was posted before the prior one cleared (${a.firstNewBeforeClear}).`, "Reverse the prior accrual in full, then post the current month's accrual.");
    }

    // GL-02: manual journal entries worth a human look
    const manual = gl.flagged.filter(f => f.reason.indexOf("Manual") === 0);
    manual.slice(0, 20).forEach(f => add("GL-02", "General Ledger", `${f.account} ${f.date} ${f.control}`, `Manual journal entries listed for review (over $${rules.glLargeEntry} or round thousands)`, MO, "General Ledger", "", f.amount, "", "", `${f.description} - ${f.reason}.`, ""));
    if (manual.length === 0) add("GL-02", "General Ledger", `${gl.entryCount} entries`, `Manual journal entries listed for review (over $${rules.glLargeEntry} or round thousands)`, PA, "General Ledger", "", "", "", "", "No manual entries met the review threshold.", "");
    gl.flagged.filter(f => f.reason.indexOf("Manual") !== 0).slice(0, 10).forEach(f => add("GL-04", "General Ledger", `${f.account} ${f.date} ${f.control}`, "Entry dates fall within the review period", WA, "General Ledger", "", f.amount, f.date, "", `${f.description} - ${f.reason}.`, "Confirm the entry belongs in this period."));
  }

  // ---------------------------------------------------------------- BUDGET COMPARISON + T12
  const t12Good = !!t12 && okP(t12) === true && okM(t12) === true, bcGood = !!bc && okP(bc) === true && okM(bc) === true;
  const col = (r: FinResult, label: string) => r.columns.map(c => c.toLowerCase().replace(/\s+/g, " ").trim()).indexOf(label);
  if (bcGood && bc && tbGood) {
    const ptd = col(bc, "ptd actual"), ytd = col(bc, "ytd actual"); let bad = 0, n = 0;
    for (const r of bc.rows.filter(x => x.kind === "detail")) {
      const t = tbMap[r.account], sign = creditNormal(r.account) ? -1 : 1, e = t ? r2(sign * t.ending) : 0, p = t ? r2(sign * (t.debit - t.credit)) : 0; n++;
      // A balance sheet line (capex on CBRE's tree) shows YTD activity, but the TB only has the month's movement and the
      // balance since inception, so it can only be tied for the month.
      if ((!liabEquity(r.account) && lead(r.account) !== 1 && !same(r.values[ytd], e)) || !same(r.values[ptd], p)) { bad++; add("BC-01", "Budget Comparison", `${r.account} ${r.name}`, "BC actuals = TB activity (PTD and YTD)", EX, "Budget Comparison", "Trial Balance", r2(r.values[ytd]), e, r2(r.values[ytd] - e), "Budget Comparison does not agree to the TB - the reports were run at different times.", "Re-run the Budget Comparison after the final entry and replace the file."); }
    }
    if (bad === 0) add("BC-01", "Budget Comparison", `${n} accounts`, "BC actuals = TB activity (PTD and YTD)", PA, "Budget Comparison", "Trial Balance", "", "", 0, "Every Budget Comparison account agrees to the TB.", "");
  }
  if (t12Good && t12 && tbGood) {
    const cur = t12.columns.length - 2; let bad = 0, n = 0;                                     // last column is "Total"
    for (const r of t12.rows.filter(x => x.kind === "detail")) {
      const t = tbMap[r.account], sign = creditNormal(r.account) ? -1 : 1, p = t ? r2(sign * (t.debit - t.credit)) : 0; n++;
      if (!same(r.values[cur], p)) { bad++; add("T12-00", "T12", `${r.account} ${r.name}`, "T12 current month = TB period activity", EX, "T12", "Trial Balance", r2(r.values[cur]), p, r2(r.values[cur] - p), "T12 does not agree to the TB - the reports were run at different times.", "Re-run the T12 after the final entry and replace the file."); }
    }
    if (bad === 0) add("T12-00", "T12", `${n} accounts`, "T12 current month = TB period activity", PA, "T12", "Trial Balance", "", "", 0, "Every T12 account agrees to the TB for the month.", "");
  }
  const inSection = (r: FinRow, s: string) => r.section.toLowerCase().indexOf(s.toLowerCase()) >= 0;
  const isMajor = (r: FinRow) => rules.major.some(m => inSection(r, m.section));
  if (bcGood && bc) {
    const pa = col(bc, "ptd actual"), pb = col(bc, "ptd budget");
    for (const m of rules.major) {
      const rows = bc.rows.filter(r => r.kind === "detail" && inSection(r, m.section)); if (rows.length === 0) continue;
      const act = r2(rows.reduce((s, r) => s + r.values[pa], 0)), bud = r2(rows.reduce((s, r) => s + r.values[pb], 0)), v = r2(act - bud), pct = bud === 0 ? 0 : Math.round(Math.abs(v / bud) * 1000) / 10;
      if (act === 0 && bud !== 0) add("MAJOR-01", "Major Expenses", m.label, "Expected monthly expense is recorded", EX, "Budget Comparison PTD Actual", "PTD Budget", act, bud, v, `${m.label} is budgeted this month and nothing is recorded.`, "Record or accrue the expense.");
      else add("MAJOR-01", "Major Expenses", m.label, "Expected monthly expense is recorded", PA, "Budget Comparison PTD Actual", "PTD Budget", act, bud, v, "Expense is recorded.", "");
      const big = Math.abs(v) > rules.majorAmt || (bud !== 0 && pct > rules.majorPct && Math.abs(v) >= rules.minChange);
      add("MAJOR-02", "Major Expenses", m.label, `Actual vs budget within ${rules.majorPct}% and $${rules.majorAmt}`, big ? WA : PA, "Budget Comparison PTD Actual", "PTD Budget", act, bud, `${fmt(v)} (${pct}%)`, big ? `${m.label} is ${fmt(Math.abs(v))} (${pct}%) ${v > 0 ? "over" : "under"} budget.` : "Within threshold.", big ? "Confirm the amount against the invoice, statement or schedule." : "");
    }
    // YTD variance: a drift that stays under the monthly limit all year still shows up here
    const ya = col(bc, "ytd actual"), yb = col(bc, "ytd budget");
    if (ya >= 0 && yb >= 0) {
      const over = bc.rows.filter(r => r.kind === "detail" && num(r.account) < 70000).map(r => ({ r, v: r2(r.values[ya] - r.values[yb]) }))
        .filter(x => Math.abs(x.v) > rules.ytdAmt && (x.r.values[yb] === 0 || Math.abs(x.v / x.r.values[yb]) * 100 > rules.ytdPct)).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
      over.slice(0, 15).forEach(x => add("BC-03", "Budget Comparison", `${x.r.account} ${x.r.name}`, `Year to date within ${rules.ytdPct}% and $${rules.ytdAmt} of budget`, WA, "Budget Comparison YTD Actual", "YTD Budget", r2(x.r.values[ya]), r2(x.r.values[yb]), x.v, `Year to date is ${fmt(Math.abs(x.v))} ${x.v > 0 ? "over" : "under"} budget.`, "Explain the year-to-date position, not just the month."));
      if (over.length === 0) add("BC-03", "Budget Comparison", "All accounts", `Year to date within ${rules.ytdPct}% and $${rules.ytdAmt} of budget`, PA, "Budget Comparison YTD Actual", "YTD Budget", "", "", 0, "No account is outside the year-to-date threshold.", "");
    }

    // Largest other budget variances, for the manager's judgement (not a pass/fail)
    bc.rows.filter(r => r.kind === "detail" && !isMajor(r) && num(r.account) < 70000).map(r => ({ r, v: r2(r.values[pa] - r.values[pb]) }))
      .filter(x => Math.abs(x.v) > rules.majorAmt && (x.r.values[pb] === 0 || Math.abs(x.v / x.r.values[pb]) * 100 > rules.majorPct)).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 15)
      .forEach(x => add("BC-02", "Budget Comparison", `${x.r.account} ${x.r.name}`, "Large PTD budget variances listed for manager review", MO, "Budget Comparison PTD Actual", "PTD Budget", r2(x.r.values[pa]), r2(x.r.values[pb]), x.v, `PTD variance of ${fmt(x.v)} to budget.`, ""));
  }
  if (t12Good && t12) {
    const cur = t12.columns.length - 2, first = Math.max(0, cur - 11);
    const count = { util1: 0, util2: 0, cont2: 0, cont3: 0, t1: 0, t2: 0 }, tested = { util: 0, cont: 0, other: 0 };
    for (const r of t12.rows.filter(x => x.kind === "detail")) {
      const n = num(r.account); if (n < rules.trendFrom || n > rules.trendTo || isMajor(r)) continue;
      const prior = r.values.slice(first, cur), c = r2(r.values[cur]), active = prior.filter(v => r2(v) !== 0).length;
      const typical = active === 0 ? 0 : Math.abs(prior.reduce((s, v) => s + v, 0) / active);
      const recent = prior.slice(-rules.trendMonths), base = r2(recent.reduce((s, v) => s + v, 0) / (recent.length || 1)), chg = r2(c - base), pct = base === 0 ? 0 : Math.round(Math.abs(chg / base) * 1000) / 10;
      const item = `${r.account} ${r.name}`, s1 = `T12 ${t12.columns[cur]}`, s2 = `Prior ${recent.length}-month average`, recurring = active >= rules.recurringMonths && recent.some(v => r2(v) !== 0) && typical >= rules.minChange;
      const util = inSection(r, rules.utilitySection), cont = inSection(r, rules.contractSection);
      if (util) tested.util++; else if (cont) tested.cont++; else tested.other++;
      if (recurring && c === 0) {
        if (util) { count.util2++; add("UTIL-02", "Utilities", item, "Utility with a history of activity has a current-month amount", EX, s1, `Active ${active} of ${prior.length} prior months`, 0, base, chg, "Utility normally has activity and the current month is $0.", "Record or accrue the current month's bill."); }
        else if (cont) { count.cont2++; add("CONT-02", "Recurring Contracts", item, `Contract active ${rules.recurringMonths}+ of the prior 12 months has a current-month amount`, WA, s1, `Active ${active} of ${prior.length} prior months`, 0, base, chg, "Recurring contract has no current-month activity.", "Confirm the invoice was received, or accrue."); }
        else { count.t1++; add("T12-01", "T12", item, `Account active ${rules.recurringMonths}+ of the prior 12 months has a current-month amount`, WA, s1, `Active ${active} of ${prior.length} prior months`, 0, base, chg, "Recurring activity is missing this month.", "Confirm nothing was missed, or accrue."); }
        continue;
      }
      if (Math.abs(chg) < rules.minChange) continue;
      if (util) { if (base !== 0 && pct > rules.utilPct) { count.util1++; add("UTIL-01", "Utilities", item, `Current month within ${rules.utilPct}% of the recent trend`, WA, s1, s2, c, base, `${fmt(chg)} (${pct}%)`, `Utility is ${pct}% ${chg > 0 ? "above" : "below"} its recent average.`, "Confirm against the bill; check for a missed or doubled invoice."); } }
      else if (Math.abs(chg) > rules.t12Amt || (base !== 0 && pct > rules.t12Pct)) {
        if (cont) { count.cont3++; add("CONT-03", "Recurring Contracts", item, `Current month within ${rules.t12Pct}% and $${rules.t12Amt} of the recent trend`, WA, s1, s2, c, base, `${fmt(chg)} (${pct}%)`, `Contract cost moved ${fmt(chg)} (${pct}%) from its recent average.`, "Confirm against the contract or invoice."); }
        else { count.t2++; add("T12-02", "T12", item, `Current month within ${rules.t12Pct}% and $${rules.t12Amt} of the recent trend`, WA, s1, s2, c, base, `${fmt(chg)} (${pct}%)`, `Moved ${fmt(chg)} (${pct}%) from its recent average.`, "Review the GL detail and explain or correct."); }
      }
    }
    rules.depreciationAccounts.split(",").map(x => x.trim()).filter(x => x !== "").forEach(a => {
      const r = t12.rows.filter(x => x.account === a)[0]; if (!r) return;
      const prior = r.values.slice(Math.max(0, cur - 3), cur), c = r2(r.values[cur]), base = r2(prior.reduce((s, v) => s + v, 0) / (prior.length || 1));
      const pct = base === 0 ? 0 : Math.round(Math.abs((c - base) / base) * 1000) / 10, item = `${a} ${r.name}`;
      const T = `Depreciation and amortization move less than ${rules.depreciationPct}% month to month`;
      if (base === 0 && c === 0) add("DEP-01", "Depreciation", item, T, PA, "T12", "", 0, 0, 0, "No depreciation recorded.", "");
      else if (c === 0) add("DEP-01", "Depreciation", item, T, EX, "T12", "Prior 3-month average", 0, base, r2(-base), "No depreciation was recorded this month.", "Post the monthly depreciation entry.");
      else if (pct > rules.depreciationPct) add("DEP-01", "Depreciation", item, T, WA, "T12", "Prior 3-month average", c, base, `${fmt(r2(c - base))} (${pct}%)`, "Depreciation changed from the prior months.", "Confirm assets were added or retired; otherwise correct the entry.");
      else add("DEP-01", "Depreciation", item, T, PA, "T12", "Prior 3-month average", c, base, r2(c - base), "Depreciation is steady.", "");
    });

    const passRow = (ruleId: string, cat: string, n: number, flagged: number, test: string) => { if (flagged === 0) add(ruleId, cat, `${n} accounts`, test, PA, "T12", "", "", "", "", "No accounts outside the threshold.", ""); };
    passRow("UTIL-01", "Utilities", tested.util, count.util1, "Current month within trend"); passRow("UTIL-02", "Utilities", tested.util, count.util2, "Expected activity present");
    passRow("CONT-02", "Recurring Contracts", tested.cont, count.cont2, "Expected activity present"); passRow("CONT-03", "Recurring Contracts", tested.cont, count.cont3, "Current month within trend");
    passRow("T12-01", "T12", tested.other, count.t1, "Expected activity present"); passRow("T12-02", "T12", tested.other, count.t2, "Current month within trend");
  }


  // ---------------------------------------------------------------- AME (month-end close reports)
  const AMEN: { [k: string]: string } = { AR: "Aged Receivables", AP: "Payables Aging", GPR: "Gross Potential Rent", SD: "Security Deposit Activity", RR: "Rent Roll" };
  for (const type of ["AR", "AP", "GPR", "SD", "RR"]) {
    const r = ame[type], label = AMEN[type];
    const listed = sources.filter(x => x.type.toUpperCase() === "AME_" + type)[0];
    if (!r) { if (listed && listed.status === "Found") add("AME-00", "AME", label, "The AME report could be read", WA, label, "", "", "", "", "The file was found but could not be read.", "Re-export it from Yardi as an Excel (.xlsx) file."); continue; }
    r.issues.forEach(m => add("AME-00", "AME", label, "The AME report could be read", WA, label, "", "", "", "", m, "Re-export the report and try again."));
    const okProp = isOurs(r.propertyCode), okPer = isOurPeriod(r.period);
    add("AME-00", "AME", label, "The AME report is for the requested property and period", okProp && okPer ? PA : EX, label, "Review request", `${r.propertyCode} ${r.period}`, `${code} ${period}`, "", okProp && okPer ? "Correct property and period." : "This AME report is for a different property or period.", okProp && okPer ? "" : `Replace with the ${label} for ${code} ${period}.`);
  }

  if (tbGood && tb && ameList.length > 0) {
    const bal = (csv: string) => r2(csv.split(",").map(x => x.trim()).filter(x => x !== "").reduce((t, a) => t + (tbMap[a] ? tbMap[a].ending : 0), 0));
    const act = (csv: string) => r2(csv.split(",").map(x => x.trim()).filter(x => x !== "").reduce((t, a) => t + (tbMap[a] ? tbMap[a].debit - tbMap[a].credit : 0), 0));
    const present = (csv: string) => csv.split(",").map(x => x.trim()).filter(x => x !== "" && tbMap[x] !== undefined).length > 0;

    for (const t of rules.ameTies) {
      const type = t.key.substring(0, t.key.indexOf(":")), key = t.key.substring(t.key.indexOf(":") + 1);
      const v = ameVal(type, key); if (!v || !present(t.accounts)) continue;
      const tbAmt = t.basis === "activity" ? act(t.accounts) : bal(t.accounts), reported = r2(t.sign * v.amount), diff = r2(reported - tbAmt);
      const item = `${t.label} (${t.accounts})`, test = `${AMEN[type]} ${v.label} = TB ${t.basis === "activity" ? "activity for the month" : "ending balance"}`;
      const where = `${AMEN[type]} ${v.sourceCell}`;
      if (diff === 0) add(t.status === MO ? "GPR-01" : "AME-01", "AME", item, test, PA, where, "Trial Balance", reported, tbAmt, 0, `${t.label} ties to the TB.`, "");
      else if (t.status === MO) add("GPR-01", "AME", item, test, MO, where, "Trial Balance", reported, tbAmt, diff, `${t.label} does not tie to the TB. These lines only tie once the GPR journal entry has posted, and the mapped accounts differ by chart.`, "Confirm the GPR entry posted and that the accounts above are the right ones for this chart.");
      else add("AME-01", "AME", item, test, EX, where, "Trial Balance", reported, tbAmt, diff, `${t.label} does not tie to the TB.`, "Correct the subledger or post the entry before release.");
    }

    // Security deposits: on hand plus delinquent deposits = the deposit liability accounts
    const onHand = ameVal("SD", "sdOnHand"), delinq = ameVal("SD", "sdDelinquent");
    if (onHand && present(rules.sdLiabilityAccounts)) {
      const liab = r2(-bal(rules.sdLiabilityAccounts)), plain = r2(onHand.amount - liab), withDel = r2(onHand.amount + (delinq ? delinq.amount : 0) - liab);
      const item = `Security deposits (${rules.sdLiabilityAccounts})`, test = "Deposits on hand (plus delinquent deposits) = the TB deposit liability";
      if (plain === 0) add("AME-02", "AME", item, test, PA, `Security Deposit Activity ${onHand.sourceCell}`, "Trial Balance", onHand.amount, liab, 0, "Deposits on hand tie to the TB.", "");
      else if (withDel === 0) add("AME-02", "AME", item, test, PA, `Security Deposit Activity ${onHand.sourceCell}`, "Trial Balance", r2(onHand.amount + (delinq ? delinq.amount : 0)), liab, 0, `Deposits on hand tie to the TB once delinquent deposits of ${fmt(delinq ? delinq.amount : 0)} are added, which is the expected reconciling item.`, "");
      else add("AME-02", "AME", item, test, EX, `Security Deposit Activity ${onHand.sourceCell}`, "Trial Balance", onHand.amount, liab, withDel, "Deposits on hand do not tie to the TB, even after delinquent deposits.", "Reconcile the deposit ledger to the GL before release.");
    }

    // Rent roll market rent vs GPR market rent (the two reports must agree with each other)
    const rrM = ameVal("RR", "rrMarketRent"), gprM = ameVal("GPR", "gprMarketRent");
    if (rrM && gprM) {
      const d = r2(rrM.amount - gprM.amount);
      add("AME-03", "AME", "Market rent", "Rent Roll market rent = GPR market rent", d === 0 ? PA : EX, `Rent Roll ${rrM.sourceCell}`, `GPR ${gprM.sourceCell}`, rrM.amount, gprM.amount, d, d === 0 ? "The two reports agree." : "Rent Roll and GPR market rent do not agree.", d === 0 ? "" : "Re-run both reports as of the same date.");
    }
  }

  // ---------------------------------------------------------------- Security deposit adequacy, clearing and abnormal balances
  if (tbGood && tb) {
    const list = (csv: string) => csv.split(",").map(x => x.trim()).filter(x => x !== "" && tbMap[x] !== undefined);
    const cashA = list(rules.sdCashAccounts), liabA = list(rules.sdOwedAccounts);
    if (cashA.length > 0 && liabA.length > 0) {
      const cash = r2(cashA.reduce((t, a) => t + tbMap[a].ending, 0)), owed = r2(-liabA.reduce((t, a) => t + tbMap[a].ending, 0)), gap = r2(cash - owed);
      add("SD-01", "Security Deposits", `${rules.sdCashAccounts} vs ${rules.sdOwedAccounts}`, "Security deposit cash is at least the deposit liability", gap >= 0 ? PA : EX, "Trial Balance", "Trial Balance", cash, owed, gap, gap >= 0 ? `Deposit cash covers the deposit liability, with ${fmt(gap)} to spare.` : `Deposit cash is ${fmt(-gap)} short of what is owed to residents, which many states do not allow.`, gap >= 0 ? "" : "Transfer the shortfall into the deposit account and find out why it arose.");
    }
    list(rules.clearingAccounts).forEach(a => {
      const b = r2(tbMap[a].ending);
      add("CLR-01", "Clearing Accounts", `${a} ${tbMap[a].name}`, "Clearing and suspense accounts are $0.00 at month end", b === 0 ? PA : EX, "Trial Balance", "", b, 0, b, b === 0 ? "Clear at month end." : "A balance is stranded in a clearing account.", b === 0 ? "" : "Post the item to its final account before release.");
    });
    const wrongWay = (csv: string, want: number, side: string) => {
      const rows = list(csv).filter(a => want * tbMap[a].ending < 0);
      rows.forEach(a => add("BAL-01", "Abnormal Balances", `${a} ${tbMap[a].name}`, `Accounts that should carry a ${side} balance`, EX, "Trial Balance", "", r2(tbMap[a].ending), "", "", `This account is carrying a ${side === "debit" ? "credit" : "debit"} balance.`, "Find the posting that put it the wrong way round."));
      return rows.length;
    };
    const wrong = wrongWay(rules.debitAccounts, 1, "debit") + wrongWay(rules.creditAccounts, -1, "credit");
    if (wrong === 0 && (rules.debitAccounts !== "" || rules.creditAccounts !== "")) add("BAL-01", "Abnormal Balances", "Checked accounts", "Accounts carry the balance they should", PA, "Trial Balance", "", "", "", "", "No account is the wrong way round.", "");
  }


  // ---------------------------------------------------------------- PROPERTY MANAGEMENT FEE
  if (fee) {
    fee.issues.forEach(m => add("PMF-00", "Management Fee", "PM Fee workbook", "The PM Fee workbook could be read", WA, "PM Fee", "", "", "", "", m, "Correct the workbook and re-run."));
    const idOk = fee.ok && isOurs(fee.propertyCode) && isOurPeriod(fee.period);
    add("PMF-00", "Management Fee", "PM Fee workbook", "The PM Fee workbook is for the requested property and period", idOk ? PA : EX, "PM Fee Calculation", "Review request", `${fee.propertyCode} ${fee.period}`, `${code} ${period}`, "", idOk ? "Correct property and period." : !fee.ok ? "The PM Fee workbook could not be read as a Yardi Fee Pool workbook (see the line above), so no fee tests ran. Other fee templates, such as an income-based workbook, are not supported yet." : "The PM Fee workbook is for a different property or period.", idOk ? "" : `Replace with the PM Fee workbook for ${code} ${period}.`);

    if (idOk) {
      // PMF-01: the fee base adds up, and the template's own validation against the Yardi Report agrees
      const lineDiff = r2(fee.baseLineSum - fee.baseTotal), checkDiff = r2(fee.baseTotalCheck - fee.baseTotal);
      add("PMF-01", "Management Fee", "Fee base", "Total Base = the sum of the charge lines, and agrees to the Yardi Report", lineDiff === 0 && checkDiff === 0 ? PA : EX, "PM Fee Calculation", "Yardi Report tab", fee.baseTotal, fee.baseTotalCheck, lineDiff !== 0 ? lineDiff : checkDiff, lineDiff === 0 && checkDiff === 0 ? "The fee base foots and agrees to the Yardi Report." : "The fee base does not foot, or does not agree to the Yardi Report.", lineDiff === 0 && checkDiff === 0 ? "" : "Refresh the Yardi Report tab and check no line was typed over.");

      // PMF-02: a base line should be pulled from the Yardi Report, never typed in
      const typedBase = fee.baseLines.filter(l => l.hardcoded);
      typedBase.forEach(l => add("PMF-02", "Management Fee", `${l.label} (row ${l.row})`, "Every fee base line is drawn from the Yardi Report, not typed in", EX, `PM Fee Calculation row ${l.row}`, "", l.amount, "", "", "This fee base line was typed in over the formula, so it is not coming from the charge data.", "Restore the formula, and put any genuine addition in the Adjustments block instead."));
      if (typedBase.length === 0) add("PMF-02", "Management Fee", `${fee.baseLines.length} base lines`, "Every fee base line is drawn from the Yardi Report, not typed in", PA, "PM Fee Calculation", "", "", "", "", "No base line has been typed over.", "");

      // PMF-03: recompute the fee from the contract terms
      const recomputedBase = r2(fee.baseTotal + fee.reductionsTotal + fee.adjustmentsTotal);
      const raw = r2(recomputedBase * fee.feeRate);
      const expected = fee.minimumFee > 0 && raw < fee.minimumFee ? r2(fee.minimumFee) : (fee.maximumFee > 0 && raw > fee.maximumFee ? r2(fee.maximumFee) : raw);
      const baseOk = r2(recomputedBase - fee.adjustedBase) === 0, feeOk = r2(expected - fee.feeDue) === 0;
      add("PMF-03", "Management Fee", `Fee at ${r4(fee.feeRate * 100)}% of the adjusted base`, "The fee equals the adjusted base times the contract rate, with the minimum and maximum applied", baseOk && feeOk ? PA : EX, "PM Fee Calculation", "Recalculated", fee.feeDue, expected, r2(fee.feeDue - expected), baseOk && feeOk ? "The fee recalculates exactly." : !baseOk ? "The Adjusted Base does not equal base plus reductions plus adjustments." : "The fee does not equal the adjusted base times the contract rate.", baseOk && feeOk ? "" : "Check the rate, minimum, maximum and the adjustment rows on the Calculation tab.");

      // PMF-04: the fee has to be in the GL, both as expense and as the accrual
      const feeExp = r2(rules.feeExpenseAccounts.split(",").map(x => x.trim()).filter(x => x !== "" && tbMap[x] !== undefined).reduce((t, a) => t + (tbMap[a].debit - tbMap[a].credit), 0));
      const feeAcc = r2(-rules.feeAccrualAccounts.split(",").map(x => x.trim()).filter(x => x !== "" && tbMap[x] !== undefined).reduce((t, a) => t + tbMap[a].ending, 0));
      const due = r2(fee.feeDue + fee.retailFee + fee.postedAdjustment);
      if (tbGood) {
        add("PMF-04", "Management Fee", `Management fee expense (${rules.feeExpenseAccounts})`, "The fee calculated is the fee expensed in the GL", r2(feeExp - due) === 0 ? PA : EX, "PM Fee Calculation", "Trial Balance", due, feeExp, r2(due - feeExp), r2(feeExp - due) === 0 ? "The fee expense agrees to the calculation." : "The fee expensed in the GL is not the fee the workbook calculates.", r2(feeExp - due) === 0 ? "" : "Correct the fee entry or the calculation before release.");
        add("PMF-04", "Management Fee", `Accrued management fee (${rules.feeAccrualAccounts})`, "The accrued fee on the balance sheet is this month's fee", r2(feeAcc - due) === 0 ? PA : WA, "PM Fee Calculation", "Trial Balance", due, feeAcc, r2(due - feeAcc), r2(feeAcc - due) === 0 ? "The accrual agrees to the calculation." : "The accrued fee does not equal this month's fee, which is normal only if part of it was paid.", r2(feeAcc - due) === 0 ? "" : "Confirm what was paid during the month.");
      }

      // PMF-05: a typed adjustment means the income came in as a journal entry. It must be in the GL.
      const live = fee.adjustments.filter(a => a.amount !== 0);
      for (const a of live) {
        const item = `${a.label} (row ${a.row})`;
        if (a.glAccount === "") { add("PMF-06", "Management Fee", item, "Every adjustment names the GL account it belongs to", MO, `PM Fee Calculation row ${a.row}`, "", a.amount, "", "", "This adjustment has no GL account beside it, so it cannot be traced automatically.", "Check it by hand, and put the GL code in column J so future reviews can trace it."); continue; }
        const acct = a.glAccount, t = tbMap[acct], entries = gl ? gl.manual.filter(m => m.account === acct) : [];
        const exact = entries.filter(m => r2(Math.abs(m.amount)) === r2(Math.abs(a.amount)));
        const test = "Hand-entered adjustments appear in the GL for the account named";
        if (!t) add("PMF-05", "Management Fee", item, test, EX, `PM Fee Calculation row ${a.row}`, "Trial Balance", a.amount, "not on TB", "", `The adjustment names ${acct}, which has no balance or activity on the TB.`, "Correct the GL account on the Calculation tab, or post the entry.");
        else if (!gl) add("PMF-05", "Management Fee", item, test, MO, `PM Fee Calculation row ${a.row}`, `TB ${acct}`, a.amount, r2(-(t.debit - t.credit)), "", "The GL was not read this month, so the entry behind this adjustment could not be traced.", "Add the General Ledger to the folder to have this checked.");
        else if (exact.length > 0) add("PMF-05", "Management Fee", item, test, PA, `PM Fee Calculation row ${a.row}`, `GL ${acct} ${exact[0].control}`, a.amount, r2(exact[0].amount), 0, `Matched to a journal entry in ${acct} dated ${exact[0].date} (${exact[0].description}).`, "");
        else {
          const activity = r2(-(t.debit - t.credit));
          add("PMF-05", "Management Fee", item, test, EX, `PM Fee Calculation row ${a.row}`, `GL ${acct}`, a.amount, activity, r2(a.amount - activity), entries.length === 0 ? `No journal entry for this amount was found in ${acct}; the account has ${fmt(activity)} of activity this month, none of it a manual entry.` : `No journal entry in ${acct} matches ${fmt(a.amount)}; the manual entries there are for other amounts.`, "Post the entry, or correct the adjustment on the Calculation tab.");
        }
      }
      if (live.length === 0) add("PMF-05", "Management Fee", "No adjustments", "Hand-entered adjustments appear in the GL for the account named", PA, "PM Fee Calculation", "", 0, "", "", "There are no adjustments this month.", "");

      // PMF-07: a sudden jump in the fee base usually means a cheque was scanned that should not be in revenue
      const hist = fee.trailing.filter(m => m.month !== acctPeriod && m.base !== 0).slice(-rules.feeTrailingMonths);
      const cur = fee.trailing.filter(m => m.month === acctPeriod)[0];
      if (cur && hist.length > 0) {
        const avg = r2(hist.reduce((t, m) => t + m.base, 0) / hist.length), chg = r2(cur.base - avg), pct = avg === 0 ? 0 : Math.round(Math.abs(chg / avg) * 1000) / 10;
        const spike = chg > 0 && pct > rules.feeSpikePct && chg > rules.feeSpikeAmt;
        add("PMF-07", "Management Fee", "Fee base against the trailing months", `The fee base is within ${rules.feeSpikePct}% and $${rules.feeSpikeAmt} of the prior ${hist.length}-month average`, spike ? EX : PA, "PM Fee Annual tab", `Prior ${hist.length}-month average`, cur.base, avg, `${fmt(chg)} (${pct}%)`, spike ? `The fee base jumped ${fmt(chg)} (${pct}%) above the trailing average. A jump this size is usually an insurance or refund cheque scanned as a resident receipt, which would inflate the fee.` : "The fee base is in line with the trailing months.", spike ? "Find the receipt behind the jump and reverse it out of revenue if it does not belong there." : "");
      }

      // PMF-08: Yardi's own fee figures sitting in the workbook, when they disagree with what was used
      if (fee.reportFeeRate > 0) {
        const reportRate = fee.reportFeeRate > 1 ? fee.reportFeeRate / 100 : fee.reportFeeRate;   // never round a rate: r2(0.0225) would become 0.02
        if (Math.abs(reportRate - fee.feeRate) > 0.000005) add("PMF-08", "Management Fee", "Fee rate", "The rate on the Yardi Report tab matches the rate used", MO, "Yardi Report tab", "PM Fee Calculation", r4(reportRate * 100), r4(fee.feeRate * 100), r4((reportRate - fee.feeRate) * 100), `The Yardi Report tab shows ${fmt(r4(reportRate * 100))}% and a posted fee of ${fmt(fee.reportFeePosted)}, while the calculation uses ${fmt(r4(fee.feeRate * 100))}%.`, "Confirm which rate the management agreement calls for.");
      }
    }
  }

  // ---------------------------------------------------------------- WRITE THE REPORT
  // Layout contract with tools/build_template.py (template v2.0). Rows and columns below are 0-based.
  const count = (s: string) => all.filter(f => f.status === s).length;
  const ex = count(EX), wa = count(WA), mo = count(MO), pa = count(PA);
  // The review reports findings only. Whether the package is ready is the manager's decision, made in the report.
  const overall = all.length > 0 ? "Review Complete" : "Not Started";
  const today = new Date().toISOString().substring(0, 10);

  // Executive Summary header: values in B3:B5 and F3:F6 (B:D and F:H are merged; write the anchor only)
  const es = workbook.getWorksheet("Executive Summary");
  if (es) {
    const put = (r: number, c: number, v: string) => { es.getCell(r, c).setValue(v); };
    es.getRangeByIndexes(4, 1, 1, 1).setNumberFormatLocal("@");                     // before writing, or Excel turns 07-2026 into a date
    put(2, 1, code); put(3, 1, tb ? tb.propertyName : ""); put(4, 1, period);
    put(2, 5, attempt); put(3, 5, submissionType); put(4, 5, today); put(5, 5, reportFileName);

    // BSSS: accounts needing attention, rows 30-39 (A:E written together, F alone because F:H is merged)
    const bsssProblems = all.filter(f => (f.ruleId === "BSSS-01" || f.ruleId === "BSSS-02" || f.ruleId === "BSSS-03") && (f.status === EX || f.status === WA));
    const shown = bsssProblems.slice(0, bsssProblems.length > 10 ? 9 : 10);
    shown.forEach((f, i) => {
      const missing = f.ruleId === "BSSS-02";
      es.getRangeByIndexes(29 + i, 0, 1, 5).setValues([[f.item, missing ? "Missing Information" : "Does Not Tie", missing ? "none" : cell(f.sourceValue), missing ? cell(f.sourceValue) : cell(f.comparisonValue), missing ? cell(f.sourceValue) : cell(f.difference)]]);
      es.getCell(29 + i, 5).setValue(f.finding);
    });
    if (bsssProblems.length > 10) es.getCell(38, 0).setValue(`...and ${bsssProblems.length - 9} more on the BSSS tab`);
    if (bsssProblems.length === 0) es.getCell(29, 0).setValue(bs ? "All BSSS schedules tie to the Trial Balance and every balance sheet account is supported." : "No BSSS was provided, so no tie-out was performed.");

    // Bank reconciliations, rows 44-51
    recSummary.slice(0, 8).forEach((b, i) => es.getRangeByIndexes(43 + i, 0, 1, 8).setValues([[b.account, b.status, b.glAccount, b.reconciled, b.glBalance, b.difference, b.oldest, b.over30]]));
    if (recSummary.length === 0) es.getCell(43, 0).setValue(recs ? "No reconciliation could be matched to the Trial Balance." : "No bank reconciliation was provided.");
  }

  // Source Validation grid: columns C-F and H of rows 4-10 (unchanged from v1.2)
  const sv = workbook.getWorksheet("Source Validation");
  if (sv) {
    sv.getRangeByIndexes(3, 2, srcRows.length, 4).setValues(srcRows.map(r => [r[0], r[1], r[2], r[3]]));
    sv.getRangeByIndexes(3, 7, srcRows.length, 1).setValues(srcRows.map(r => [r[4]]));
  }

  // Findings tables. Display order: what the manager reads first comes first.
  const HEAD = ["Status", "Account / Item", "Finding", "Required Action", "Difference / Variance / Age", "Source Value", "Comparison Value",
    "Source 1", "Source 2", "Test Performed", "Category", "Finding Type", "Rule ID", "Result ID", "Property Code", "Review Period"];
  const rowOf = (f: Finding): (string | number)[] => [f.status, f.item, f.finding, f.requiredAction, cell(f.difference), cell(f.sourceValue), cell(f.comparisonValue),
    f.source1, f.source2, f.test, f.category, f.findingType, f.ruleId, f.resultId, f.propertyCode, f.reviewPeriod];
  const rank = (st: string) => st === EX ? 0 : st === WA ? 1 : st === MO ? 2 : 3;
  const sorted = all.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f.status) - rank(b.f.status) || a.i - b.i).map(x => x.f);

  const writeTable = (sheetName: string, tableName: string, headerRow: number, head: string[], rows: (string | number)[][], capacity: number, textCols: number[]) => {
    let ws = workbook.getWorksheet(sheetName);
    if (!ws) { ws = workbook.addWorksheet(sheetName); ws.getRangeByIndexes(headerRow, 0, 1, head.length).setValues([head]); }
    if (rows.length === 0) return;
    textCols.forEach(c => { if (ws) ws.getRangeByIndexes(headerRow + 1, c, rows.length, 1).setNumberFormatLocal("@"); });   // dates and "91 days" stay as written
    ws.getRangeByIndexes(headerRow + 1, 0, rows.length, head.length).setValues(rows);
    const table = workbook.getTable(tableName);
    if (!table) ws.addTable(ws.getRangeByIndexes(headerRow, 0, rows.length + 1, head.length), true).setName(tableName);
    else if (rows.length > capacity) table.resize(ws.getRangeByIndexes(headerRow, 0, rows.length + 1, head.length));
  };
  const TEXT = [4, 5, 6, 15];
  for (const a of reviewAreas()) {
    const rows = sorted.filter(f => areaOf(f.category) === a.area).map(f => rowOf(f));
    writeTable(a.sheet, a.table, a.headerRow, HEAD, rows, a.capacity, TEXT);
  }
  writeTable("All Results", "tblAllResults", 2, ["FindingKey", "Review Area"].concat(HEAD),
    sorted.map(f => ([f.findingKey, areaOf(f.category)] as (string | number)[]).concat(rowOf(f))), 500, TEXT.map(c => c + 2));

  const rh = workbook.getWorksheet("Review History");
  if (rh) rh.getRangeByIndexes(3, 0, 1, 8).setValues([[attempt, submissionType, today, "", ex, wa, mo, reportFileName]]);   // D: Manager Decision, left for the manager

  const flagged = all.filter(f => f.status === EX).concat(all.filter(f => f.status === WA));
  return { overallStatus: overall.toUpperCase(), ruleset: rules.name, exceptions: ex, warnings: wa, monitor: mo, passed: pa,
    summary: `${code} ${period} ${attempt}: ${overall} - ${ex} exception(s), ${wa} warning(s), ${mo} to monitor, ${pa} passed. Awaiting manager decision.`,
    findingsText: flagged.length === 0 ? "No exceptions or warnings." : flagged.slice(0, 25).map(f => `[${f.status.toUpperCase()}] ${f.ruleId} | ${f.item} | ${f.finding}${f.difference !== "" ? " Difference/age: " + f.difference + "." : ""}${f.requiredAction !== "" ? " Action: " + f.requiredAction : ""}`).join("\n") + (flagged.length > 25 ? `\n...and ${flagged.length - 25} more in the report.` : ""),
    findings: flagged.slice(0, 60) };
}

/** Which review area (and so which report tab) a finding belongs to. Anything not listed goes to Other Controls. */
function areaOf(category: string): string {
  switch (category) {
    case "Source Validation": return "Source Files";
    case "BSSS": case "AR Other": case "AP Other": return "BSSS";
    case "Cash": return "Bank Reconciliations";
    case "T12": case "Utilities": case "Recurring Contracts": case "Depreciation": return "T12";
    case "Budget Comparison": case "Major Expenses": return "Budget Comparison";
    case "General Ledger": case "Accruals": return "General Ledger";
    case "Management Fee": return "PM Fee";
    default: return "Balance Sheet & Other";
  }
}
interface ReviewArea { area: string; sheet: string; table: string; headerRow: number; capacity: number; }
/** Tab and table for each area. Must match tools/build_template.py. headerRow is 0-based. */
function reviewAreas(): ReviewArea[] {
  return [
    { area: "Source Files", sheet: "Source Validation", table: "tblSourceFindings", headerRow: 12, capacity: 30 },
    { area: "BSSS", sheet: "BSSS", table: "tblBSSS", headerRow: 2, capacity: 100 },
    { area: "Bank Reconciliations", sheet: "Bank Rec", table: "tblBankRec", headerRow: 2, capacity: 100 },
    { area: "T12", sheet: "T12", table: "tblT12", headerRow: 2, capacity: 100 },
    { area: "Budget Comparison", sheet: "Budget Comparison", table: "tblBudget", headerRow: 2, capacity: 100 },
    { area: "General Ledger", sheet: "General Ledger", table: "tblGL", headerRow: 2, capacity: 100 },
    { area: "PM Fee", sheet: "PM Fee", table: "tblPMFee", headerRow: 2, capacity: 100 },
    { area: "Balance Sheet & Other", sheet: "Other Controls", table: "tblOther", headerRow: 2, capacity: 100 },
  ];
}

/** Starting rules for the Greystar Yardi base chart. Replace by passing rulesetJson (one per client chart). First matching coverage row wins. */
function defaultRuleset(): RuleSet {
  const c = (from: number, to: number, coverage: string, note: string): CoverageRule => ({ from, to, coverage, note });
  return { name: "Greystar Yardi base (DRAFT)", balanceSheetFrom: 10000, balanceSheetTo: 39999, coverage: [
      c(11000, 11099, "OTHER", "Bank reconciliation"), c(11700, 11799, "OTHER", "Mortgage statement escrow balances"), c(11100, 11999, "OTHER", "Bank or escrow statement"),
      c(12010, 12010, "OTHER", "AR aging"), c(12011, 12999, "BSSS", ""), c(13000, 13999, "BSSS", ""),
      c(14000, 16999, "OTHER", "Fixed asset / CapEx rollforward"), c(17000, 19999, "OTHER", "Amortization schedule"),
      c(21010, 21010, "OTHER", "AP aging"), c(21011, 21999, "BSSS", ""), c(22000, 22999, "BSSS", ""),
      c(23010, 23010, "OTHER", "Prepaid rent report"), c(23030, 23030, "OTHER", "Security deposit ledger"), c(23045, 23045, "OTHER", "Security deposit ledger"),
      c(23000, 23999, "BSSS", ""), c(24000, 24999, "OTHER", "Mortgage statement"), c(31000, 33999, "BSSS", ""), c(34000, 39999, "NONE", "Retained earnings")],
    ameTies: [
      { key: "AR:arTotal", label: "Accounts receivable", accounts: "12010-000", basis: "balance", sign: 1, status: "Exception" },
      { key: "AR:arPrepays", label: "Prepaid rent", accounts: "23010-000", basis: "balance", sign: 1, status: "Exception" },
      { key: "AP:apTotal", label: "Accounts payable", accounts: "21010-000", basis: "balance", sign: -1, status: "Exception" },
      { key: "GPR:gprMarketRent", label: "GPR market rent", accounts: "41000-000", basis: "activity", sign: -1, status: "Reviewed / Monitor" },
      { key: "GPR:gprLossGainToLease", label: "GPR gain / loss to lease", accounts: "41010-000", basis: "activity", sign: 1, status: "Reviewed / Monitor" },
      { key: "GPR:gprVacancy", label: "GPR vacancy", accounts: "41100-000", basis: "activity", sign: 1, status: "Reviewed / Monitor" },
      { key: "GPR:gprModel", label: "GPR model / non-revenue units", accounts: "41120-000", basis: "activity", sign: 1, status: "Reviewed / Monitor" },
      { key: "GPR:gprConcessions", label: "GPR concessions", accounts: "41091-000,41092-000,41093-000", basis: "activity", sign: -1, status: "Reviewed / Monitor" },
      { key: "GPR:gprWriteOff", label: "GPR write off", accounts: "41150-000", basis: "activity", sign: -1, status: "Reviewed / Monitor" }],
    feeExpenseAccounts: "61030-000", feeAccrualAccounts: "22005-000", feeSpikePct: 25, feeSpikeAmt: 50000, feeTrailingMonths: 3,
    sdCashAccounts: "11040-000", sdLiabilityAccounts: "23030-000,23045-000", sdOwedAccounts: "23030-000,23035-000,23045-000",
    clearingAccounts: "23040-000", debitAccounts: "11020-000,11040-000,12010-000", creditAccounts: "21010-000,23010-000,23030-000,23045-000,24010-000",
    ytdPct: 10, ytdAmt: 25000, depreciationAccounts: "68010-000,68020-000,68030-000", depreciationPct: 10,
    cashFrom: 11000, cashTo: 11099, escrowFrom: 11700, escrowTo: 11799, debtFrom: 24000, debtTo: 24999, accruedInterestPrefix: "22080",
    aged: [{ accountPrefix: "12075", ruleId: "AR-01", category: "AR Other", days: 30 }, { accountPrefix: "21065", ruleId: "AP-01", category: "AP Other", days: 30 }],
    utilitySection: "Utilities", contractSection: "Contract Services",
    major: [{ label: "Mortgage interest", section: "Debt Service" }, { label: "Property tax", section: "Taxes" }, { label: "Insurance", section: "Insurance" }, { label: "Management fee", section: "Management Fees" }],
    trendFrom: 40000, trendTo: 69999, trendMonths: 3, recurringMonths: 6,
    glLargeEntry: 25000, majorPct: 15, majorAmt: 5000, utilPct: 20, t12Pct: 15, t12Amt: 5000, minChange: 1000, cashMonitorDays: 30, cashWarningDays: 60, cashExceptionDays: 90 };
}
function pick(s: string | undefined): string { return s === undefined || s === null ? "" : String(s).trim(); }
function parse<T>(s: string | undefined): T | undefined { const t = pick(s); if (t === "" || t === "null") return undefined; try { const v = JSON.parse(t) as T | string; return (typeof v === "string" ? JSON.parse(v) : v) as T; } catch (e) { return undefined; } }
/** Bank recs arrive either as one prompt response (one PDF holding every account) or, when the folder has one PDF per
 *  account, as a list of prompt responses. Take the bankRecs list from each response and put them together. */
function recsFrom(t: string): BankRec[] | undefined {
  if (t === "" || t === "null") return undefined;
  let v: unknown = t;
  try { v = JSON.parse(t); if (typeof v === "string") v = JSON.parse(v); } catch (e) { v = t; }
  const parts: unknown[] = Array.isArray(v) ? v : [v];
  const out: BankRec[] = [];
  let found = false;
  for (const p of parts) { const list = dig(p, "bankRecs", 0) as BankRec[] | undefined; if (list) { found = true; list.forEach(b => { if (b) out.push(b); }); } }
  return found ? out : undefined;
}
/** Parses a reader's result, looking inside wrappers such as the flow's {"result": ...}. Anything without the reader's key list is rejected. */
function reader<T>(s: string | undefined, key: string): T | undefined { const t = pick(s); if (t === "" || t === "null") return undefined; return holder(t, key, 0) as T | undefined; }
function holder(v: unknown, key: string, depth: number): unknown {
  if (depth > 6 || v === null || v === undefined) return undefined;
  if (typeof v === "string") { const t = v.trim(); if (t.charAt(0) !== "{" && t.charAt(0) !== "[" && t.charAt(0) !== '"') return undefined; try { return holder(JSON.parse(t), key, depth + 1); } catch (e) { return undefined; } }
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as { [k: string]: unknown };
  if (Array.isArray(o[key])) return o;
  for (const k of Object.keys(o)) { const r = holder(o[k], key, depth + 1); if (r !== undefined) return r; }
  return undefined;
}
/** Finds the named list anywhere inside what the AI prompt step returned (the flow may pass the whole response, or JSON inside text). */
function dig(v: unknown, key: string, depth: number): unknown {
  if (depth > 8 || v === null || v === undefined) return undefined;
  if (typeof v === "string") { const t = v.trim(); if (t.charAt(0) !== "{" && t.charAt(0) !== "[" && t.charAt(0) !== '"') return undefined; try { return dig(JSON.parse(t), key, depth + 1); } catch (e) { return undefined; } }
  if (typeof v !== "object") return undefined;
  const o = v as { [k: string]: unknown };
  if (Array.isArray(o[key])) return o[key];
  for (const k of Object.keys(o)) { const r = dig(o[k], key, depth + 1); if (r !== undefined) return r; }
  return undefined;
}
function sum(list: RecItem[]): number { return r2((list || []).reduce((s, i) => s + i.amount, 0)); }
function fmt(v: number | string): string { return typeof v === "number" ? v.toFixed(2) : v; }
function cell(s: string): string | number { return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : s; }
function r4(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 10000 + 1e-9) / 10000; }
function r2(x: number): number { return (x < 0 ? -1 : 1) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; }
function endOfPeriod(p: string): string { const m = parseInt(p.substring(0, 2), 10), y = parseInt(p.substring(3), 10); return new Date(Date.UTC(y, m, 0)).toISOString().substring(0, 10); }
function nextPeriodStart(p: string): string { const m = parseInt(p.substring(0, 2), 10), y = parseInt(p.substring(3), 10); return new Date(Date.UTC(y, m, 1)).toISOString().substring(0, 10); }
function daysBetween(from: string, to: string): number { const a = Date.parse(from), b = Date.parse(to); return isNaN(a) || isNaN(b) ? -1 : Math.round((b - a) / 86400000); }
