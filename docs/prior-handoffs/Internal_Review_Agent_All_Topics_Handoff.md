# Accounting Manager Internal Review Agent
## Copilot Studio Topics Handoff

**Prepared for:** Claude/Fable or the next Copilot Studio builder  
**Owner:** Rowena Chen  
**Version:** 2.1  
**Date:** September 25, 2026  
**Project:** Accounting Manager Internal Review Agent  
**Current scope:** Source validation, manager-level accounting review, General Ledger Review, and Property Management Fee Review

---

# 1. Purpose of This Handoff

This document consolidates every Copilot Studio conversation topic created for the Accounting Manager Internal Review Agent and explains how the topic set should work together.

The existing topic suite was created to:

- Start an Internal Review without help questions accidentally restarting intake.
- Collect property code and review period in a controlled format.
- Explain the agent and the monthly review process.
- Explain required files, conditional files, and source-validation results.
- Explain Pass, Warning, Exception, and Reviewed/Monitor statuses.
- Explain specific accounting review rules by review area.
- Explain the generated review workbook.
- Explain R1, R2, R3+, Resolved, Unresolved, and New findings.
- Route users back to the review action without duplicating business logic inside topics.

The build tracker confirms the following topics were completed and tested in the original foundation:

1. Start Internal Review
2. Required Files
3. Review Status Definitions
4. Explain Review Rules
5. Internal Review Process
6. Review Attempts and Re-Review Logic
7. Source Validation
8. Review Report Structure
9. Agent Overview

Two cross-topic capabilities are also required:

10. Help / Topic Navigation
11. Error and Unsupported Request Handling

The current knowledge update also requires the topic suite to recognize and explain:

12. General Ledger Review
13. Property Management Fee Review

---

# 2. Agent Boundary

The agent is a manager-level monthly review assistant. It is not intended to replace the Property Accountant's complete detailed review.

The normal process is:

```text
Accountant completes month-end work
→ Accountant saves the required files in the monthly Internal Review folder
→ Manager starts the agent
→ Manager enters PropertyCode and ReviewPeriod
→ Agent Flow locates the property site and period folder
→ Flow validates the package
→ Review engine applies approved accounting rules
→ Report is saved under Review Results
→ Agent returns the result and report location
```

The existing design passes `PropertyCodeList` and `ReviewPeriod` from the intake topic to the workflow. The workflow then locates the site, constructs the monthly path, applies filename-detection rules, validates the package, creates structured findings, determines the review attempt, and generates one workbook per property.

## V1 guardrails

- No Accrual Review module.
- Do not alter source files.
- Do not post journal entries.
- Do not fabricate missing values.
- Do not default to another property when a lookup fails.
- Do not present the agent as controller certification.
- Do not use the agent to score or rank employees.
- Business calculations must remain in the deterministic review engine, not in free-form topic messages.

---

# 3. Shared Variables and Data Contract

## Conversation variables

| Variable | Type | Purpose |
|---|---|---|
| `PropertyCodeList` | String or list | One or more Yardi/property codes, preferably one code per line. |
| `ReviewPeriod` | String | Required format `MM-YYYY`. |
| `SelectedHelpTopic` | Choice/String | User's selected explanation area. |
| `ReviewArea` | Choice/String | Selected accounting rule area. |
| `ConfirmRun` | Boolean | Final confirmation before invoking the workflow, if retained. |

## Workflow inputs

```text
PropertyCodeList
ReviewPeriod
```

## Recommended workflow outputs

```text
RunStatus
PropertyCode
ReviewPeriod
ReviewAttempt
SourceValidationStatus
OverallStatus
ExceptionCount
WarningCount
ReviewedMonitorCount
PassCount
SummaryText
ReportLink
ErrorCode
ErrorMessage
```

Do not require each informational topic to calculate these values. Informational topics should explain them; the Agent Flow and review engine should produce them.

---

# 4. Topic Routing Map

