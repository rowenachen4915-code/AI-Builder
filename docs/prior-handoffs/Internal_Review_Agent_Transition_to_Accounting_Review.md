# Internal Review Agent Transition Handoff

## Purpose

This handoff begins after the **Validate Internal Review Packages** Agent Flow was repaired and required-file validation was confirmed working with help from Thai Phan's Claude/Fable session.

The next objective is to move from **package validation** into the **actual accounting review engine** while preserving the working validation flow as the baseline.

---

## Current Working State

### Agent inputs

The Copilot Studio agent collects and passes:

- `PropertyCode`
- `ReviewPeriod`

Example pilot input:

```text
PropertyCode: mn610wes
ReviewPeriod: 07-2026
```

### Property-site lookup

The flow uses the Excel table:

```text
PropertySiteDirectory
```

in:

```text
Active_Property_Site_Tracker_for_Internal_Review.xlsx
```

Lookup key:

```text
YardiCode
```

Important rule:

- Match using `YardiCode`, not property name.
- Property/accounting names can change.
- Never default to another property's site when no match is found.

### SharePoint retrieval

The flow successfully:

1. Filters the directory by `YardiCode`.
2. Retrieves the applicable `FlowSiteURL`.
3. Uses the dynamic site address in SharePoint.
4. Uses library name `Documents`.
5. Reaches the applicable Internal Review folder.
6. Retrieves the files in that folder.

### Required-file validation

The flow now returns a formatted validation summary for:

- BSSS
- Trial Balance
- General Ledger
- T12
- Budget Comparison
- Mortgage Statement
- Bank Reconciliation

The first five are required. Mortgage Statement and Bank Reconciliation are conditional sources.

Working output format:

```text
Required File Validation

BSSS FOUND
TB FOUND
GL FOUND
T12 FOUND
BC FOUND
MORTGAGE FOUND
BANK REC FOUND

STATUS: REQUIRED FILES COMPLETE
```

### Filename aliases currently supported

#### BSSS

- `bsss`
- `bs support`
- `balance sheet support`

Do not treat a plain Balance Sheet or `BS` file as the BSSS. A Balance Sheet and a Balance Sheet Support Schedule are different documents.

#### Trial Balance

- `trial balance`
- `trial_balance`
- standalone `TB`

#### General Ledger

- `GL`
- `general_ledger`
- `general ledger`

#### T12

- `12_month_statement`
- `12 month statement`

#### Budget Comparison

- `BC`
- `budget_comparison`
- `budget comparison`

#### Mortgage Statement

- filename contains `mortgage`

#### Bank Reconciliation

- `bank rec`
- `bank reconciliation`

### Status logic

Required-file completeness is currently based on:

```text
BSSS + TB + GL + T12 + BC
```

Mortgage Statement and Bank Reconciliation should be displayed but must not automatically fail every property. They become required only when the relevant debt or cash condition is confirmed.

---

## Preserve This Baseline

Before restructuring the accounting review engine:

1. Keep the current flow published and working.
2. Do not delete the successful site-lookup, file-retrieval, filters, result Composes, summary Compose, or response action.
3. Record the current hardcoded pilot folder path and the successful pilot inputs.
4. If the interface supports solutions or component export, move the agent and flow into a solution before major expansion.
5. Make future changes one module at a time and retest the full required-file output after each structural change.

---

# Next Workstream 1: Finalize Source Validation

## 1. Make the Internal Review folder path dynamic

The flow must convert:

```text
ReviewPeriod = 07-2026
```

into:

```text
Shared Documents/Accounting/2026/07-July/Internal Review
```

The working SharePoint folder-path format has been confirmed to begin with:

```text
Shared Documents/Accounting
```

Do not include a leading slash unless testing proves the environment requires one.

### Required behavior

- Parse the month from the first two characters.
- Parse the year from the last four characters.
- Map month number to the exact SharePoint folder name.
- Construct the complete path.
- Pass that path to `Limit Entries to Folder`.
- Return a clear `INTERNAL REVIEW FOLDER NOT FOUND` result when the path does not exist.
- Do not fall back to the document-library root.

### Suggested implementation pattern

Use dedicated, clearly named actions:

```text
Compose - Normalized Review Period
Compose - Review Year
Compose - Review Month Number
Compose - Review Month Name
Compose - Internal Review Folder Path
```

Avoid one oversized expression until the helper outputs have been tested individually.

### Month mapping

```text
01 = January
02 = February
03 = March
04 = April
05 = May
06 = June
07 = July
08 = August
09 = September
10 = October
11 = November
12 = December
```

### Tests

- `01-2026` finds `01-January`.
- `07-2026` finds `07-July`.
- `12-2026` finds `12-December`.
- Invalid month returns a controlled validation message.
- Missing folder returns a controlled validation message.
- The file query remains folder-scoped and does not return the whole site.

---

## 2. Add negative required-file tests

