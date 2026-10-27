# Internal Review Agent — Takeover Doc

Prepared 2026-09-24 · Rowena Chen

## What this is and where it stands

The Internal Review Agent automates the monthly internal review of property accounting packages at Greystar. A manager asks the agent for a property code and review period; the agent triggers a Power Automate flow that pulls the month's source files from SharePoint, runs every accounting tie-out and analytical test, writes an Excel findings report into the property's Review Results folder, and posts the result back to the manager in Teams.

**Status as of 2026-09-24: working end to end for Yardi properties.** A full review has run successfully against 610 West (mn610wes) for 07-2026, producing a report and a Teams notification. This is a working pilot, not a rolled-out product.

The central design decision, and the one worth defending in any future change: **no language model ever does arithmetic or decides whether something ties.** Models are used for exactly one job, reading numbers off two PDFs that Excel cannot open, and even then those numbers are checked for internal consistency before any test relies on them. Every accounting rule is deterministic TypeScript running in Excel Online. That is what makes the output defensible to an auditor and repeatable month to month.

Work is Yardi-only today. Financials are always Yardi across the portfolio, but the AME (Accounting Month End) subledger reports come from three systems: Yardi, OneSite and Entrata. Only the Yardi AME readers are built. OneSite and Entrata were deliberately deferred so all three could be added together rather than piecemeal.

## How it works end to end

Four layers, each doing only what it is good at.

**The agent** (Copilot Studio, named *Accounting Manager Internal Review Agent*) collects the property code and review period, calls the flow, and explains the result afterwards. It never calculates anything.

**The flow** (Power Automate agent flow, *Validate Internal Review Packages*) resolves the property's SharePoint site from a directory table, builds the folder path from the period, finds and classifies the files, calls the scripts, creates the report from a template, and posts to Teams. It can see file names and move data around, but it cannot read a cell.

**Office Scripts** (TypeScript, running in Excel Online) are the only layer that opens a workbook. A script can only see the workbook it is run against, so the pattern throughout is: one reader script per source file returns a normalized JSON summary, and one rule engine script runs against a fresh copy of the report template, receives all the readers' JSON, performs every test, and writes the findings. Source files are never modified.

**Two AI prompts** read the bank reconciliation PDF and the mortgage statement PDF, because Office Scripts cannot open a PDF. Each prompt returns strict JSON and is instructed to copy numbers exactly and never calculate. The engine then re-foots what came back before trusting it.

One timing constraint shapes the design: a full review takes several minutes, and the agent only waits about 100 seconds for a flow. So the flow answers the agent immediately with the file-validation result, then keeps working and delivers the findings by Teams message when done.

### The run, in order

1. Agent collects property code, review period, requester email.
2. Flow resolves the site URL and builds the Internal Review folder path.
3. Flow lists the folder and filters it into one file per source type.
4. `Sources JSON` records what was found, missing, or duplicated.
5. Readers run: TB, BSSS, T12, Budget Comparison, Balance Sheet, GL, five AME reports, PM Fee.
6. Two PDF prompts run.
7. Flow copies the report template into `Review Results`, named `<code>_<MM.YYYY>_Internal_Review_R<n>.xlsx`, where the attempt number is derived from how many reports already exist for that period.
8. The rule engine runs against that copy and writes every tab.
9. Teams message goes to the requester with the summary and a link.

## Files to carry over

Everything below was produced in the personal-account conversation and should be uploaded to the work account in one batch, so the new session starts with full context.

**Build artifacts (the actual system)**