```text
Conversation Start / Greeting
├── Start Internal Review
│   ├── Collect PropertyCodeList
│   ├── Collect ReviewPeriod
│   ├── Validate input format
│   ├── Call Validate Internal Review Packages / review flow
│   └── Present result
├── Help / Topic Navigation
│   ├── Agent Overview
│   ├── Internal Review Process
│   ├── Required Files
│   ├── Source Validation
│   ├── Review Status Definitions
│   ├── Explain Review Rules
│   │   ├── BSSS
│   │   ├── General Ledger
│   │   ├── Cash / Bank Reconciliation
│   │   ├── Mortgage
│   │   ├── AR Other
│   │   ├── AP Other
│   │   ├── Major Expenses
│   │   ├── Utilities
│   │   ├── T12 Trends
│   │   ├── Recurring Contracts
│   │   └── PM Fee
│   ├── Review Report Structure
│   └── Review Attempts and Re-Review Logic
└── Error / Unsupported Request Handling
```

---

# 5. Topic 1: Start Internal Review

## Purpose

This is the primary action topic. It collects the property code or codes and the review period, invokes the workflow, and presents the controlled result.

## Suggested topic name

```text
Start Internal Review
```

## Suggested trigger phrases

```text
start internal review
run internal review
review property financials
run the monthly review
property is ready for review
run review for a property
review these properties
start property review
```

Do not use broad trigger phrases such as `help`, `what can you do`, `required files`, or `review rules`. The original trigger was tightened specifically so help questions would not restart the review intake.

## Conversation flow

### Step 1: Introductory message

```text
I can run the Accounting Manager Internal Review for one or more properties.

Please enter the property code or codes. If you are submitting more than one property, enter one code per line.
```

### Step 2: Collect `PropertyCodeList`

Validation:

- Must not be blank.
- Trim leading and trailing spaces.
- Preserve one code per line.
- Do not replace the property code with the property name.
- Do not assume a partial or similar result is the intended property.

Invalid response:

```text
I need at least one property code to start the review. Enter one property code per line.
```

### Step 3: Collect `ReviewPeriod`

Prompt:

```text
What period should I review? Enter the period as MM-YYYY, for example 07-2026.
```

Validation:

- Two-digit month.
- Hyphen.
- Four-digit year.
- Valid month `01` through `12`.

Invalid response:

```text
Enter the review period as MM-YYYY, for example 07-2026.
```

### Step 4: Optional confirmation

```text
I will run the Internal Review for:

Property code(s): {PropertyCodeList}
Review period: {ReviewPeriod}

Would you like me to continue?
```

If minimizing turns is preferred, omit confirmation and invoke the workflow immediately after validation.

### Step 5: Call Agent Flow

Call the current validated workflow. The flow must use YardiCode/property code for site lookup and ReviewPeriod for monthly folder resolution.

### Step 6: Present results

Success response:

```text
Internal Review complete.

Property: {PropertyCode}
Period: {ReviewPeriod}
Review attempt: {ReviewAttempt}
Source validation: {SourceValidationStatus}
Overall status: {OverallStatus}

Exceptions: {ExceptionCount}
Warnings: {WarningCount}
Reviewed / Monitor: {ReviewedMonitorCount}
Passed controls: {PassCount}

{SummaryText}

Report: {ReportLink}
```

For multiple properties, return one clearly separated result per property. Do not merge separate property findings into one workbook.

## Controlled errors

### Property not found

```text
I could not find a property site for {PropertyCode}. Confirm the property code in the Property Site Directory and try again. I did not substitute another property's site.
```

### Folder not found

```text
I found the property site, but I could not find the Internal Review folder for {ReviewPeriod}. Confirm the monthly folder and Internal Review subfolder exist, then try again.
```

### Required files missing

```text
The package is not ready for accounting review because one or more required files are missing. Review the Source Validation results, add the missing files, and run the review again.
```

### Multiple versions

```text
Multiple apparent current versions were found for one or more source types. Confirm the authoritative file, remove or archive superseded versions, and run the review again.
```

---

# 6. Topic 2: Agent Overview

## Purpose

Explain what the agent does, who uses it, and what it does not do.

## Trigger phrases

```text
what does this agent do
what is the internal review agent
agent overview
how can this agent help
what can you review
who should use this agent
```

## Suggested response

