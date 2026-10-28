# CLAUDE.md — Internal Review Agent

Owner: Rowena Chen (Senior Accounting Manager, Greystar). Co-builder: Thai Phan.
State as of 2026-09-25: working end to end for Yardi properties in a pilot; migrated from the Default environment to the company test environment.

## What this is

A Copilot Studio agent that runs a monthly manager-level review of a property's accounting package. The manager gives a property code and period. A Power Automate flow finds the files in SharePoint, runs the Office Scripts in this repo against them, writes an Excel findings report into the property's `Internal Review/Review Results` folder, and posts the result to Teams.

**This repo holds the part that does the accounting:** seven Office Scripts (TypeScript that runs inside Excel Online). The agent, flow, AI prompts and topics are built by hand in the Power Platform UI and cannot be changed from here. Their instructions live in `docs/`.

## The rule that matters most

**No language model does arithmetic or decides whether something ties.** Every accounting test is deterministic code in `scripts/`. A model is used for one job only: reading numbers off two PDFs (bank rec, mortgage statement) that Excel cannot open, and the engine re-foots whatever comes back before trusting it. Do not move any test into a prompt, a topic, or the agent. This is what makes the output defensible to an auditor.

## Layout

```
scripts/            The deployable Office Scripts. Paste each into Excel Online as-is.
  01_ReadTrialBalance.ts     reader
  02_ReadBSSS.ts             reader (Greystar BS Support Schedule, .xlsm)
  03_ReadYardiFinancial.ts   reader, used 3x: T12, Budget Comparison, Balance Sheet
  04_RunInternalReview.ts    THE RULE ENGINE. Runs every test, writes the report.
  05_ReadGeneralLedger.ts    reader
  06_ReadAMEReport.ts        reader, used 5x: Yardi AME subledger reports
  07_ReadPMFee.ts            reader (PM Fee workbook, .xlsm)
types/excelscript.d.ts   Minimal stub of the ExcelScript API. Only what the scripts call.
test/harness.js          Mock Excel workbook for Node. Loads compiled scripts from build/.
test/tests.js            109 tests: pass and deliberately-broken cases per rule, report layout checks, and a golden run.
test/runall.js           Full calibration run against the 610 West packet.
test/fixtures/*.json     The calibration workbooks as JSON (values, offsets, formulas).
tools/build.js           Compiles each script separately into build/<name>/s.js
tools/lint.js            Office Scripts rules plain tsc does not catch
tools/dump_fixtures.py   Regenerates fixtures from calibration/ (needs openpyxl)
tools/make_sample.py     Rebuilds the sample report from a calibration run
tools/build_template.py  Builds report template v2.0. Its layout is a contract with script 04's writer.
prompts/                 The two PDF prompts (text + JSON schema)
template/                Report template v2.0 (built by tools/build_template.py), v1.2 kept for reference, and the SAMPLE report (answer key)
calibration/610West_07-2026/   Real source files. Contains real client bank data; do not commit publicly.
calibration/Shiloh_09-2026/    Second calibration property (rpresshi, CBRE Yardi c6us0871, CBRE chart). Real client data.
flow-export/             The published Validate Flow definition (backup and reference for flow instructions).
docs/                    BUILD_GUIDE, TAKEOVER, TOPICS_REBUILD_GUIDE, knowledge pack, prior handoffs
TASKS.md                 Prioritized backlog with acceptance criteria
```

## Commands

```
npm install          # typescript
npm test             # build + lint + 109 tests. Must end "109 passed, 0 failed".
npm run calibrate    # full 610 West run; prints the summary; writes build/filled.json
python tools/make_sample.py        # after calibrate: rebuild the sample report
python tools/dump_fixtures.py      # after changing a calibration file: rebuild fixtures (--shiloh for the second packet)
```

**Definition of done for any change to scripts/:** `npm test` passes, the golden test still says 3 / 44 / 58 / 85 (or the change explains exactly which findings moved and why, and the golden values are updated deliberately), and every rule you touched has both a passing and a failing test.

## How the pieces connect