| File | What it is |
| --- | --- |
| `BUILD_GUIDE.md` | Step-by-step build instructions, flow steps, expression snippets, fix-it table, full rule catalog. The primary document. |
| `01_ReadTrialBalance.ts` | Reader: Yardi Trial Balance |
| `02_ReadBSSS.ts` | Reader: Greystar Balance Sheet Support Schedule |
| `03_ReadYardiFinancial.ts` | Reader: T12, Budget Comparison, Balance Sheet (one script, three uses) |
| `04_RunInternalReview.ts` | The rule engine. Runs every test, writes the report. |
| `05_ReadGeneralLedger.ts` | Reader: General Ledger detail |
| `06_ReadAMEReport.ts` | Reader: the five Yardi AME reports (one script, five uses) |
| `07_ReadPMFee.ts` | Reader: PM Fee calculation workbook |
| `PROMPT_1_BankRec.txt` | Text and JSON schema for the bank rec PDF prompt |
| `PROMPT_2_Mortgage.txt` | Text and JSON schema for the mortgage statement prompt |
| `Internal_Review_Report_Template_v2_0.xlsx` | The report template the flow copies each run (v2.0: tabs by review area) |
| `SAMPLE_mn610wes_07.2026_Internal_Review_R1.xlsx` | The answer key: what a correct run against the calibration packet produces |

**Calibration packet (610 West, 07-2026)** — needed to verify any future change. Trial Balance, BS Support Schedule (.xlsm), General Ledger, 12 Month Statement, Budget Comparison, Balance Sheet with Period Change, combined Bank Reconciliation PDF, Mortgage Statement PDF, the five AME reports (Aged Receivables, Payables Aging, Gross Potential Rent, Security Deposit Activity, Rent Roll with Lease Charges), and the PM Fee workbook.

**Knowledge pack** — `Internal_Review_Agent_Knowledge_Pack_v2_1_PM_Fee.zip`, ten controlled documents covering the overview, FRD, rule library, PM Fee and GL specifications, file detection, finding catalog, workbook standards, test scenarios and agent instructions. Note the conflicts listed further down before treating these as current.

**Earlier handoffs** — `Handoff_Property_Accounting_Review_Suite.md`, `Internal_Review_Agent_Transition_to_Accounting_Review.md`, and `Handoff_AME_Review_Tools.md`. The AME handoff in particular records hard-won structural facts about the subledger reports and should not be lost.

## What each script does

All six readers are read-only and modify nothing. Every one finds its values by label, never by fixed cell address, so rows inserted by an accountant do not break them. Each prints a one-line console summary so it can be tested by hand in Excel Online before the flow is wired up.

**01 ReadTrialBalance** — reads the property code, period and book from the header, locates the Debit/Credit columns by their headers, and returns every account row. Also checks that Forward + Debit − Credit equals Ending on every row, which proves the columns were read correctly.

**02 ReadBSSS** — reads the Greystar BSSS template. Returns one supported balance per GL account, converted to Trial Balance sign, from the CY tab's ACCOUNT blocks plus the Prepaid Other, Real Estate Taxes, Property Insurance and Accrued Expenses schedule tabs. Accrued sections print as positive and are flipped. It also returns the individual open items behind each balance, which is what the AR and AP ageing rules use.

**03 ReadYardiFinancial** — one script for the 12 Month Statement, the Budget Comparison and the Balance Sheet. It reads the report title, column headings and every account row, tagging each row as detail or total and recording its section heading.

**04 RunInternalReview** — the rule engine. Runs against a fresh copy of the report template and receives every reader's output as JSON. It never stops at the first exception. It writes the Executive Summary, Source Validation, Exceptions, Warnings, Reviewed_Monitor, Passed Controls, Review History and a full All Results sheet, and returns a status, counts and a plain-text findings list for the Teams message. Every finding carries a stable `FindingKey` of property, period, rule and item, which is what a future R1-versus-R2 comparison will join on.

**05 ReadGeneralLedger** — walks the GL's Beginning Balance to Ending Balance sections. Returns a per-account summary rather than the 9,687 detail rows, plus all 459 manual journal entries, the accrual clear-down analysis, and a short list of entries worth a look. Only `J-` control numbers count as manual; `C-`, `R-`, `P-` and `K-` come from the resident, receipt, payable and invoice subledgers, and treating those as manual produced 670 meaningless flags before the rule was tightened.

**06 ReadAMEReport** — one script for the five Yardi AME reports. It identifies which report it is from the title and refuses anything else, so a OneSite or Entrata file produces a named failure rather than a plausible wrong number. Critically, it reads each report's own total rows and never sums the detail: a Yardi rent roll prints several charge rows per unit, and adding the market rent column gives 1,117,548 where the report's own total says 1,061,771.