```text
The Accounting Manager Internal Review Agent performs a standardized manager-level review of a completed monthly property accounting package.

It can:
- Locate the property's monthly Internal Review folder from the property code and review period.
- Validate required and conditional source files.
- Apply approved accounting review rules.
- Classify results as Pass, Warning, Exception, or Reviewed / Monitor.
- Create one review workbook per property.
- Track R1, R2, R3, and later review attempts.

It does not replace the Property Accountant's detailed close review, change source files, or post journal entries.

You can say “start internal review” when a package is ready.
```

## Exit routing

Offer concise choices:

```text
Would you like to start a review, see the required files, or learn about the review rules?
```

---

# 7. Topic 3: Internal Review Process

## Purpose

Explain the end-to-end operating process.

## Trigger phrases

```text
internal review process
how does the review work
what is the review process
how do I prepare for review
what happens after the accountant is ready
```

## Suggested response

```text
The Internal Review process is:

1. The Property Accountant completes month-end work.
2. The accountant saves the current-period source files in:
   Documents > Accounting > YYYY > MM-Month > Internal Review
3. The Accounting Manager starts the agent and provides the property code and review period.
4. The flow locates the correct Teams-backed SharePoint site and period folder.
5. The flow validates required, conditional, missing, duplicate, wrong-property, and wrong-period sources.
6. The review engine applies the approved accounting rules and continues after any Exception.
7. The agent creates one report workbook for each property under Internal Review > Review Results.
8. The agent returns the overall status, finding counts, review attempt, summary, and report location.
9. If corrections are needed, the accountant replaces outdated support, the manager runs the review again, and the new report is identified as R2, R3, or later.
```

---

# 8. Topic 4: Required Files

## Purpose

Explain which files must be in the folder before the review begins.

## Trigger phrases

```text
required files
what files are required
what do I need for internal review
review package files
missing files
what reports should the accountant save
```

## Current source catalog

### Required sources

- Balance Sheet Support Schedule, BSSS
- Trial Balance, TB
- General Ledger Detail, GL
- T12 / 12 Month Statement
- Budget Comparison, BC
- PM Fee Calculation when the property is subject to a management fee calculation

### Conditional sources

- Bank Reconciliation when cash accounts exist
- Mortgage Statement when a mortgage liability exists

## Suggested response

```text
The standard review package requires:

- BSSS
- Trial Balance
- General Ledger Detail
- T12 / 12 Month Statement
- Budget Comparison
- PM Fee Calculation when a management fee calculation applies

Conditional sources:
- Bank Reconciliation when the property has cash accounts
- Mortgage Statement when the property has a mortgage liability

Use the working Excel version of the PM Fee calculation when possible because the review must distinguish formulas from hardcoded adjustment values.
```

## Important BSSS distinction

```text
A Balance Sheet and a Balance Sheet Support Schedule are different files. A plain Balance Sheet must not satisfy the BSSS requirement.
```

---

# 9. Topic 5: Source Validation

## Purpose

Explain what file validation checks and what each source status means.

## Trigger phrases

```text
source validation
file validation
how are files validated
why does it say missing
why does it say multiple versions
how does the agent identify files
```

## Suggested response

```text
Source Validation confirms that the review package contains the correct source types for the selected property and period.

The flow checks:
- The correct property site and monthly Internal Review folder.
- Approved filename aliases.
- Required and conditional document types.
- Missing sources.
- Multiple current versions.
- Property and period evidence when available.
- Whether a source is usable for the intended review.

Source results:
- FOUND: one usable current source was identified.
- MISSING: no usable source was identified.
- MULTIPLE VERSIONS: two or more apparent current versions require selection or cleanup.
- CONDITION NOT EVALUATED: a conditional file was found or not found, but the related TB condition has not been tested yet.
```

## Matching principles

- Case-insensitive.
- Treat spaces, underscores, and hyphens as equivalent separators.
- Use boundary-aware matching for short aliases such as TB, GL, and BC.
- Preserve original filenames in the report.
- Exclude generated Internal Review reports.
- Do not silently select a draft, old, prior, or archive version when a current file is present.

---

# 10. Topic 6: Review Status Definitions

## Purpose

Explain the finding classifications and overall package statuses.

## Trigger phrases

