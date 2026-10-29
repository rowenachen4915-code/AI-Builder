# Internal Review Agent — Topics Rebuild Guide

Rebuilds the 13 topics in the test environment. Based on the topics handoff (v2.1, 25 Sep 2026), **corrected to match what the working flow and review engine actually do**. Where the handoff and the build disagree, this guide follows the build, and Part D lists every change so you can decide.

Build order: Part A once, then Part B (the only complex topic), then Part C (eleven simple ones), then Part E to test.

---

## Part A — How to build a simple message topic (used for 11 of the 13)

1. Agent → **Topics** → **+ Add a topic** → **From blank**.
2. Click the title at the top and rename it to the **Topic name** given below.
3. Click the **Trigger** node.
   - If it says **The agent chooses**, paste the **Description** into the description box.
   - If it shows **Phrases**, paste the **Trigger phrases**, one per line.
4. Click **+** under the trigger → **Send a message** → paste the **Message**.
5. Optional: to offer follow-up choices, add **Ask a question** → **Multiple choice options** and type the choices.
6. **Save**.

Faster alternative for any topic: after step 2, click **⋯ → Open code editor** on an existing working topic in the old environment, copy the YAML, and paste it into the new topic's code editor. Only re-point the flow action.

---

## Part B — Start Internal Review (the action topic)

This is the one that calls the flow. **The flow takes one property per run**, with three inputs: `PropertyCode`, `ReviewPeriod`, `RequesterEmail`. It answers straight away with the file-validation result and delivers the findings later by Teams. The topic must match that, not the older design in the handoff.

**Topic name:** `Start Internal Review`

**Description** (if The agent chooses):
`Starts the monthly Internal Review for one property. Use only when the user clearly asks to run, start or kick off a review, not when they ask how the review works.`

**Trigger phrases:**
```
start internal review
run internal review
run the monthly review
property is ready for review
run review for a property
start property review
kick off the review
```
Do not add `help`, `review`, `internal review`, `files`, `status` or `rules`. Those collide with the help topics.

### Steps

1. **Send a message:**
   ```
   I can run the Internal Review for one property at a time.
   ```

2. **Ask a question** → **User's entire response** → save as a new variable named `PropertyCode`.
   Text: `What is the property code? For example: mn610wes`

   Then add **Set a variable value** → `Topic.PropertyCode` → formula:
   ```
   Lower(Trim(Topic.PropertyCode))
   ```

3. **Read the period in whatever form the manager types it.** Accepted: `07-2026`, `07/2026`, `07.2026`, `7/2026`, `July 2026`, `Jul 2026`, `July 26`, `Jul-26`, `July '26`. A two-digit number is always the year (periods are month and year, so `July 26` is July 2026, not the 26th). Everything is turned into `07-2026`, which is the only form the flow understands: it builds the report file name from the period, and a `/` in a file name makes SharePoint refuse to create the report.

   a. **Ask a question** → **User's entire response** → save as `ReviewPeriod`. Text: `What review period would you like reviewed? Example: 07-2026 or July 2026`. Leave its validation empty.

   b. Directly under it, **Set a variable value** → set the existing `ReviewPeriod` → formula (paste it whole):
   ```
   With(
     { t: Trim(Substitute(Substitute(Lower(Trim(Substitute(Substitute(Substitute(Substitute(Substitute(Topic.ReviewPeriod, "/", " "), "-", " "), ".", " "), ",", " "), "'", " "))), "  ", " "), "  ", " ")) },
     With(
       { parts: Split(t, " ") },
       With(
         { m: First(parts).Value, y: Last(parts).Value },
         With(
           { mn: If(IsMatch(m, "^\d{1,2}$"), Value(m),
                   Switch(Left(m, 3), "jan", 1, "feb", 2, "mar", 3, "apr", 4, "may", 5, "jun", 6,
                                      "jul", 7, "aug", 8, "sep", 9, "oct", 10, "nov", 11, "dec", 12, 0)),
             yr: If(IsMatch(y, "^\d{4}$"), Value(y), IsMatch(y, "^\d{2}$"), 2000 + Value(y), 0) },
           If(CountRows(parts) = 2 && mn >= 1 && mn <= 12 && yr >= 2020 && yr <= 2099,
              Text(mn, "00") & "-" & Text(yr), "")
         )
       )
     )
   )
   ```
   It gives `07-2026` when it understood the answer and blank when it didn't.

   c. **Add a condition**: `Topic.ReviewPeriod` **is Blank**.
      - Under that branch: **Send a message** `I couldn't read that as a month and year. Please try again, for example 07-2026 or July 2026.` then **Topic management → Go to step** → pick the question in step a.
      - Under **All other conditions**: carry on with the rest of the topic (the existing messages and the flow action).

   **Test before publishing** (Test pane): `07-2026`, `07/2026`, `07.2026`, `7/2026`, `July 2026`, `jul 26`, `July '26` should all continue as `07-2026`; `13/2026`, `July`, `2026` and `hello` should be asked again.

   *(Built 2026-09-27 in the topic named **Manager Internal Review** in the live agent; this guide calls the same topic Start Internal Review.)*