**07 ReadPMFee** — reads the PM Fee workbook's Calculation, Yardi Report and Annual tabs. It uses `getFormulas()` to tell a formula-driven line from a typed one, which is the whole basis of the adjustment review: a base line should be a SUMIFS off the Yardi Report tab, and an adjustment should be typed, meaning the income arrived as a journal entry rather than a resident charge. It also returns the Annual tab's monthly Total Base row, which drives the revenue spike test.

## Rule catalog

Every test the engine currently runs. Severity is the default in `defaultRuleset()` at the bottom of script 04.

| Rule | Test | Result if it fails |
| --- | --- | --- |
| SRC-01 | Every required source is present, one version only. Bank rec required when the TB has cash; mortgage statement required when the TB has debt | Exception |
| SRC-02 | Each file is for the requested property and month, read from inside the file rather than the filename | Exception, and that file's tests are skipped |
| SRC-03 | Each source could be read completely | Warning |
| SRC-04 | Files for a different property code or period were accepted by the reviewing manager (names who and when) | Reviewed / Monitor |
| TB-01, TB-02 | TB sums to zero; Forward + Debit − Credit = Ending on every row | Exception |
| BSSS-01 | Every BSSS schedule ties to the TB to the cent; reversed signs called out separately | Exception |
| BSSS-02 | Balance sheet account with a balance and no schedule | Exception, Monitor or Warning per the coverage table |
| BSSS-03 | Same account supported in two places | Exception |
| AR-01, AP-01 | AR Other and AP Other open items over 30 days | Exception |
| BS-01, BS-02 | Balance Sheet agrees to the TB; current year earnings equal TB net income | Exception |
| BC-01, T12-00 | Budget Comparison and T12 agree to the TB. Catches a stale export | Exception |
| GL-01 | Every GL account section agrees to the TB on beginning, activity and ending | Exception |
| GL-03 | Every entry is posted to the review period | Exception |
| ACCR-01 | The prior accrual reverses to $0.00 before the new month's accrual posts | Exception |
| GL-02 | Manual journal entries over $25,000 or round thousands | Monitor |
| GL-04 | Manual entries dated outside the review period | Warning |
| CASH-00 | The subtotals read off the bank rec PDF foot to the reconciled balance | Exception |
| CASH-00 | Each section's listed lines add to that section's subtotal | Warning, naming the section |
| CASH-01 | Bank rec GL balance = TB cash, unreconciled difference $0.00 | Exception |
| CASH-02, CASH-03 | Every outstanding item aged at period end | Monitor over 30 days, Warning over 60, Exception over 90 |
| CASH-04 | Every TB cash account has a reconciliation | Exception |
| CASH-06 | Each cash account has only one reconciliation (bank recs may arrive one PDF per account) | Exception |
| DEBT-01 | Statement principal = TB mortgage payable | Exception |
| DEBT-02, DEBT-03 | Escrow balances and accrued interest vs the statement | Warning |
| DEBT-04 | Statement is the one billed for the following month | Warning |
| AME-00 | Each AME report is readable and for the right property and month | Exception |
| AME-01 | Aged Receivables total and prepays, and Payables Aging total, tie to the TB | Exception |
| AME-02 | Deposits on hand plus delinquent deposits = the TB deposit liability | Exception |
| AME-03 | Rent Roll market rent = GPR market rent | Exception |
| GPR-01 | GPR market rent, gain/loss to lease, vacancy, model, concessions, write-off vs TB activity | Monitor |
| SD-01 | Security deposit cash is at least what is owed to residents | Exception |
| CLR-01 | Clearing and suspense accounts are $0.00 at month end | Exception |
| BAL-01 | Accounts carry the balance side they should | Exception |
| MAJOR-01, MAJOR-02 | Mortgage interest, property tax, insurance and management fee recorded when budgeted; within 15% and $5,000 | Exception / Warning |
| BC-02 | The 15 largest other PTD budget variances | Monitor |
| BC-03 | Year to date within 10% and $25,000 of budget | Warning |
| UTIL-01, UTIL-02 | Utility within 20% of its 3-month average; utility active 6+ of 11 prior months showing $0 | Warning / Exception |
| CONT-02, CONT-03 | Contract Services recurring and $0 this month; within 15% and $5,000 of trend | Warning |
| T12-01, T12-02 | The same two tests for all other income and expense accounts, 40000–69999 | Warning |
| DEP-01 | Depreciation and amortization steady month to month | Exception if missing, Warning if it moves |
| PMF-00 | PM Fee workbook readable and for the right property and month | Exception |
| PMF-01 | Total Base foots and agrees to the Yardi Report tab | Exception |
| PMF-02 | No fee base line typed over its formula | Exception |
| PMF-03 | Fee = adjusted base × contract rate, minimum and maximum applied | Exception |
| PMF-04 | The fee calculated is the fee expensed and accrued in the GL | Exception / Warning |
| PMF-05 | Every hand-entered adjustment matches a journal entry in the GL account it names | Exception |
| PMF-06 | Adjustments with no GL account beside them | Monitor |
| PMF-07 | Fee base within 25% and $50,000 of the prior 3-month average | Exception |
| PMF-08 | The fee rate on the Yardi Report tab matches the rate used | Monitor |