```text
what does exception mean
what does warning mean
what does pass mean
review status definitions
ready for release
ready with comments
not ready
reviewed monitor
```

## Finding statuses

### PASS

```text
The tested control met the approved rule and no action is required for that control.
```

### WARNING

```text
The item requires manager review or explanation but does not automatically prevent release.
```

### EXCEPTION

```text
The item requires correction or resolution before release.
```

### REVIEWED / MONITOR

```text
The item requires judgment, documentation, or continued visibility but is not automatically classified as an error.
```

### CONTROL

```text
The result identifies a control condition or calculation used by another test, such as determining a recurring pattern.
```

## Overall statuses

```text
READY FOR RELEASE
No Exceptions and no Warnings.

READY WITH COMMENTS
No Exceptions, but one or more Warnings or Reviewed / Monitor items exist.

NOT READY
One or more Exceptions exist.
```

---

# 11. Topic 7: Explain Review Rules

## Purpose

Provide guided review-area choices and explain approved rules without performing calculations inside the topic.

## Trigger phrases

```text
explain review rules
what does the agent review
review rules
accounting rules
how is the review calculated
explain a finding
```

## First response

```text
Which review area would you like explained?
```

Recommended choices:

- BSSS Tie-Out
- General Ledger Review
- Cash / Bank Reconciliation
- Mortgage Review
- AR Other
- AP Other
- Major Expenses
- Utilities
- T12 Trends
- Recurring Contracts
- PM Fee Review
- Status Definitions

## Rule explanations

### BSSS Tie-Out

```text
The agent compares supported BSSS ending balances with the corresponding Trial Balance balances. Exact tie-outs require a $0.00 difference at two decimals. A real $0.01 difference is an Exception.
```

### General Ledger Review

```text
The GL module provides transaction-level evidence for accounts flagged by the other review modules. Controlled checks can include duplicate-looking activity, approved coding-rule mismatches, expected reversal or reclassification follow-up, unusual account activity, and data-quality issues.

The agent must not claim a transaction is miscoded without an approved coding rule or corroborating evidence, and matching amounts alone are not enough to prove a duplicate.
```

### Cash / Bank Reconciliation

```text
The agent ties the bank reconciliation GL balance to Trial Balance cash at a $0.00 difference and reviews outstanding checks and other reconciling items older than 60 days.
```

### Mortgage Review

```text
The agent compares mortgage-statement principal with the Trial Balance mortgage liability. The approved tie-out requires a $0.00 difference.
```

### AR Other

```text
The agent identifies open AR Other items older than 30 days using the controlled aging rule.
```

### AP Other

```text
The agent identifies open AP Other items older than 30 days using the controlled aging rule.
```

### Major Expenses

```text
The agent reviews expected activity for major expenses such as mortgage interest, property tax, insurance, and management fees. Missing expected activity can be an Exception. A material change over 15% OR over $5,000 is a Warning under the current general rule.
```

### Utilities

```text
The agent reviews water, electric, gas, trash, and other approved utility accounts. A change over 20% is a Warning. Expected historical activity with a current-month amount of zero is an Exception.
```

### T12 Trends

```text
The agent reviews recurring activity, missing current-month activity, and material changes. Under the current general rule, a change over 15% OR over $5,000 is a Warning.
```

### Recurring Contracts

```text
A recurring pattern is activity in at least 6 of the prior 12 months. Missing current activity or a material change over 15% OR over $5,000 is flagged for review.
```

### PM Fee Review

```text
The agent identifies the PM Fee calculation method, reviews revenue, exclusions, hardcoded adjustments, fee terms, and the recorded payable or accrual.

For OneSite, Entrada, or Yardi Fee Pool charge-based methods, income entered through an accounting JE may need to be added because it was not entered through property charges. Examples can include garage income, cable income, ResLink/support-fee income, and bad debt recovery, subject to the PMA and approved rules.

For an income-statement method, posted income is generally already included in the fee base and must not be manually added again.

Every hardcoded adjustment must tie exactly to qualifying GL activity by account, period, amount, direction, and transaction source. For example, a $2,523.78 Bad Debt Recovery - JE addition requires a qualifying $2,523.78 current-period GL credit in the approved bad debt recovery account.

Current revenue at or above 150% of the trailing monthly average is a Warning. The agent returns the GL drivers and looks for unusual insurance checks, refund checks, rebates, settlements, or other receipts that may require approved inclusion, exclusion, or reversal treatment.
```

