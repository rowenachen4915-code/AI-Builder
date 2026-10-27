# TASKS — Internal Review Agent backlog

Ordered by priority. Each task says whether it changes a `main()` signature, because that breaks the deployed flow until the owner re-picks the script in that flow step. Anything marked **Flow / UI** can't be done from this repo: write the step-by-step instructions into `docs/` for the owner instead.

---

## P1 — Correctness (do first)

### T1. Renumber PM Fee rules to match the controlled Rule Library
**Why:** The knowledge pack (`docs/knowledge-pack/`, doc 03) defines PMF-01 as "PM Fee source missing", PMF-02 as "hardcoded adjustment does not tie to GL", PMF-10 as "fee does not agree to payable/accrual". Script 04 emits PMF-01 for base footing, PMF-02 for a typed-over base line, PMF-04 for fee-to-GL. The agent explains findings from the pack, so a finding stamped PMF-02 gets explained as the wrong test.
**Do:** Unzip the pack, read doc 03 and doc 07 (Finding Catalog), and build a mapping from each current PMF-0x in script 04 to the pack's ID. Tests that don't exist in the pack need new IDs agreed with the owner; don't reuse a pack ID for a different test.
**Decision needed:** Default is code follows the pack. Confirm with the owner before shipping in case reports are already circulating with the current IDs.
**Accept:** Every PMF ruleId emitted matches the pack's definition of that ID; the report template's Rule Library tab is updated to match; tests updated; golden counts unchanged.
**Signature change:** No.

### T2. Adjustment matcher must respect direction
**Why:** PMF-05 matches an adjustment to a GL manual entry by absolute value, so an income addition supported by a *debit* passes. Pack test PMF-T03 expects an Exception.
**Do:** In script 04, find `r2(Math.abs(m.amount)) === r2(Math.abs(a.amount))`. An income addition (positive adjustment) needs a credit (GL amount negative in this data: credits are stored as negative). A deduction needs a debit.
**Accept:** New test: 2,523.78 adjustment against a +2,523.78 debit in 41155 is an Exception; the real 610 West credit still passes; golden unchanged.
**Signature change:** No.

### T3. Filename detection fails on the real filenames — Flow / UI, plus a test
**Why:** The File Detection Library (doc 06) accepted-text values were tested against the actual exports and fail on every one. `pm fee` misses `07_2026_Yardi_PM_Fee_...` on the underscore. AME reports have no separators at all: `AgedReceivables07_24_2026__1_.xlsx`, `PayablesAgingReport...`, `GrossPotentialRent...`. This silently produces missing-source exceptions.
**Fix:** Strip every non-alphanumeric character from both the filename and the search term, lowercase both, then compare. BSSS also needs `bssupport` alongside `balancesheetsupport`. The Balance Sheet filter must exclude anything containing `support`.
**Do:** (a) Write `tools/detect.js` with the normalized matcher and a test over the real calibration filenames proving each maps to exactly one source type and nothing maps to two. (b) Write the equivalent Power Automate Filter array expressions into `docs/` (Power Automate has no regex; use nested `replace()` for `_ - . space` and `toLower()`).
**Accept:** Every file in `calibration/` classifies to the right type, generated review reports are excluded, and the doc gives paste-ready expressions.

### T4. Make trailing script 04 parameters optional
**Why:** `ameJson` and `pmFeeJson` are required, so the flow shows them as mandatory boxes even when those steps aren't built. The owner currently types `[]`.
**Do:** Make `ameJson?`, `pmFeeJson?` (and keep `rulesetJson?`). Optional parameters must come after all required ones, which they already do.
**Accept:** Tests pass with those arguments omitted entirely.
**Signature change:** **Yes.** Batch this with T1/T2 so the owner re-picks the script once.

---

## P2 — Configuration that is currently guesswork

### T5. Move rules out of the script into a ruleset
**Why:** Thresholds, the BSSS coverage table, account ranges, AME tie mappings, depreciation accounts and PM Fee terms are hardcoded in `defaultRuleset()`. Different clients use different charts of accounts. Running one chart's rules against another property's chart can pass it wrongly, which is the worst silent failure available.
**Do:** Define the `RuleSet` JSON schema (the interface already exists in script 04). Write `rulesets/greystar-yardi-base.json` from the current defaults. Validate a supplied ruleset on entry: unknown keys, missing keys, wrong types → a controlled Exception, not a crash. Add a guard: if more than N% of the TB's balance-sheet accounts fall outside the ruleset's coverage table, raise an Exception saying the ruleset probably doesn't match this chart.
**Flow / UI:** Owner adds a Ruleset column to the PropertySiteDirectory table and passes the JSON into `rulesetJson`. Write those instructions.
**Accept:** Golden run identical when the base ruleset is passed explicitly; wrong-chart guard has a test.

### T6. Approved fee terms (pack PMF-09)
**Why:** PMF-03 recalculates the fee using the rate typed in the workbook, so a wrong rate is self-consistent and passes. On 610 West the workbook's Yardi Report tab shows 2.25% while the calculation uses 2.5% (2,283.99 difference). Currently only a Monitor item.
**Do:** Add per-property approved terms (rate, minimum, maximum, method) to the ruleset/config. Rate in workbook ≠ approved rate → Exception.
**Blocked on:** the owner confirming 610 West's contract rate.