The engine carries 60 automated tests that run against the calibration packet, covering both the passing case and a deliberately broken version of each rule. All 60 pass as of this writing.

## Calibration facts: 610 West, 07-2026

These numbers were verified against the real files. Any rebuild or change must still reproduce them. If a future version disagrees with any figure here, the change is wrong until proven otherwise.

**Expected result of a clean run:** `mn610wes 07-2026 R1: Review Complete - 3 exception(s), 44 warning(s), 58 to monitor, 85 passed. Awaiting manager decision.` (report template v2.0 and the 30/60/90-day bank rec ageing)

**Reader outputs**

| Reader | Expected console line |
| --- | --- |
| Trial Balance | 210 accounts, in balance: true, 0 problems |
| BSSS | 22 supported accounts, 45 open items, 0 problems |
| 12 Month Statement | 260 rows, 13 columns |
| Budget Comparison | 206 rows, 9 columns |
| Balance Sheet | 56 rows, 3 columns |
| General Ledger | 210 accounts, 9,687 entries, 459 manual entries, 18 flagged |
| AME | AR 4 totals, AP 2 totals, GPR 8 totals, SD 5 totals, RR 3 totals |
| PM Fee | base 911,225.84, 8 adjustments, fee due 22,786.57, 7 months |

**Tie-outs that hold exactly**

- All 22 BSSS schedules tie to the TB, including Prepaid Other at 5,981.985 against 5,981.99, which passes because the rule compares at two decimals.
- Aged Receivables total 132,014.96 = TB 12010; prepays −25,733.24 = TB 23010 prepaid rent.
- Payables Aging grand total 76,728.90 = TB 21010.
- Rent Roll market rent = GPR market rent = TB 41000 activity = 1,061,771.00.
- GPR gain/loss to lease 123,879.10, vacancy 63,145.31 and model 4,675.00 all tie to TB activity.
- Mortgage: principal 77,830,000 = TB 24010; tax escrow 787,827.63; insurance escrow 190,248.40; replacement reserve 153,000.00; interest due 380,675.18 = accrued interest 22080.
- Both bank recs tie: operating reconciled balance 284,746.15 = GL, security deposit 353,796.91 = GL.
- GL ties to the TB on all 210 sections for beginning, activity and ending.
- All four accrual accounts cleared to zero before new accruals posted. 22010 reversed 106,715.97 to exactly zero on 7/01 before the 7/31 entries.
- PM Fee: base 911,225.84 foots and matches the Yardi Report tab; fee recalculates to 22,786.57 at 2.5%; that is exactly the activity in 61030 expense and the ending balance in 22005 accrual.
- Security deposit adequacy: deposit cash 353,796.91 against 350,973.66 owed including interest, a 2,823.25 surplus.

**Deliberate reconciling items built into the rules**