- A script can only see the workbook it runs against. So every source file gets a **reader** that returns a JSON summary, and **script 04** runs against a fresh copy of the report template, receives all readers' JSON as string parameters, and writes the findings. Source files are never modified.
- `main()`'s parameters become the flow step's input boxes; its return value becomes the step's output. **Changing a `main()` signature breaks the deployed flow** until someone re-picks the script in that flow step. Say so in the change notes whenever you do it.
- Script 04's signature, in order: `propertyCode, reviewPeriod, reviewAttempt, submissionType, reportFileName, sourcesJson, tbJson, bsssJson, t12Json, bcJson, bsJson, glJson, bankRecJson, mortgageJson, ameJson, pmFeeJson, rulesetJson?`. Blank string means "source not provided"; the engine skips that source's tests rather than failing.
- Script 04 recognises each reader's result by a list it always carries (`rows`, `accounts`, `issues`) and also finds it inside the flow's `{"result": ...}` wrapper. Anything else passed into a box (`[]`, `{}`, text) becomes an SRC-03 Warning naming the box, never a crash: one bad box must not lose the whole review (flprereg 08-2026 R2 did).
- Every finding carries a `FindingKey` = `property|period|ruleId|item`. It is stable across runs so an R1-vs-R2 comparison can join on it. Don't put amounts or timestamps in it.
- Thresholds, account ranges and mappings live in `defaultRuleset()` at the bottom of script 04. `rulesetJson` can override it but the flow currently passes it empty.

## Office Scripts constraints (each one cost time)

- Each script is one standalone file: `function main(workbook: ExcelScript.Workbook, ...)`, helpers in the same file, no imports, no npm libraries.
- **Array callbacks must be arrow functions.** `.map(rowOf)` is rejected by Excel Online; write `.map(f => rowOf(f))`. `npm run lint` checks this.
- No `any`. Every interface used in `main`'s signature or return type must be declared in that file.
- Only true `.xlsx`/`.xlsm` open. Yardi's older `.xls` exports are HTML tables and fail.
- `getFormulas()` returns the formula text for formula cells and **the literal value for constants** (not empty). Script 07 relies on this to tell a typed number from a formula.
- Excel turns date-looking text into serial numbers on write (`2026-05-01` became `46143`). Format columns as text (`"@"`) before writing dates.
- **Never round a rate with `r2`.** `r2(0.0225)` is `0.02`; that shipped once as "2.00%". Use `r4` or leave rates unrounded.
- Office Scripts called from a flow have a runtime limit. The GL reader handles ~10,000 rows by returning summaries, not detail; keep script outputs small.
- If you call an ExcelScript method not already used, add it to `types/excelscript.d.ts` AND mock it in `test/harness.js`, or the build/test will not reflect reality.
- The harness is a mock, not Excel. It proves logic, not Excel Online behaviour. Anything touching new ExcelScript APIs, formatting or tables must also be run by hand in Excel Online.

## The report (template v2.0)

Built by `tools/build_template.py`; that script and the writer at the bottom of script 04 share a layout contract (tab names, table names, header rows, Executive Summary cell positions). Change both together, then run `python tools/dump_fixtures.py --template` so the tests use the new layout.

- **Tabs by review area**, not by status: BSSS, Bank Rec, T12, Budget Comparison, General Ledger, PM Fee, Other Controls. `areaOf()` in script 04 maps each finding's category to one area; anything unlisted lands in Other Controls. Each tab lists Exceptions, then Warnings, Monitor, Pass. Source findings sit under the grid on Source Validation. All Results holds everything, with a Review Area column.
- **Column order** puts what a manager reads first on screen: Status, Account / Item, Finding, Required Action, then the numbers, sources and Test Performed. Rule ID, Result ID, Property Code and Review Period are hidden, not deleted: the tooling and the Executive Summary formulas use Rule ID.
- **Executive Summary**: header, a blank Manager Decision dropdown (D8) and four counts (formulas over All Results), a Review Areas table (formulas), a BSSS section (Ties / Does Not Tie / Missing Information / Supported Elsewhere as formulas over the BSSS tab, plus up to 10 accounts needing attention written by the engine), and a Bank Reconciliations section written by the engine, one row per rec.
- **Bank rec status**: Clean when nothing is outstanding over 30 days; Monitor 31–60; Warning over 60; Exception over 90 or when the rec does not tie or its PDF does not foot. The owner defined Clean, Warning and Exception; Monitor for 31–60 was added to close the gap between them and should be confirmed with her.