The current pilot proved the FOUND path. Now prove the MISSING path.

Required scenarios:

1. Remove or rename the BSSS test file and confirm `BSSS MISSING`.
2. Remove or rename the TB test file and confirm `TB MISSING`.
3. Repeat for GL, T12, and BC.
4. Confirm any missing required source returns:

```text
STATUS: REQUIRED FILES MISSING
```

5. Confirm the flow still lists every file result rather than stopping at the first missing source.

---

## 3. Add duplicate-version detection

For each source type:

```text
0 matches = MISSING
1 match = FOUND
2 or more matches = MULTIPLE VERSIONS
```

Generated Internal Review reports must be excluded from source detection.

Do not automatically choose a file marked:

- draft
- old
- prior
- archive

when another apparent current version exists.

Return the original filenames in a controlled diagnostic output or result record, but avoid returning the entire raw SharePoint payload to the agent.

---

## 4. Validate property and period separately

Filename type detection alone is not enough.

Add checks for:

- The expected `PropertyCode` in filename or file metadata when available.
- The expected `ReviewPeriod` in filename or file metadata when available.
- A controlled warning when the document type matches but the property or period does not.

Do not reject a valid file solely because a filename lacks the code or period unless that requirement is formally approved. Instead, classify the match as requiring validation when the supporting evidence is insufficient.

---

## 5. Add conditional-source logic

### Bank Reconciliation

Required only when cash accounts exist.

### Mortgage Statement

Required only when a mortgage liability exists.

Until TB account detection is implemented, use a temporary status such as:

```text
BANK REC: FOUND / NOT FOUND - CONDITION NOT YET EVALUATED
MORTGAGE: FOUND / NOT FOUND - CONDITION NOT YET EVALUATED
```

Do not classify these as required-file failures for every property.

---

# Next Workstream 2: Prepare Files for Accounting Review

The existing SharePoint action returns metadata, not necessarily workbook cell data. The review engine needs a controlled method to read the actual Excel contents.

## Recommended engine pattern

Use deterministic Excel processing for calculations and use the agent for orchestration and explanation:

```text
Agent
→ Agent Flow
→ SharePoint file retrieval
→ File-content retrieval
→ Office Script or standardized workbook staging
→ Deterministic accounting tests
→ Structured findings
→ Report workbook
→ Agent summary
```

A prior technical discussion identified Office Scripts as a strong fit for deterministic workbook review, with the flow copying source data into standardized tabs and the script writing structured findings. citeturn311search15

## First technical spike

Prove the flow can:

1. Select the one matched BSSS source.
2. Select the one matched TB source.
3. Retrieve each file's content or workbook reference.
4. Open/process both files without altering the originals.
5. Return a small structured result.

Do not begin with all seven source types.

---

# Next Workstream 3: Build the First Accounting Module

## Start with BSSS vs Trial Balance tie-out

This is the recommended first accounting module because the required source files are already detected and the rule is deterministic.

### Objective

For each supported Balance Sheet Support Schedule account:

```text
BSSS ending balance
vs
Trial Balance ending balance
```

### Rule

```text
Difference must equal $0.00 at two decimals.
```

Any real `$0.01` difference is an Exception.

### Required output record

Each result should be stored as a structured record, not only as narrative text.

Minimum fields:

```text
ResultID
RuleID
PropertyCode
ReviewPeriod
ReviewAttempt
Category
AccountNumber
AccountName
Source1
Source2
SourceValue
ComparisonValue
Difference
Status
Finding
RequiredAction
```

### Example

```text
RuleID: BSSS-01
PropertyCode: mn610wes
ReviewPeriod: 07-2026
Category: BSSS
AccountNumber: 1110
SourceValue: 15000.00
ComparisonValue: 15000.01
Difference: -0.01
Status: EXCEPTION
Finding: BSSS does not tie to the Trial Balance.
RequiredAction: Correct the BSSS or Trial Balance support before release.
```

### Test cases

- Exact match = PASS.
- `$0.01` difference = EXCEPTION.
- Negative balance exact match = PASS.
- Account appears in BSSS but not TB = EXCEPTION.
- Account appears in TB but has no required supporting schedule = EXCEPTION or approved finding type.
- Duplicate account rows are aggregated or flagged according to the documented workbook rules.
- Blank/non-numeric values return a controlled data-quality finding rather than a flow crash.

---

# Next Workstream 4: Add Accounting Modules in Sequence

After BSSS-01 passes testing, add modules in this order:

1. **Cash Review**
   - Bank Rec GL balance vs TB cash.
   - Exact `$0.00` tie-out.
   - Outstanding checks over 60 days.
   - Other reconciling items over 60 days.

2. **Mortgage Review**
   - Mortgage statement principal vs TB liability.
   - Exact `$0.00` tie-out.

3. **AR Other Review**
   - Open items older than 30 days.

4. **AP Other Review**
   - Open items older than 30 days.