- Deposits on hand 330,199.86 does not equal the deposit liability 331,804.29 on its own. The gap is exactly the 1,604.43 delinquent deposits column, so the rule adds it and reports a pass with the explanation.
- The GPR has two market rent totals: 1,057,096 for revenue units and 1,061,771 including the two model units. Only the grand total matches the GL. The rent roll cross-check is what catches use of the wrong one.
- Deposits on hand is deliberately never tied to the rent roll deposit figure (322,921.86); they differ by refunds pending, by design.

**Known exceptions in this packet, both real**

1. The Balance Sheet in the folder shows Accrued Expense 22010 at 112,327.91 while the TB and BSSS show 85,745.35, and its current year earnings are 26,582.56 below TB net income. That Balance Sheet was exported before a late entry posted and needs replacing.
2. A 5/1/2026 reconciling item on the operating bank rec, American Bankers credit of −1,402.22, is 91 days old.

**Two things flagged for a human that are not resolved**

- GPR concessions read 540.77 against 589.55 in accounts 41091–41093, and write-off reads 6,458.07 against 6,388.07 in 41150. Both are Monitor, not Exception, because the account mapping is probably wrong rather than the numbers. The correct accounts are still unknown.
- The PM Fee workbook's Yardi Report tab shows 2.25% and a posted fee of 20,502.58, while the calculation uses 2.5% and posts 22,786.57, a 2,283.99 difference. Needs checking against the management agreement.

**One item worth investigating, outside the rules**

The operating bank rec carries a 6/1 reconciling item of −53,964.00 for a Metropolitan Council deposit. The only similar credit on the bank statement is 53,696.00 on 7/1. That looks like a transposition.

**A worked example of the PM Fee adjustment trace**

Account 41155-000 in July contains a payable debit of 9,706.48 on 7/01 (Brothers MFG), a manual credit of 2,523.78 on 7/16 (Support Fee, control J-100880491), and a manual credit of 9,706.48 on 7/31 (FCF Entries, reversing the payable). Net account activity is −2,523.78. The PM Fee adjustment of 2,523.78 correctly matches only the 7/16 entry. This is the textbook case for the rule that a mixed charge-and-JE account must never be tied using the account total.

## State of the agent and the flow

**Agent:** *Accounting Manager Internal Review Agent* in Copilot Studio. Tools attached: the flow, a SharePoint MCP connector, and the two PDF prompts. The two prompt tools are currently set to *By agent*, which means the agent could decide to call them conversationally; they should be switched off or restricted, since the flow calls them internally.

**Flow:** *Validate Internal Review Packages — v1 Required File Validation*, published and running. Three text inputs: PropertyCode, ReviewPeriod, RequesterEmail. RequesterEmail maps to `System.User.Email`. Connections in use: Excel Online (Business), SharePoint, Dataverse, Microsoft Teams, AI Builder. There is a co-owner on the flow besides the owner.

Structure: the flow answers the agent first, then a single condition on the file-validation status gates everything else. Inside its True branch, in order: `Get Drive Id`, `Sources JSON`, one Have/Read pair per Excel source, one Have/Get/Read set per PDF, then the report creation steps, `Run Review`, and the Teams notification. Nothing is nested inside another condition, so a missing optional file skips only its own read.

**Naming matters more than it looks.** Expressions reference steps by name with spaces replaced by underscores, so `Filter - BSSS` becomes `Filter_-_BSSS`. Renaming steps mid-build caused most of the publish errors encountered. The current convention is `Filter BSSS`, `Filter TB`, `Filter GL`, `Filter T12`, `Filter BC`, `Filter BS`, `Filter BANKREC`, `Filter MORTGAGE`, with reads named `Read TB`, `Read BSSS` and so on, and the engine step named `Run Review`.

**Scripts live in SharePoint**, not OneDrive, in an `Internal Review Agent` folder alongside the report template. Scripts left in a personal OneDrive only work for their owner.