### T7. Spike threshold conflict
**Why:** Pack says revenue ≥150% of trailing average = Warning. Script uses +25% and >$50,000 = Exception.
**Do:** Make both bands configurable: e.g. Warning above one band, Exception above a higher one. Don't choose the numbers; the owner decides. Until then leave behaviour as is.

### T8. Unconfirmed mappings — needs owner input
BSSS coverage table (labelled DRAFT in output), depreciation accounts (`68010/68020/68030` are a guess), GPR concession and write-off accounts (don't tie on 610 West). Don't invent answers; list what's needed and ask.

---

## P3 — Features

### T9. PM Fee spike drivers (pack PMF-08)
When PMF spike fires, list the revenue-account manual JEs and largest receipts for the month from `gl.manual`, so the manager sees what caused it (typically an insurance or refund check scanned as a resident receipt).
**Accept:** Test with an injected spike shows the injected entry as a driver.

### T10. List candidate JEs as PMF-05 evidence
Exact-amount matching can't tell a qualifying JE from a reversal (41155 example in CLAUDE.md). Every PMF-05 finding should list all manual entries in the named account so the reviewer can judge.

### T11. R1 vs R2 comparison (Changes Since Last Review)
Every finding already has a stable FindingKey. Design: a new reader `08_ReadPriorReport.ts` reads the prior report's `All Results` table and returns the keys and statuses; script 04 takes it as a new optional parameter and writes Resolved / Unresolved / New to the Changes Since Last Review tab.
**Signature change:** Yes (new optional parameter). **Flow / UI:** add a step that finds the previous R-number report.

### T12. PM Fee Review tab sections
Template v2.0 has a PM Fee tab listing the PM Fee findings, but Workbook Standards (pack doc 08) also specifies Calculation Summary, Adjustment Tie-Out, Revenue Trend, Spike Drivers and Manager Disposition sections, which it lacks. Add them above the findings table in `tools/build_template.py`. Needs a template change and script 04 writing to it; create the sheet if missing so older templates still work.

### T13. Failed runs consume an attempt number — Flow / UI
The flow creates the report file before script 04 runs, and counts existing files to number the next attempt. A failed run leaves an empty file, so the next run skips a number. Options: have script 04 write a completion marker and count only completed reports, or add a flow step that deletes the file when Run Review fails ("Configure run after: has failed").

### T15. Bring the controlled documents in line with template v2.0 — needs the owner
Workbook Standards (pack doc 08), the Report Structure topic and the knowledge pack still describe the old status tabs (Exceptions, Warnings, Reviewed_Monitor, Passed Controls). Draft the replacement wording for her to approve; don't edit the controlled pack yourself.

### T16. Confirm the bank rec Monitor band — needs the owner
She defined Clean (nothing over 30 days), Warning (over 60) and Exception (over 90). Items aged 31–60 days are currently Monitor. Confirm that, or change `cashMonitorDays` / `cashWarningDays` / `cashExceptionDays`.

### T17. Flow follow-ups from the flprereg 08-2026 pilot — Flow / UI
Found while getting the second property running (2026-09-26/27). Each has step-by-step wording in the session notes; move it into BUILD_GUIDE / TOPICS_REBUILD_GUIDE as it is done.
- **Failure message:** a Teams step after Run Review set to run only when it "has failed / has timed out", so a failed review is never silent. Pairs with T13 (delete the blank report in the same branch).
- **Agent Note output:** only say "Review started" when Required Files Complete is true; otherwise "Review not started".
- **Period format:** written up in TOPICS_REBUILD_GUIDE section A step 3 (accepts 07-2026, 07/2026, 07.2026, July 2026, July 26; converts to 07-2026). Owner to build and test in Copilot Studio.
- **ACCESS DENIED vs FOLDER NOT FOUND:** the files check reported a 403 as FOLDER NOT FOUND, which cost several rounds.
- **Access model before rollout:** agent flows run on the connections saved in them (no run-only / end-user credentials). Agreed direction: the agent checks the manager can open the property's Internal Review folder (SharePoint tool, end-user auth) before calling the flow; the flow runs on a service account IT adds to every Accounting channel. Needs IT.
- **Client-owned Yardi codes (done in script 04, 2026-09-27):** owner to add the ClientYardiCode column to the tracker and change Run Review's propertyCode box (BUILD_GUIDE 6G).
- **SD bank rec PDF has no GL account on it,** so the rec is matched to 11040 by balance. Ask for the GL account to be printed on the rec.

---

## P4 — Blocked

### T14. OneSite and Entrata
Only Yardi AME readers and the Yardi Fee Pool PM Fee reader exist. The owner wants all three systems added together, not piecemeal. Blocked on sample files and on knowing whether their packets arrive as Excel or PDF (Excel means more reader scripts; PDF means the AI-prompt path with footing checks, which costs credits per run).
Design already agreed: financials are always Yardi; only the AME and PM Fee readers vary. The flow picks readers from an `AMESystem` column in the property directory, and each reader also reports the system it detected from the file itself; a mismatch is an Exception. Keep the rule engine system-agnostic: readers normalize to the shape `06_ReadAMEReport` already returns.
Rename `06_ReadAMEReport` to `06_ReadAMEReport_Yardi` when this starts.