4. **Add an action** → pick the flow **Validate Internal Review Packages**. Map its inputs:
   - PropertyCode → `Topic.PropertyCode`
   - ReviewPeriod → `Topic.ReviewPeriod`
   - RequesterEmail → `System.User.Email`

   Save the flow's outputs as `Status`, `Note`, `DetectedCode` and `DetectedPeriod` (the last two exist once BUILD_GUIDE 6A-2 is built; they are blank unless the Trial Balance in the folder is for a different property or period).

   **4b. Confirm a mismatch before anything runs.** Add a **Condition** on the formula `!IsBlank(Topic.DetectedCode) || !IsBlank(Topic.DetectedPeriod)`.
   - On that branch, **Ask a question** → **Boolean (yes/no)** → save as `ConfirmIdentity`. Text (insert the variables with the {x} picker):
     ```
     The Trial Balance in that folder is for property {Topic.DetectedCode} and period {Topic.DetectedPeriod}, not {Topic.PropertyCode} {Topic.ReviewPeriod}. Is this the package you want reviewed as {Topic.PropertyCode} {Topic.ReviewPeriod}?
     ```
     (If DetectedCode is blank the code matched and only the period differs, and the other way round; the wording still reads correctly because the blank one shows as empty. If you prefer, use two separate conditions with two messages.)
   - **Condition** `Topic.ConfirmIdentity` is equal to `true`: **Add an action** → the same flow again, PropertyCode, ReviewPeriod and RequesterEmail as before, plus `AcceptedCode` → `Topic.DetectedCode` and `AcceptedPeriod` → `Topic.DetectedPeriod`. Save its outputs over `Status` and `Note`. Then continue to step 5.
   - **All other conditions** (the manager said no): **Send a message** `Review not started. Check the property code and period, or move the files to the right folder, then ask again.` and **End the conversation** (or Go to step: the property code question).
   - When neither detected value is set, continue to step 5 as today.

   The review records a yes on its Source Validation tab (SRC-04, Reviewed / Monitor, with the manager's email and the date), so an accepted mismatch is never silent.

5. **Send a message:**
   ```
   {Topic.Status}

   If the package passed file validation, the full review is now running. You'll get a Teams message in a few minutes, and the report will be saved to the property's Internal Review > Review Results folder.
   ```
   Insert `Topic.Status` with the **{x}** variable picker, not by typing braces.

6. **Save.**

### What this topic deliberately does not do (yet)

- **Several properties in one request.** The flow reviews one. Run the topic once per property.
- **Show counts and a report link in the chat.** The flow has to answer before the review finishes, so those arrive in Teams. Showing them in chat needs the flow restructured.

---

## Part C — The eleven message topics

### 1. Agent Overview

**Description:** `Explains what the Internal Review Agent does, who it is for, and what it does not do.`

**Trigger phrases:** `what does this agent do`, `what is the internal review agent`, `agent overview`, `how can this agent help`, `what can you review`, `who should use this agent`

**Message:**
```
The Accounting Manager Internal Review Agent performs a standardized manager-level review of a completed monthly property accounting package.

It locates the property's Internal Review folder from the property code and period, checks the right files are there and are for the right property and month, runs the approved accounting tie-outs and analytical tests, and saves one review workbook per property with every finding classified as Pass, Warning, Exception or Reviewed / Monitor.

It does not replace the Property Accountant's detailed close review, change any source file, or post journal entries.

Say "start internal review" when a package is ready.
```

### 2. Internal Review Process

**Description:** `Explains the monthly Internal Review process from the accountant saving files to the manager receiving the report.`

**Trigger phrases:** `internal review process`, `how does the review work`, `what is the review process`, `how do I prepare for review`, `what happens after the accountant is ready`

**Message:**
```
1. The Property Accountant completes month-end work.
2. The accountant saves the source files in Documents > Accounting > YYYY > MM-Month > Internal Review.
3. The manager asks the agent to start the review and gives the property code and period.
4. The agent finds the property's SharePoint site and that month's folder.
5. It checks the required files are present, one version each, and for the right property and month.
6. The review engine runs every accounting test and keeps going after an Exception, so one problem never hides another.
7. A report is saved to Internal Review > Review Results, and the manager gets a Teams message with the result.
8. If corrections are needed, the accountant replaces the files and the manager runs the review again. The new report is numbered R2, R3 and so on.
```

### 3. Required Files

**Description:** `Lists the files that must be in the Internal Review folder before a review can run.`

**Trigger phrases:** `required files`, `what files are required`, `what do I need for internal review`, `review package files`, `missing files`, `what reports should the accountant save`

**Message:**
```
Always required:
- Balance Sheet Support Schedule (BSSS)
- Trial Balance
- General Ledger Detail
- 12 Month Statement (T12)
- Budget Comparison

Required when they apply:
- Bank Reconciliation, when the property has cash accounts
- Mortgage Statement, when the property has a mortgage
- PM Fee workbook, when a management fee is calculated. Save the working Excel file, not a PDF, because the review checks which amounts were typed in by hand.

Also used when present:
- Balance Sheet (with period change)
- Yardi AME reports: Aged Receivables, Payables Aging, Gross Potential Rent, Security Deposit Activity, Rent Roll with Lease Charges

Save Yardi reports as real Excel (.xlsx) files. A plain Balance Sheet does not count as the BSSS; they are different files.
```

### 4. Source Validation

**Description:** `Explains how the agent checks the source files and what Found, Missing and Multiple Versions mean.`

**Trigger phrases:** `source validation`, `file validation`, `how are files validated`, `why does it say missing`, `why does it say multiple versions`, `how does the agent identify files`

**Message:**
```
Source Validation confirms the folder holds the right files for this property and month before any accounting test runs.

For each file type it reports:
- Found: exactly one usable file.
- Missing: none found. A missing required file is an Exception.
- Multiple Versions: more than one candidate. Keep only the final version in the folder and move drafts to an Archive subfolder.
- Not Applicable: a conditional file that isn't needed, for example no mortgage statement when the property has no debt.

It also reads the property code and period from inside each Excel file. A file for the wrong property or month is an Exception even if its filename looks right, and that file's tests are skipped.
```

### 5. Review Status Definitions

**Description:** `Defines Pass, Warning, Exception, Reviewed / Monitor, and the manager's release decision.`

**Trigger phrases:** `what does exception mean`, `what does warning mean`, `what does pass mean`, `review status definitions`, `ready for release`, `ready with comments`, `not ready`, `reviewed monitor`

**Message:**
```
Finding statuses:
- Pass: the control met the approved rule. No action needed.
- Warning: needs the manager's review or an explanation, but doesn't block release by itself.
- Exception: must be corrected or resolved before release.
- Reviewed / Monitor: needs judgment or stays visible for follow-up, but isn't treated as an error.

Release decision:
The review does not decide whether a package is ready. The reviewing manager reads the findings and chooses one of these in the Manager Decision box on the Executive Summary:
- Ready for Release
- Ready With Comments
- Not Ready
```

### 6. Explain Review Rules

**Description:** `Explains the accounting rules the review applies, by review area.`

**Trigger phrases:** `explain review rules`, `what does the agent review`, `review rules`, `accounting rules`, `how is the review calculated`, `explain a finding`

**Build:** Ask a question → Multiple choice with the options below, then one **Condition** branch per option, each with a Send a message.

| Option | Message |
|---|---|
| BSSS Tie-Out | Each BSSS schedule is compared with the Trial Balance at two decimals. A $0.01 difference is an Exception. A reversed sign, a schedule for an account not on the TB, an account supported twice, or a balance sheet account with a balance and no schedule are also flagged. |
| Report Agreement | The Balance Sheet, Budget Comparison, T12 and General Ledger must all agree with the Trial Balance. A mismatch almost always means a report was exported before the last entry posted, and it's an Exception until the report is re-run. |
| General Ledger | See the General Ledger Review topic. |
| Cash / Bank Rec | The bank rec GL balance must equal TB cash with no unreconciled difference, and every cash account needs a rec. Every outstanding item is aged at month end: over 30 days is Monitor, over 60 is a Warning, over 90 is an Exception. A rec with nothing over 30 days is Clean. The agent also checks the numbers it read from the PDF foot before relying on them. |
| Mortgage | Statement principal must equal the TB mortgage payable (Exception if not). Escrow balances and accrued interest are compared to the statement (Warning if not). |
| AR / AP Other | Open AR Other and AP Other items older than 30 days are Exceptions. |
| Subledgers (AME) | Aged Receivables, prepaid rent and Payables Aging must tie to the TB. Deposits on hand plus delinquent deposits must equal the deposit liability. Rent Roll market rent must equal GPR market rent. |
| Security Deposits | Security deposit cash must be at least what is owed to residents. |
| Major Expenses | Mortgage interest, property tax, insurance and management fee must be recorded when budgeted (Exception if missing). A variance over 15% or $5,000 from budget is a Warning. |
| Utilities | A utility more than 20% off its recent average is a Warning. A utility active in 6 or more of the prior 11 months showing $0 this month is an Exception. |
| T12 Trends | Accounts active 6+ of the prior months showing $0, or moving over 15% and $5,000 from the recent average, are Warnings. Year to date more than 10% and $25,000 from budget is also a Warning. |
| Recurring Contracts | Same as T12 Trends, for Contract Services accounts. |
| PM Fee | See the PM Fee Review topic. |

### 7. General Ledger Review

**Description:** `Explains what the General Ledger Review checks.`

**Trigger phrases:** `GL review`, `general ledger review`, `GL scrub`, `review journal entries`, `accrual review`, `manual entries`

**Message:**
```
The General Ledger Review checks:
- Every GL account agrees to the Trial Balance for beginning balance, activity and ending balance.
- Every entry is posted to the review month.
- Each accrual account's prior-month accrual reverses to exactly $0.00 before the new accrual is posted.
- Manual journal entries over $25,000 or in round thousands are listed for your judgment.
- Manual entries dated outside the review month are flagged.

It narrows attention to specific accounts and entries. It does not replace the accountant's full GL scrub and does not post corrections.
```

### 8. PM Fee Review

**Description:** `Explains how the Property Management Fee calculation is reviewed, including hand-entered adjustments and revenue spikes.`

**Trigger phrases:** `PM fee review`, `management fee review`, `property management fee`, `PM fee adjustments`, `hardcoded adjustment`, `bad debt recovery adjustment`, `revenue spike`

**Message:**
```
The PM Fee Review currently covers the Yardi Fee Pool workbook. It checks:
- The fee base adds up and agrees to the Yardi Report tab.
- No base line was typed over its formula.
- The fee equals the adjusted base times the contract rate, with any minimum or maximum applied.
- The fee calculated is the fee expensed and accrued in the GL.
- Every hand-entered adjustment matches a journal entry in the GL account it names. For example, a $2,523.78 Bad Debt Recovery - JE adjustment must match a $2,523.78 journal entry in the bad debt recovery account.
- A sudden jump in the fee base versus the prior three months is flagged, because it often means an insurance or refund check was scanned as a resident receipt and needs reversing.

OneSite and Entrata fee workbooks are not reviewed yet.
```

### 9. Review Report Structure

**Description:** `Explains the review workbook, its tabs, and how reports are named.`

**Trigger phrases:** `review report structure`, `what is in the report`, `what tabs are in the workbook`, `where are the exceptions`, `where is the report`

**Message:**
```
One workbook per property is saved to Internal Review > Review Results, named like mn610wes_07.2026_Internal_Review_R1.xlsx.

Tabs:
- Executive Summary: the Manager Decision box, the counts, a status for each review area, the BSSS tie-out (ties, does not tie, missing information) with the accounts needing attention, and a status for each bank rec
- BSSS, Bank Rec, T12, Budget Comparison, General Ledger, PM Fee, Other Controls: the findings for that area, with Exceptions listed first
- Source Validation: what was found for each file type
- Review History: this attempt's result
- All Results: every test in one table
- Changes Since Last Review

On every findings tab the first columns are Status, Account / Item, Finding and Required Action.
```

### 10. Review Attempts and Re-Review

**Description:** `Explains R1, R2 and later review attempts and how to re-run a review.`

**Trigger phrases:** `review attempt`, `what is R1`, `what is R2`, `how do I rerun the review`, `re-review`, `run it again`

**Message:**
```
The first report for a property and month is R1. Each later run for the same month becomes R2, R3 and so on, and earlier reports are kept.

Before re-running, replace the corrected files so the folder holds one final version of each source.

If a run fails partway, delete any empty report it left in Review Results, otherwise the next run will skip a number.

An automatic comparison showing which findings were resolved, remain, or are new is planned but not built yet. For now, compare the two reports.
```

### 11. Help

**Description:** `Shows what the user can ask the agent. Use for help, menu or what can I ask.`

**Trigger phrases:** `help`, `show help`, `what can I ask`, `show topics`, `menu`, `explain options`

**Message:**
```
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

Choose one or ask in your own words.
```
Never let `help` route to Start Internal Review.

### Error and unsupported requests

Not a triggered topic. Open **System topics → Fallback** (or **Conversational boosting** if generative answers are on) and set its message to:

```
I can review a package and explain findings, but I can't post, reverse or correct journal entries, and I can't reach an accounting conclusion without the supporting file.

Would you like to start an Internal Review, or learn how the review works?
```

---

## Part D — What changed from the topics handoff, and why

| Topic | Handoff says | This guide says | Why |
|---|---|---|---|
| Start Internal Review | Collects `PropertyCodeList`, several properties at once | One `PropertyCode` per run | The flow takes a single property. A list would pass as one invalid code. |
| Start Internal Review | Shows counts, attempt and report link in chat | Shows the validation result, full results by Teams | The flow answers the agent before the review finishes, because the agent only waits about 100 seconds. |
| Start Internal Review | Two inputs | Three, including RequesterEmail | Needed for the Teams message. |
| Required Files | Omits Balance Sheet and AME reports | Lists both | The engine reads them. |
| Status Definitions | Includes a CONTROL status | Removed | The engine never produces it. |
| Explain Review Rules | PM Fee spike at 150% as a Warning | Described without a number | Engine uses 25% and $50,000 as an Exception. Pick one before stating a number to managers. |
| Explain Review Rules | Missing several live tests | Adds report agreement, AME, security deposits, YTD | These run today and managers will see them. |
| General Ledger Review | Duplicate detection and coding-rule checks | Removed | Not built. The topic would describe tests that never run. |
| PM Fee Review | OneSite, Entrata, income-statement methods supported | Yardi Fee Pool only | Only Yardi is built. |
| Report Structure | GL Review and PM Fee Review tabs | The v2.0 tabs by review area | Matches template v2.0. |
| Re-Review | Resolved / Unresolved / New comparison | Stated as planned | Changes Since Last Review isn't built. |
| Re-Review | Failed runs don't consume a number | Tells the manager to delete the empty report | The flow creates the report file before the review runs, so a failure leaves a file that counts. |

One spelling note for anything user-facing: the product is **Entrata**. The handoff and knowledge pack spell it Entrada, which is worth correcting before managers see it.

Also re-upload the knowledge documents to the agent in the test environment. The topics handoff lists 12; the zip you have holds 10 (it lacks Property Folder Standards and the Build Tracker).

---

## Part E — Test before publishing

Type each utterance into the test panel and confirm the topic that fires.

| Utterance | Should trigger |
|---|---|
| start internal review | Start Internal Review |
| help | Help (not Start Internal Review) |
| what files are required? | Required Files |
| what does exception mean? | Review Status Definitions |
| explain the BSSS rule | Explain Review Rules |
| what happens during source validation? | Source Validation |
| how do I rerun after corrections? | Review Attempts and Re-Review |
| what tabs are in the report? | Review Report Structure |
| what does this agent do? | Agent Overview |
| how are PM Fee adjustments checked? | PM Fee Review |
| explain the GL review | General Ledger Review |
| post the correcting JE | Fallback message |
| (in the review) period 7/26 | Re-prompt for MM-YYYY |
| (in the review) mn610wes, then 07-2026 | Flow runs; validation result shown; Teams message arrives |

Then run one real review (mn610wes 07-2026) and one with a made-up property code, and confirm neither informational question above ever starts the flow.


## Live changes 2026-10-28/29 (Manager Internal Review and Review Attempts)

**Manager Internal Review** (the live name of Start Internal Review): a Set variables node at the top clears `Global.AcceptedCode` and `Global.AcceptedPeriod`; the property code and period are global (`Global.PropertyCodeList`, `Global.ReviewPeriod`); a guard Condition above the first Validate Flow action (`Global.LastReviewStarted is equal to Global.PropertyCodeList & "|" & Global.ReviewPeriod`) sends "A review for … was already started in this chat…" and ends the topic; after the first action, a Condition (`DetectedCode` or `DetectedPeriod` not blank) asks a Boolean question, yes = set the accepted globals and call Validate Flow again, no = "Review not started…" and End current topic; after the Note message, `Global.LastReviewStarted` = `If(StartsWith(Topic.Note, "Review started"), Global.PropertyCodeList & "|" & Global.ReviewPeriod, "")`. The Validate Flow tool is set to "Only when referenced by topics or agents".

**Review Attempts and Re-Review Logic** message (replaces text that was written as instructions to the AI and showed to users verbatim):

```
Each time a review runs for a property and period, it creates a new report in the property's Internal Review > Review Results folder: R1 for the first run, then R2, R3 and so on. There is no limit on re-reviews. To re-run, correct the files in the Internal Review folder and ask for the review again in a new chat.

Every finding keeps the same key from one attempt to the next, so the reports can be compared. The automatic comparison on the Changes Since Last Review tab (Resolved, Unresolved and New findings) is not built yet, so for now compare the two reports side by side.

If a review fails partway through, it can leave an empty report that still uses up an attempt number. Delete that empty file before re-running.
```

## Classic orchestration (live 2026-10-29)

The agent now runs on **classic** orchestration (Settings → Generative AI → Classic), with Allow ungrounded responses off. Reason: under generative orchestration the AI kept writing its own message after the topic ended, inventing rules and files ("1 of 3 attempts", a CAM/CAOD re-review approval, an "outlier file" Profit_And_Loss_2025), even with Instructions telling it not to. In classic mode a topic starts only from its trigger phrases and says only what it was built to say. Every topic needs trigger phrases (the generative descriptions do nothing in classic). Manager Internal Review uses: start internal review, run internal review, run the monthly review, run a review, start review, run the review, kick off the review. The others use the Part C phrases, less "run it again", "ready for release" and "not ready". Tested 2026-10-29: a property whose site the flow cannot find ends cleanly at "Review not started." with nothing after it.