**Costs.** The Office Scripts, SharePoint steps and all the accounting arithmetic consume no AI capacity. The agent conversation consumes Copilot Credits, and the two PDF prompts consume credits on every run, priced per 1,000 tokens by model tier. The bank rec package is 18 pages, which dominates that cost; trimming the PDF to just the Bank Reconciliation Report pages would cut it materially and also improve accuracy. Seeded AI Builder credits in Power Platform licenses are being removed in November 2026, after which these calls draw on Copilot Credits. The exact per-run number is visible on the AI Builder Activity page in the admin centre after a run.

**Not yet built:** the Changes Since Last Review tab is empty, so the R1-versus-R2 comparison does not exist even though every finding already carries the `FindingKey` it needs. There is no portfolio-wide run; the flow reviews one property per request. The rules are still hardcoded in `defaultRuleset()` rather than read from a configuration list, and the `rulesetJson` parameter that would allow per-client rulesets is passed empty.

## Known defects and open decisions

These are unresolved as of the handover. The first three are correctness issues and should be fixed before anyone relies on the output more widely.

**1. The PM Fee rule numbers collide with the knowledge pack.** The controlled Rule Library defines PMF-01 as a missing fee file, PMF-02 as a hardcoded adjustment that does not tie, and PMF-10 as the fee-to-payable tie. Script 04 currently uses PMF-01 for base footing, PMF-02 for a typed-over base line, and PMF-04 for the fee-to-GL tie. Since the pack states that the Rule Library controls when wording conflicts, the agent will read a finding stamped PMF-02 and explain it as a different test entirely. The report template's own Rule Library tab has the same problem. Renumber in one direction; moving the code to match the controlled documents is the better choice unless reports are already circulating with the current IDs.

**2. The adjustment matcher ignores direction.** Script 04 matches an adjustment to a GL entry on absolute value, so an income addition supported by a *debit* would pass. Test PMF-T03 in the pack expects an exception for exactly this. The fix is small and known.

**3. Filename detection does not match the real filenames.** The accepted text in the File Detection Library was tested against the actual exports and fails on every one. Matching `pm fee` misses `07_2026_Yardi_PM_Fee_...` on the underscore, and the AME reports arrive with no separators at all: `AgedReceivables07_24_2026__1_.xlsx`, `PayablesAgingReport...`, `GrossPotentialRent...`. Stripping all non-alphanumeric characters from both the filename and the search term before comparing fixes all of them except the BSSS, which needs `bs support` alongside `balance sheet support`. This is silently producing missing-source exceptions.

**4. Nothing verifies the fee rate against the management agreement.** PMF-03 recomputes the fee using the rate typed into the workbook, so a wrong rate is self-consistent and passes. The only signal is the Monitor finding comparing it to the Yardi Report tab. Satisfying the pack's PMF-09 requires a per-property table of approved terms, which is the same configuration work the coverage table needs.

**5. The revenue spike threshold disagrees with the pack.** The controlled documents say 150% of the trailing average reported as a Warning. Script 04 uses 25% above the average plus a $50,000 floor, reported as an Exception. Both a threshold and a severity conflict. 150% is the documented number but is loose enough that a scanned insurance check on a large property could hide beneath it.

**6. The pack promises four controls the build does not have.** Method detection and PMF-11, income-statement double-count prevention (PMF-04), the omitted-JE test (PMF-05), and the spike driver listing (PMF-08). The first three depend on OneSite and Entrata, which are deferred, so they should be marked not-yet-implemented rather than left reading as live controls. Spike drivers could be built now, since the GL reader already returns all manual entries.

**7. The report has no PM Fee Review tab.** Workbook Standards specifies Calculation Summary, Adjustment Tie-Out, Revenue Trend, Spike Drivers and Manager Disposition sections. Template v1.2 has none of them, so PM Fee findings land in the generic tabs.

**8. Exact-amount matching cannot distinguish a qualifying JE from a reversal.** In the 41155 example above, an adjustment keyed as 9,706.48 would have matched the FCF reversal and passed. The evidence output should list every candidate JE in the account so a reviewer can judge.

**9. Unconfirmed configuration.** The coverage table saying which accounts require a BSSS schedule is still a draft built from one trial balance and is labelled DRAFT in the output. The depreciation accounts in the ruleset are a guess. The GPR concession and write-off account mappings are unknown.