---

# 12. Topic 8: Review Report Structure

## Purpose

Explain the generated workbook and where to find different result types.

## Trigger phrases

```text
review report structure
what is in the report
what tabs are in the workbook
where are the exceptions
where is the GL review
where is the PM fee review
```

## Suggested response

```text
The agent creates one Excel review workbook per property under Internal Review > Review Results.

The controlled workbook includes:

1. Executive Summary
2. Exceptions
3. Warnings
4. Reviewed_Monitor
5. Passed Controls
6. Source Validation
7. GL Review
8. PM Fee Review
9. Changes Since Last Review
10. Review History
11. Rule Library

The Executive Summary shows the property, period, attempt, finding counts, and overall status. The GL Review tab contains account and transaction-level evidence. The PM Fee Review tab contains the calculation summary, hardcoded adjustment-to-GL tie-outs, revenue trend, spike drivers, and manager disposition.
```

## Naming standard

```text
<PropertyCode>_<MM.YYYY>_Internal_Review_R#.xlsx
```

Example:

```text
mn610wes_07.2026_Internal_Review_R1.xlsx
```

---

# 13. Topic 9: Review Attempts and Re-Review Logic

## Purpose

Explain how R1, R2, R3+, and changes since the prior review work.

## Trigger phrases

```text
review attempt
what is R1
what is R2
what does unresolved mean
what does resolved mean
what does new mean
how do I rerun the review
re-review logic
```

## Suggested response

```text
The first successful report for a property and period is R1. Each later successful re-review becomes R2, R3, or a later attempt.

When a new review is compared with the prior successful report:

- Resolved: a prior finding no longer appears.
- Unresolved: the same finding remains.
- New: the finding appears for the first time in the current attempt.
- Reviewed / Monitor: the item remains visible for judgment or follow-up without being treated as a correction-required error.

Before re-running, replace or remove superseded source files so the folder contains one authoritative current version of each source.
```

## Important attempt rule

The attempt number should increment only after successful report creation. Failed runs must not consume the next review attempt.

---

# 14. Topic 10: General Ledger Review

## Purpose

Provide a dedicated entry point for GL-specific questions while reusing the controlled General Ledger Review Specification.

## Trigger phrases

```text
GL review
general ledger review
GL scrub
review journal entries
duplicate entries
coding review
reversal review
```

## Suggested response

```text
General Ledger Review uses transaction detail as evidence for accounts identified by the other review modules.

The controlled GL checks may identify:
- Missing or unusable GL Detail.
- Duplicate-looking transactions based on a defined transaction signature.
- Coding mismatches against approved coding rules.
- Missing or incomplete expected reversals and reclassifications.
- Transactions explaining a BSSS, T12, cash, mortgage, utility, major-expense, recurring-contract, or PM Fee finding.
- Blank or nonnumeric GL data.

The GL module narrows review attention to specific accounts and transactions. It does not replace the accountant's complete GL scrub and does not post corrections.
```

## Follow-up choices

- Explain duplicate test
- Explain coding test
- Explain reversal test
- Explain PM Fee adjustment tie
- Start Internal Review

---

# 15. Topic 11: Property Management Fee Review

## Purpose

Provide a dedicated explanation of PM Fee methods, adjustments, spike review, and tie-outs.

## Trigger phrases

```text
PM fee review
management fee review
property management fee
PM fee adjustments
hardcoded adjustment
bad debt recovery adjustment
revenue spike
OneSite management fee
Entrada management fee
```

## Suggested response

```text
The PM Fee Review validates the calculation method, fee base, exclusions, hardcoded adjustments, fee rate or minimum, fee due, and recorded payable or accrual.

Supported methods include OneSite, Entrada, Yardi Fee Pool, and income-statement calculations.

Key controls:
- Hardcoded adjustments must tie exactly to qualifying GL transactions.
- Charge-based methods add only qualifying JE-only income that was not already captured through property charges.
- Income-statement methods must not add posted income a second time.
- When a GL account contains charges and JEs, only the qualifying JE transactions may support the adjustment. The total account balance must not be used as a shortcut.
- Current revenue at or above 150% of the trailing monthly average is flagged for review.
- The calculated fee must agree to the recorded payable or accrual at a $0.00 difference.

The final inclusion or exclusion of unusual revenue must follow the PMA, approved template rule, or controlled account mapping.
```