## Accounting design decisions (don't undo without a reason)

- **The review never decides readiness.** It reports findings and counts; Ready for Release / Ready With Comments / Not Ready is the manager's call, made in the Manager Decision dropdown (Executive Summary D8, Review History column D). The engine leaves both blank, `overallStatus` is only `REVIEW COMPLETE` or `NOT STARTED`, and the Teams summary ends "Awaiting manager decision." Don't reintroduce a computed verdict in the script, the template formulas, the agent or the topics.

- **Read identity from inside the file**, not the filename. Every reader returns property code and period from the report header; a file for the wrong property or month is an Exception and its tests are skipped.
- **Client-owned Yardi codes.** Some clients' Yardi uses their own property code (rpresshi's reports all say c6us0871). The flow passes `propertyCode` as `ourcode,clientcode` from the site tracker's `ClientYardiCode` column; the first code names the report, findings and FindingKeys, and a file carrying any listed code is the right property (`isOurs()` in script 04). No signature change.
- **Mismatched code or period is confirmed by the manager, not assumed.** The flow peeks at the TB header before answering the agent (BUILD_GUIDE 6A-2); on a mismatch the agent asks, and on yes re-calls the flow with `AcceptedCode`/`AcceptedPeriod`. Script 04 then gets `propertyCode` = `ourcode,acceptedcode` and `reviewPeriod` = `requested,accepted`: the first of each names the report, findings and keys; `isOurs()`/`isOurPeriod()` accept files carrying any listed value; ageing, posting-period, DEBT-04 and the fee trailing months run on `acctPeriod` (the accepted one). SRC-04 (Reviewed / Monitor) records who accepted it and when, from the flow's CONFIRMATION entry in sourcesJson. No signature change.
- **Never stop at the first exception.** One problem must not hide another.
- **Compare money at two decimals.** 5,981.985 vs 5,981.99 passes; a real $0.01 difference fails.
- **Take report totals, never sum detail rows.** A Yardi rent roll prints several charge rows per unit; summing market rent gives 1,117,548 where the report's own total is 1,061,771.
- **GPR has two market rent totals.** 1,057,096 (revenue units) and 1,061,771 (including 2 model units). Only the grand total matches the GL. The rent roll cross-check (AME-03) catches use of the wrong one.
- **Security deposits:** deposits on hand + the delinquent deposits column = deposit liability (23030 + 23045). That reconciling item is expected and reported as a pass with the explanation. Deposits on hand is never tied to the rent roll deposit figure; they differ by refunds pending.
- **GL "manual" means `J-` control numbers only.** `C-` resident charges, `R-` receipts, `P-` payables, `K-` invoices come from subledgers. Counting them produced 670 meaningless flags.
- **PM Fee: typed vs formula is the whole test.** A fee base line should be a SUMIFS off the Yardi Report tab; a typed base line is an Exception. An adjustment is typed by design, meaning the income arrived as a journal entry rather than a resident charge, and it must match a specific manual JE in the GL account it names. Never tie an adjustment to an account total: 41155-000 in July holds a 9,706.48 payable debit, the qualifying 2,523.78 JE credit, and a 9,706.48 FCF reversal.
- **Bank recs: one PDF or one per account.** 610 West sends one combined package; Presidium Regal (flprereg) sends an OP and an SD PDF. The flow reads every bank rec PDF in a loop and passes a list of prompt responses; `recsFrom()` in script 04 merges them. Several bank rec files that were all read are Found, not Multiple Versions. Two recs landing on the same TB cash account is CASH-06 (Exception); a cash account with none is CASH-04.
- **PDF numbers are verified before use.** CASH-00: subtotals must foot to the reconciled balance (Exception if not). Each section's lines must add to that section's subtotal (Warning naming the section; the tie-out still stands, only ageing is incomplete).
- **Accrual clear-down (ACCR-01):** the prior accrual must reverse to exactly $0.00 before the new accrual posts.