5. **Major Expense Review**
   - Mortgage interest, property tax, insurance, and management fee completeness.
   - Reasonableness threshold: over 15% OR over $5,000.

6. **Utility Review**
   - Current utility amount vs supported trend.
   - Change over 20% = Warning.
   - Expected activity with current month equal to zero = Exception.

7. **T12 Review**
   - Expected recurring activity.
   - Missing current activity.
   - Material change over 15% OR over $5,000.

8. **Recurring Contract Review**
   - Recurring pattern means activity in 6 or more of the prior 12 months.
   - Missing current activity = Warning.
   - Material change over 15% OR over $5,000 = Warning.

The agent is intended to provide a manager-level review covering BSSS tie-out, T12 trends, and major issues for manager judgment. citeturn311search11turn311search20

---

# Next Workstream 5: Continue After Exceptions

The engine must not stop after the first Exception.

Required behavior:

```text
Source Validation
→ BSSS Review
→ Cash Review
→ Mortgage Review
→ AR/AP Other
→ Major Expenses
→ Utilities
→ T12
→ Recurring Contracts
→ Final result set
```

The accountant should receive one complete correction list from the review run.

---

# Next Workstream 6: Generate the Review Workbook

Use the approved Internal Review report template.

Expected worksheets:

```text
Executive Summary
Exceptions
Warnings
Reviewed_Monitor
Passed Controls
Source Validation
Changes Since Last Review
Review History
Rule Library (hidden)
```

Populate Source Validation first, then add accounting findings as each module is completed.

Each property must receive a separate workbook.

Example filename:

```text
mn610wes_07.2026_Internal_Review_R1.xlsx
```

Save to:

```text
Internal Review/Review Results
```

Do not overwrite prior successful reports.

---

# Next Workstream 7: Review Attempt and Re-Review Logic

After initial workbook generation works:

```text
No prior successful report = R1
One prior successful report = R2
Two or more prior successful reports = R3+
```

Compare the current result set to the prior successful result set using a stable finding key.

Suggested finding key:

```text
PropertyCode + ReviewPeriod + RuleID + AccountNumber + normalized finding subject
```

Classify:

- Resolved
- Unresolved
- New
- Reviewed / Monitor

The review-number increment must occur only after successful report creation.

---

# Next Workstream 8: Add the Manual Upload Path

The final agent should support two intake methods:

```text
1. Review Property Folder
2. Upload Review Package
```

Both methods should feed the same validation and review engine.

For manual uploads, Copilot Studio can collect a File input and pass file name/content to an Agent Flow. Use this path after the folder-based review engine is stable so the same processing logic can be reused.

---

# Immediate Next Actions

Claude/Fable should begin with this exact sequence:

1. Preserve the current working required-file validation flow.
2. Replace the hardcoded month folder with a helper-based dynamic folder path.
3. Run January, July, and December folder tests.
4. Run missing-file tests for all five required sources.
5. Add duplicate-version detection.
6. Add controlled no-property/no-site/no-folder responses.
7. Confirm conditional treatment for Bank Rec and Mortgage.
8. Design the normalized BSSS and TB data structures.
9. Build the BSSS-vs-TB Office Script or deterministic comparison engine.
10. Return structured BSSS-01 records to the flow.
11. Populate Source Validation and BSSS findings into the report template.
12. Test exact match and `$0.01` failure.

---

# Definition of Done for the Next Milestone

The next milestone is complete when:

- The manager enters a valid `PropertyCode` and `ReviewPeriod`.
- The flow dynamically locates the correct period's Internal Review folder.
- The flow validates all required sources.
- Missing and duplicate sources return controlled results.
- The flow identifies the correct BSSS and TB files.
- The accounting engine compares supported BSSS balances to TB balances.
- Exact matches pass.
- A real one-cent difference fails.
- All BSSS findings are returned as structured records.
- The review continues across all BSSS accounts after a failure.
- Source Validation and BSSS findings are available for workbook population.

---

# Guardrails

- No Accrual Review module is included in Version 1.
- Do not alter source files.
- Do not post journal entries.
- Do not fabricate missing values.
- Do not use manager narrative as the source for accounting calculations.
- Keep calculations deterministic and auditable.
- Preserve original filenames in Source Validation results.
- Match property sites using YardiCode.
- Never default to another property's site or folder.
- Do not return the entire SharePoint raw payload to the agent.
- Continue reviewing after an Exception.
- Maintain exact-to-the-cent tie-out standards.

---

# Key Project Context

The intended business process is for accountants to save BSSS, T12, TB, BC, Bank Rec, and other required sources in the designated monthly Internal Review folder, notify the manager, and have the agent run the manager-level review. The agent should create a review report in the same property area and support a re-review after corrections. citeturn311search11

The project has also explored a deterministic implementation pattern using the agent as the front door, Power Automate as orchestration, and Office Scripts as the calculation engine for multi-workbook accounting checks. citeturn311search15