---

# 16. Topic 12: Help / Topic Navigation

## Purpose

Provide a stable help menu without triggering the Start Internal Review intake.

## Trigger phrases

```text
help
show help
what can I ask
show topics
menu
explain options
```

## Suggested response

```text
I can help with:

- Start Internal Review
- Agent Overview
- Internal Review Process
- Required Files
- Source Validation
- Review Status Definitions
- Review Rules
- General Ledger Review
- PM Fee Review
- Review Report Structure
- Review Attempts and Re-Review

Choose an option or ask a question in your own words.
```

Do not redirect `help` to Start Internal Review. This separation was an explicit fix in the original topic build.

---

# 17. Topic 13: Error and Unsupported Request Handling

## Purpose

Return useful, controlled responses when a request is outside scope or a workflow stage fails.

## Trigger phrases

Use fallback/system routing rather than broad authored triggers.

## Controlled messages

### Unsupported accounting action

```text
I can review the package and identify findings, but I cannot post, reverse, reclassify, or delete accounting entries. Review the report evidence and complete approved corrections through the accounting process.
```

### Missing evidence

```text
I do not have enough approved source evidence to reach that accounting conclusion. Add the applicable source file or document the manager's conclusion in the review report.
```

### PMA or client-specific rule not available

```text
The calculation requires a property- or client-specific term that is not available in the controlled rules. Review the approved PMA or client directive before deciding whether to include or exclude the item.
```

### Flow failure

```text
The review could not be completed. The failure occurred during {Stage}. Confirm the property code, review period, folder, file availability, and connection access, then try again. No successful review attempt was created.
```

### Ambiguous intent

```text
Would you like to start an Internal Review or learn about the review process and rules?
```

---

# 18. Topic Priority and Overlap Controls

## High-priority action routing

`Start Internal Review` should win only when the user clearly asks to run or start the review.

## Informational routing

Questions beginning with `what`, `why`, `how`, `explain`, `which files`, or `what does` should route to informational topics instead of the action topic.

## Avoid these broad action triggers

```text
review
internal review
files
status
rules
```

These terms are too broad by themselves and create topic collisions.

## Recommended disambiguation

When the model cannot distinguish action from explanation:

```text
Would you like me to run the Internal Review, or explain how the Internal Review works?
```

---

# 19. Knowledge Sources Required by the Topics

The current controlled package contains 12 DOCX files:

```text
01_Accounting_Manager_Internal_Review_Agent_Overview_v2.1.docx
02_Internal_Review_Agent_FRD_v2.1.docx
03_Internal_Review_Rule_Library_v2.1_GL_PM_Fee.docx
04_Property_Management_Fee_Review_Specification_v1.0.docx
05_General_Ledger_Review_Specification_v2.1_PM_Fee.docx
06_Internal_Review_File_Detection_Library_v2.1_PM_Fee.docx
07_Internal_Review_Property_Folder_Standards_v2.1.docx
08_Internal_Review_Finding_Catalog_v2.1_PM_Fee.docx
09_Internal_Review_Workbook_Standards_v2.1_PM_Fee.docx
10_Internal_Review_Agent_Test_Scenarios_v2.1_PM_Fee.docx
11_Internal_Review_Agent_Build_Tracker_v2.1_GL_PM_Fee.docx
12_Copilot_Studio_Agent_Instructions_v2.1_PM_Fee.docx
```

## Controlling-source order

When knowledge wording conflicts:

1. Rule Library
2. Module Specification, GL or PM Fee
3. Functional Requirements
4. File Detection Library
5. Finding Catalog
6. Workbook Standards
7. Agent Instructions
8. Overview and Build Tracker

Topics should summarize these documents. Topics must not create new thresholds independently.

---

# 20. Topic Test Matrix