**10. Script 04's later parameters are required, not optional.** `ameJson` and `pmFeeJson` must receive something; passing `[]` and an empty string respectively is the workaround when those steps have not been built yet.

## Gotchas

Things that cost time during the build and will cost it again if forgotten.

**Office Scripts will not open anything but a true .xlsx or .xlsm.** Yardi's older exports are HTML tables named `.xls` and fail. The fix is Save As in desktop Excel, or asking accountants to export as Excel.

**Array callbacks must be arrow functions.** Office Scripts rejects `.map(rowOf)` with a linting error; it has to be `.map(f => rowOf(f))`. This is not standard TypeScript behaviour and the error message is unhelpful.

**Never round a rate.** Rounding 0.0225 to two decimals gives 0.02, which silently turned a 2.25% rate into 2.00% in a finding. Rates need four decimals or none.

**Excel converts date text into serial numbers on write.** Writing `2026-05-01` into a findings column produced `46143`. Those columns must be formatted as text before the values are written.

**`getFormulas()` returns the literal value for a constant cell**, not an empty string. This is what makes the typed-versus-formula distinction work in the PM Fee reader.

**The AI Builder prompt step wants the prompt selected first.** Configuring the file parameter before choosing the prompt produces a confusing `item is not convertible to Object` error that looks like a data-shape problem but is not. Select the prompt, let the step reload, then set the value to `base64(body('Get_..._PDF'))`.

**PDF prompts must be told the date format.** Left alone, the model returns `7/24/2026`, which no ageing calculation can parse. The instruction has to say four-digit year, month, day, hyphenated.

**A rent roll cannot be totalled by summing its columns.** Several charge rows per unit means the sum double counts. Always take the report's own total row.

**Copilot Studio agent flows have no Save As.** Back up by exporting from the Flows list or the Power Automate portal, not from the flow's detail page.

**Running the rule engine by hand in Excel is not useful.** It takes fourteen parameters including five large JSON blobs. Only the readers are worth hand-testing.

**The agent's tool input list caches.** After adding a flow input, the flow has to be published before the agent's Tools panel will show it, and sometimes the tool has to be removed and re-added.

## Recommended next steps

In order, with reasoning.

**First, the three correctness fixes.** Renumber the PM Fee rules to match the controlled Rule Library, fix the direction check in the adjustment matcher, and normalize filename detection. These are defects, not scope, and each is small.

**Second, confirm the configuration that is still guesswork.** The BSSS coverage table, the depreciation accounts, the GPR concession and write-off mappings, and the fee rate against the management agreement. Every one of these is a place where the review currently either guesses or stays silent.

**Third, move the rules out of the script and into a configuration list.** A Ruleset column on the property directory, with thresholds, coverage and approved fee terms held as data. This is prerequisite work for OneSite and Entrata, for multiple clients' charts of accounts, and for the approved-terms check. It is also the mitigation for the worst silent failure available: running the wrong chart's rules against a property and passing it.

**Fourth, the R1-versus-R2 comparison.** Every finding already carries a FindingKey. Filling the Changes Since Last Review tab turns a re-review from a re-run into an answer to the question a manager actually asks, which is what got fixed and what is new.

**Fifth, decide the AME expansion as one piece of work.** Yardi AME readers exist; OneSite and Entrata do not. The open question that determines the approach is what format those packets arrive in. If they are Excel exports, they are two more reader scripts. If they are PDFs, they need the AI prompt path with deterministic footing checks, and the cost profile changes.

**Sixth, the changes that make this useful beyond one manager.** Letting accountants trigger their own review before submitting, so mechanical exceptions never reach a manager. Running a whole portfolio in one request with a ranked list back. Writing findings to a SharePoint list as well as the workbook, which gives an audit trail and lets Power BI show which findings recur by property, client or accountant.

**Alongside all of it, two non-technical items.** The solution should move into a managed solution with service-account connections rather than personal ones, which likely requires the internal AI intake process. And a time-per-review baseline should be recorded during the pilot, because someone will ask what this saves.