## Calibration: 610 West (mn610wes), 07-2026

Golden result: `3 exceptions, 44 warnings, 58 monitor, 85 passed`.

All three exceptions are real: the Balance Sheet in the folder was exported before a late entry (22010 at 112,327.91 vs TB 85,745.35; current year earnings 26,582.56 short), which fires BS-01 and BS-02; and a 5/1 American Bankers reconciling item of −1,402.22 on the operating bank rec is 91 days old. Eight more bank rec items aged 31–60 days show as Monitor. Everything else ties exactly, including all 22 BSSS schedules, AR 132,014.96, prepaid −25,733.24, AP 76,728.90, market rent 1,061,771, mortgage principal 77,830,000, both bank recs (284,746.15 and 353,796.91), all 210 GL sections, and the PM fee (base 911,225.84, fee 22,786.57 at 2.5% = 61030 expense = 22005 accrual). Full list in `docs/TAKEOVER.md`.

Open questions from this packet (need the owner, not code): GPR concessions/write-off account mapping (reads 540.77 vs 589.55, 6,458.07 vs 6,388.07); PM Fee workbook's Yardi Report tab says 2.25% while the calculation uses 2.5%; a 6/1 bank rec item of −53,964.00 vs a 53,696.00 bank credit looks transposed.

## Calibration: Residences at Shiloh Crossing (rpresshi), 09-2026, CBRE chart

Golden result (no bank rec, no AME): `2 exceptions, 8 warnings, 17 monitor, 17 passed`, run as `rpresshi,c6us0871`. The reports come from CBRE's Yardi (code c6us0871) on CBRE's chart (1510-2420 style). What it proves: the Balance Sheet (167 accounts), T12 and Budget Comparison tie to the TB on a 4-digit client chart; SRC-05 warns that Greystar's range-based tests did not test anything; an unreadable (income-based) fee workbook says so. The BSSS in the folder has the property code mistyped `c6us087a`, a real error, so its tests do not run; accepted as a third code, 48 schedules tie and 1610-1950 (allowance) is 0.20 off.

Lessons from it, now in the code: report headings can sit several rows above the first account (`03` looks 10 rows back); CBRE marks totals in the name ("Land Total"); account class comes from the leading digit (`liabEquity`, `incomeStmt`), not Greystar's 20000/40000 boundaries; the T12/BC staleness ties compare amounts, because which sign a line prints with depends on the client's tree; a bank rec whose PDF read does not foot is not aged (the prompt read Shiloh's "Cleared" sections as outstanding in one run and not another). Still Greystar-only until T5: every range in `defaultRuleset()` (cash, BSSS coverage, AR/AP Other, accruals `22`, utilities, contracts, trends, major expenses, fee accounts).

## Controlled documents

`docs/knowledge-pack/` holds the owner's controlled specs (Rule Library, PM Fee spec, GL spec, etc.). The pack states the **Rule Library wins** when wording conflicts. The code and the pack currently disagree in several places, listed in TASKS.md. When they conflict, do not silently pick one: flag it, and default to the controlled document unless the owner says otherwise. The owner spells the third system "Entrada"; the product is **Entrata**.

## What is out of reach from this repo

The flow, the agent, the two AI prompts and the 13 topics are UI-built. Changes there go in `docs/` as step-by-step instructions the owner can follow; she wants them fool-proof and in plain language. Step names in the flow matter: expressions reference steps by name with spaces as underscores (`Read TB` → `Read_TB`).

## Working with the owner

Rowena prefers concise answers, prose over bullets, plain-language explanations of architecture, and build guides written so anyone can follow them. She is an accountant, not a developer: explain the accounting consequence of a change, not just the code.