| Test | User utterance | Expected topic |
|---|---|---|
| TOP-01 | Start internal review | Start Internal Review |
| TOP-02 | What files are required? | Required Files |
| TOP-03 | What does Exception mean? | Review Status Definitions |
| TOP-04 | Explain the BSSS rule | Explain Review Rules, BSSS |
| TOP-05 | What happens during source validation? | Source Validation |
| TOP-06 | How do I rerun after corrections? | Review Attempts and Re-Review |
| TOP-07 | What tabs are in the report? | Review Report Structure |
| TOP-08 | What does this agent do? | Agent Overview |
| TOP-09 | Explain the entire process | Internal Review Process |
| TOP-10 | Review the GL | Disambiguate action vs GL explanation if property/period are absent |
| TOP-11 | Explain duplicate-looking GL activity | General Ledger Review |
| TOP-12 | How are PM Fee adjustments checked? | PM Fee Review |
| TOP-13 | Run a review and then mention status | Complete action before routing to informational topic |
| TOP-14 | Help | Help / Topic Navigation, not Start Internal Review |
| TOP-15 | Post the correcting JE | Unsupported Request Handling |
| TOP-16 | Review period 7/26 | Ask for `MM-YYYY`; do not silently normalize unless an approved normalization step exists |
| TOP-17 | Property name only | Ask for property code; do not substitute based on approximate name |
| TOP-18 | Multiple property codes on separate lines | Start Internal Review and preserve all codes |

---

# 21. Current State and What Is Next

## Completed

- Agent shell.
- Property code and review-period intake.
- Trigger separation so help questions do not restart intake.
- Original nine informational/action topics.
- SharePoint property-site lookup.
- Dynamic monthly Internal Review folder retrieval.
- Required-file validation.
- Formatted package-status response.
- GL and PM Fee knowledge framework.

## Topic work still needed

1. Add PM Fee to Required Files and Source Validation topic messages.
2. Add the dedicated General Ledger Review topic if not already separated from Explain Review Rules.
3. Add the dedicated PM Fee Review topic.
4. Update Review Report Structure to include GL Review and PM Fee Review tabs.
5. Confirm Start Internal Review displays PM Fee source results when applicable.
6. Add controlled responses for `PMF-01` through `PMF-10` findings.
7. Regression-test every trigger after adding GL and PM Fee phrases.
8. Confirm informational questions never invoke the flow.
9. Confirm workflow action requests are not trapped in informational topics.
10. Confirm failed runs do not create or increment a review attempt.

---

# 22. Recommended Build Sequence for the Next Builder

1. Export or document the current topic YAML before changing triggers.
2. Compare the live topic list with Sections 5 through 17 of this handoff.
3. Preserve the existing Start Internal Review action topic.
4. Add the General Ledger Review topic.
5. Add the Property Management Fee Review topic.
6. Update Required Files, Source Validation, Explain Review Rules, and Review Report Structure.
7. Add Error and Unsupported Request Handling if the current fallback is generic.
8. Run the Topic Test Matrix.
9. Run one valid review and one controlled failure.
10. Publish only after topic routing and flow invocation both pass.

---

# 23. Definition of Done

The topic suite is ready when:

- Users can ask for help without starting intake.
- Users can start a review using one or more property codes and one period.
- Invalid property/period input receives controlled correction prompts.
- Required Files includes GL and PM Fee when applicable.
- Source Validation explains missing, found, multiple, and conditional results.
- GL and PM Fee questions route to the correct dedicated topic.
- Every review status is explained consistently.
- Report Structure reflects the current workbook tabs.
- Re-review language consistently explains R1, R2, R3+, New, Unresolved, and Resolved.
- Informational topics do not independently calculate accounting results.
- Unsupported posting or correction requests are safely redirected.
- All topic triggers pass regression testing without collisions.

---

# 24. Final Handoff Note

The live working flow is the stable infrastructure baseline. Do not rebuild the property lookup, site lookup, folder retrieval, or required-file validation merely to extend the topics. The topics are the conversational front end. The Agent Flow is the orchestration layer. The accounting engine must remain the deterministic source of calculated findings, and the controlled knowledge files must remain the source of rule explanations.
