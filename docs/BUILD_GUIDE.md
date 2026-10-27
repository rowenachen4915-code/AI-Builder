# Internal Review Agent — Build Guide (Phase 2)

Follow the parts in order. Do one step, check the box, do the next. Never skip a **CHECK** line. If a CHECK fails, stop and go to Part 9 (Fix-it table).

Words in `this font` are typed or pasted exactly as shown.

---

## The picture

```
Manager types property + month into the agent
        |
The flow finds the folder and the files            (already works today)
        |
4 small Excel scripts READ the Excel files          (new)
2 AI prompts READ the two PDFs                      (new)
        |
1 big Excel script does ALL the accounting tests
and fills in your report template                   (new)
        |
Report lands in  Internal Review / Review Results
Manager gets the findings by email
```

The AI never does math. The AI only copies numbers off the two PDFs, and the script then proves those numbers foot before it uses them. Every test is done by the script, the same way every time.

## What is in this package

| File | What it is |
|---|---|
| `01_ReadTrialBalance.ts` | Script. Reads the Trial Balance. |
| `02_ReadBSSS.ts` | Script. Reads the BS Support Schedule. |
| `03_ReadYardiFinancial.ts` | Script. ONE script used three times: T12, Budget Comparison, Balance Sheet. |
| `04_RunInternalReview.ts` | Script. Runs every test and fills in the report. |
| `05_ReadGeneralLedger.ts` | Script. Reads the General Ledger detail. |
| `06_ReadAMEReport.ts` | Script. ONE script used five times: Aged Receivables, Payables Aging, GPR, Security Deposit Activity, Rent Roll. |
| `07_ReadPMFee.ts` | Script. Reads the monthly PM Fee workbook. |
| `PROMPT_1_BankRec.txt` | Words to paste into the bank rec AI prompt. |
| `PROMPT_2_Mortgage.txt` | Words to paste into the mortgage AI prompt. |
| `SAMPLE_mn610wes_07.2026_Internal_Review_R1.xlsx` | The answer key. This is what the finished report for 610 West July should look like. |

## Before you start

- [ ] You can open Excel in a browser (office.com) and you see an **Automate** tab. No Automate tab = ask IT to turn on Office Scripts. Stop here until you have it.
- [ ] You can open your agent and the **Validate Internal Review Packages** flow in Copilot Studio.
- [ ] The 610 West 07-2026 Internal Review folder has these files in it: BSSS, Trial Balance, General Ledger, 12 Month Statement, Budget Comparison, Balance Sheet, Bank Rec PDF, Mortgage PDF.
- [ ] Every Yardi Excel report in that folder is a real `.xlsx`. (Open it in the browser. If it opens, it is fine. If the browser refuses, open it in desktop Excel → Save As → Excel Workbook (.xlsx) → put that one in the folder instead.)

---

## PART 1 — Put the 4 scripts into Excel (15 minutes, once)

Do steps 1–7 seven times, once per `.ts` file.

1. Go to office.com → Excel → open any blank workbook in the browser.
2. Click the **Automate** tab → **New Script**.
3. A code box opens on the right with a few lines already in it. Click inside it, press **Ctrl+A**, press **Delete**. The box is now empty.
4. Open the `.ts` file from this package in Notepad. Press **Ctrl+A**, **Ctrl+C**.
5. Click in the empty code box. Press **Ctrl+V**.
6. At the top of the code box, click the script name (it says "Script 1" or similar) and rename it to match the file, without `.ts`. Example: `01_ReadTrialBalance`.
7. Click **Save script**.

**CHECK:** No red squiggly lines in the code box. Red squiggles = the paste was incomplete. Delete everything and paste again.

- [ ] `01_ReadTrialBalance` saved
- [ ] `02_ReadBSSS` saved
- [ ] `03_ReadYardiFinancial` saved
- [ ] `04_RunInternalReview` saved
- [ ] `05_ReadGeneralLedger` saved
- [ ] `06_ReadAMEReport` saved
- [ ] `07_ReadPMFee` saved

## PART 2 — Prove the readers work, by hand (10 minutes)

This finds file problems now, while they are easy to see, not later inside the flow.

1. Open the **610 West Trial Balance** in the browser (from SharePoint, click the file).
2. **Automate** tab → **All Scripts** → click `01_ReadTrialBalance` → **Run**.
3. Look at the **Output** box under the code.

**CHECK:** You see `TRIAL BALANCE READ: mn610wes 07-2026 | 210 accounts | in balance: true | problems: 0`

4. Open the **BSSS** (.xlsm) in the browser. Run `02_ReadBSSS`.

**CHECK:** You see `BSSS READ: mn610wes 07-2026 | 22 supported accounts | 45 open items | problems: 0`

> This is the most important CHECK in the whole guide. The BSSS is a macro file. If the browser will not open it, or the script will not run on it, the whole plan needs a change. Stop and tell me the exact message.

5. Open the **12 Month Statement**. Run `03_ReadYardiFinancial`. **CHECK:** `STATEMENT (12 MONTHS) READ: mn610wes 07-2026 | 260 rows | 13 columns | problems: 0`
6. Open the **Budget Comparison**. Run `03_ReadYardiFinancial`. **CHECK:** `BUDGET COMPARISON READ: mn610wes 07-2026 | 206 rows | 9 columns | problems: 0`
7. Open the **Balance Sheet**. Run `03_ReadYardiFinancial`. **CHECK:** `BALANCE SHEET (WITH PERIOD CHANGE) READ: mn610wes 07-2026 | 56 rows | 3 columns | problems: 0`
8. Open the **General Ledger**. Run `05_ReadGeneralLedger`. **CHECK:** `GENERAL LEDGER READ: mn610wes 07-2026 | 210 accounts | 9687 entries | 18 flagged | problems: 0`
   > This is the biggest file, about 10,000 rows. If it times out, tell me and we will read it in chunks.
9. Open each of the five AME reports in turn and run `06_ReadAMEReport` on each. **CHECK**, one line per file:
   `AR READ: mn610wes 07-2026 | 4 totals | problems: 0`
   `AP READ: mn610wes 07-2026 | 2 totals | problems: 0`
   `GPR READ: mn610wes 07-2026 | 8 totals | problems: 0`
   `SD READ: mn610wes 07-2026 | 5 totals | problems: 0`
   `RR READ: mn610wes 07-2026 | 3 totals | problems: 0`
10. Open the **PM Fee workbook** and run `07_ReadPMFee`. **CHECK:** `PM FEE READ: mn610wes 07-2026 | base 911225.84 | 8 adjustments | fee due 22786.57 | 7 months | problems: 0`
11. Close each file **without saving** if asked. The scripts change nothing.

## PART 3 — Give the scripts and the template a shared home (5 minutes, once)

Scripts saved in Part 1 live in YOUR OneDrive. The flow needs them somewhere shared.

1. Pick one SharePoint site that will be the tool's home (your team site is fine). In its **Documents** library create a folder named `Internal Review Agent`.
2. Open OneDrive → **My files** → **Documents** → **Office Scripts**. You see seven files ending in `.osts`.
3. Select all seven → **Move to** → the `Internal Review Agent` folder.
4. Upload `Internal_Review_Report_Template_v2_0.xlsx` into the same folder.

**CHECK:** The `Internal Review Agent` folder shows 7 `.osts` files and 1 template.

From now on, when you need to change a script, open it from this folder.

## PART 4 — Make the 2 PDF prompts (15 minutes, once)

1. In Copilot Studio, open your agent → **Tools** → **Add a tool** → **New tool** → **Prompt**. (If you do not see Prompt there: make.powerapps.com → **AI hub** → **Prompts** → **Build your own prompt**. Same thing.)
2. Name it `IR - Read Bank Rec PDF`.
3. Open `PROMPT_1_BankRec.txt`. Copy everything between the first and second `=====` lines. Paste it into the prompt instructions box.
4. In the pasted text find `[BankRecPDF]`. Delete those words, leave the cursor there, type `/` → choose **Image or document** → name the input `BankRecPDF`.
5. On the right, change **Output** from Text to **JSON**. Click to edit the JSON format → choose custom/example → paste the JSON EXAMPLE from the bottom of the txt file → apply.
6. Click the `BankRecPDF` input → upload the 610 West bank rec PDF as sample data → click **Test**.

**CHECK:** The result shows two bank recs. The first has `"reconciledBankBalance": 284746.15`. The second has `"reconciledBankBalance": 353796.91`. If the test says the file is too large or too many pages, go to Part 9, row "PDF too big".

7. **Save**.
8. Repeat steps 1–7 with `PROMPT_2_Mortgage.txt`. Name: `IR - Read Mortgage Statement PDF`. Input name: `MortgagePDF`.

**CHECK:** Mortgage test result shows `"principalBalance": 77830000` and `"interestDue": 380675.18`.

## PART 5 — Get the flow ready (10 minutes)

1. Open the **Validate Internal Review Packages** flow. Click **Save As** (or ⋯ → Save a copy) and name the copy `BACKUP - Validate Internal Review Packages - <today's date>`. Go back to the original. **You now cannot break anything that you can't get back.**
2. Add one more flow input so the flow knows who to email. Click the trigger (top box) → **Add an input** → **Text** → name it `RequesterEmail`.
3. Add one more file filter. Find your existing **Filter array** action for the Budget Comparison. Click ⋯ → **Copy**, then paste it right under. In the copy, change the text it looks for to `balance_sheet`. (Your BSSS filter must keep ignoring this file — it already does, since it looks for "bs support" / "bsss".)
4. Rename your filter actions so the pasted formulas in Part 6 work. Click each filter's title and type the new name exactly:

| The filter that finds… | Rename it to |
|---|---|
| BSSS | `Filter BSSS` |
| Trial Balance | `Filter TB` |
| General Ledger | `Filter GL` |
| 12 Month Statement | `Filter T12` |
| Budget Comparison | `Filter BC` |
| Bank Reconciliation | `Filter BANKREC` |
| Mortgage Statement | `Filter MORTGAGE` |
| Balance Sheet (new) | `Filter BS` |

5. Rename the Compose that holds the folder path to `Internal Review Folder Path`, and the step that holds the site address to whatever you like — below I call its value **FlowSiteURL**; pick it from the lightning-bolt list whenever you see that word.
6. **Save**. Run the flow once from the agent with `mn610wes` and `07-2026`.

**CHECK:** You still get the same Required File Validation message as before. Nothing has changed yet. If it broke, a rename did not carry through — open the failed step and re-pick the value.

## PART 6 — Add the new steps to the flow (60 minutes)

Rules for this whole part:
- Add every step **below** the step before it, in this order.
- Give every step the **exact name** shown in bold. To rename: click the step title and type.
- "Paste as expression" means: click in the field → click **fx** → paste → **Add**.

### 6A. Answer the agent first, then keep working

A full review takes 2–4 minutes. The agent only waits about 100 seconds for a flow. So the flow answers the agent right away and sends the results by email when done.

1. Find your **Respond to the agent** step. Leave it where it is. In the text it returns, add this sentence at the end: ` Review started. The findings report will be emailed to you in about 5 minutes.`
2. Under it add a **Condition**. Name: **Required Files Complete**. Left box: pick your validation summary/status value. Middle: `contains`. Right: `REQUIRED FILES COMPLETE`.
3. Everything from here down goes inside the **True** side. Leave **False** empty.

### 6B. Get the library's ID

4. Add **Send an HTTP request to SharePoint**. Name: **Get Drive Id**.

| Field | Value |
|---|---|
| Site Address | **FlowSiteURL** (Enter custom value → pick it) |
| Method | `GET` |
| Uri | `_api/v2.0/drive` |

### 6C. Note which files were found

5. Add **Compose**. Name: **Sources JSON**. Paste as expression, all of it:

```
string(createArray(
json(concat('{"type":"BSSS","file":"',replace(coalesce(first(body('Filter_BSSS'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_BSSS')),0),'Missing',if(equals(length(body('Filter_BSSS')),1),'Found','Multiple Versions')),'"}')),
json(concat('{"type":"TB","file":"',replace(coalesce(first(body('Filter_TB'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_TB')),0),'Missing',if(equals(length(body('Filter_TB')),1),'Found','Multiple Versions')),'"}')),
json(concat('{"type":"GL","file":"',replace(coalesce(first(body('Filter_GL'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_GL')),0),'Missing',if(equals(length(body('Filter_GL')),1),'Found','Multiple Versions')),'"}')),
json(concat('{"type":"T12","file":"',replace(coalesce(first(body('Filter_T12'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_T12')),0),'Missing',if(equals(length(body('Filter_T12')),1),'Found','Multiple Versions')),'"}')),
json(concat('{"type":"BC","file":"',replace(coalesce(first(body('Filter_BC'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_BC')),0),'Missing',if(equals(length(body('Filter_BC')),1),'Found','Multiple Versions')),'"}')),
json(concat('{"type":"BANKREC","file":"',replace(coalesce(first(body('Filter_BANKREC'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_BANKREC')),0),'Missing',if(equals(length(body('Filter_BANKREC')),1),'Found','Multiple Versions')),'"}')),
json(concat('{"type":"MORTGAGE","file":"',replace(coalesce(first(body('Filter_MORTGAGE'))?['{FilenameWithExtension}'],''),'"',''),'","status":"',if(equals(length(body('Filter_MORTGAGE')),0),'Missing',if(equals(length(body('Filter_MORTGAGE')),1),'Found','Multiple Versions')),'"}'))
))
```

### 6D. Read the five Excel files

You will build the same two-box pattern five times. Here is the pattern for the Trial Balance:

6. Add **Condition**. Name: **Have TB**. Left box, paste as expression: `length(body('Filter_TB'))` — middle: `is equal to` — right: `1`.
7. Inside its **True** side add **Run script from SharePoint library** (Excel Online Business). Name: **Read TB**.

| Field | Value |
|---|---|
| Workbook Location | **FlowSiteURL** (custom value) |
| Workbook Library | paste as expression: `body('Get_Drive_Id')?['id']` |
| Workbook | paste as expression: `first(body('Filter_TB'))?['{Identifier}']` |
| Script Location | the tool's home site from Part 3 (pick from the list) |
| Script Library | `Documents` |
| Script | browse to `Internal Review Agent` → `01_ReadTrialBalance.osts` |

Now repeat steps 6–7 for the other four. Only the names, the filter and the script change:

| Condition name | Expression in the Condition | Run script name | Workbook expression | Script |
|---|---|---|---|---|
| **Have BSSS** | `length(body('Filter_BSSS'))` | **Read BSSS** | `first(body('Filter_BSSS'))?['{Identifier}']` | `02_ReadBSSS` |
| **Have T12** | `length(body('Filter_T12'))` | **Read T12** | `first(body('Filter_T12'))?['{Identifier}']` | `03_ReadYardiFinancial` |
| **Have BC** | `length(body('Filter_BC'))` | **Read BC** | `first(body('Filter_BC'))?['{Identifier}']` | `03_ReadYardiFinancial` |
| **Have BS** | `length(body('Filter_BS'))` | **Read BS** | `first(body('Filter_BS'))?['{Identifier}']` | `03_ReadYardiFinancial` |
| **Have GL** | `length(body('Filter_GL'))` | **Read GL** | `first(body('Filter_GL'))?['{Identifier}']` | `05_ReadGeneralLedger` |

Then the five AME reports, same pattern again. Each needs its own **Filter array** first (copy an existing one and change the text it matches), named `Filter AME AR`, `Filter AME AP`, `Filter AME GPR`, `Filter AME SD`, `Filter AME RR`, matching on `aged receivable`, `payables aging`, `gross potential`, `security deposit activity` and `rent roll`.

| Condition name | Expression in the Condition | Run script name | Workbook expression | Script |
|---|---|---|---|---|
| **Have AME AR** | `length(body('Filter_AME_AR'))` | **Read AME AR** | `first(body('Filter_AME_AR'))?['{Identifier}']` | `06_ReadAMEReport` |
| **Have AME AP** | `length(body('Filter_AME_AP'))` | **Read AME AP** | `first(body('Filter_AME_AP'))?['{Identifier}']` | `06_ReadAMEReport` |
| **Have AME GPR** | `length(body('Filter_AME_GPR'))` | **Read AME GPR** | `first(body('Filter_AME_GPR'))?['{Identifier}']` | `06_ReadAMEReport` |
| **Have AME SD** | `length(body('Filter_AME_SD'))` | **Read AME SD** | `first(body('Filter_AME_SD'))?['{Identifier}']` | `06_ReadAMEReport` |
| **Have AME RR** | `length(body('Filter_AME_RR'))` | **Read AME RR** | `first(body('Filter_AME_RR'))?['{Identifier}']` | `06_ReadAMEReport` |

And the PM Fee workbook: a **Filter PM FEE** matching on `pm fee`, a **Have PM FEE** condition (`length(body('Filter_PM_FEE'))`), and inside it **Read PM Fee** running `07_ReadPMFee` on `first(body('Filter_PM_FEE'))?['{Identifier}']`.

**Read GL** has three extra boxes of its own. Fill them: `accrualAccountsCsv` blank (it then tests every 22xxx account), `largeEntry` `25000`, `staleDays` `90`.

Each new Condition goes **under** the previous Condition (not inside it).

### 6E. Read the two PDFs

8. **Bank recs can come as one combined PDF or one PDF per account** (610 West sends one package; Presidium Regal sends an OP and an SD PDF). The flow reads every bank rec PDF in the folder and hands all the results to the review, which puts them together, checks each cash account has exactly one rec, and flags a duplicate as CASH-06.
   - a. At the **top level of the flow** (not inside any condition, e.g. right under the trigger), add **Initialize variable**. Name the step **Init BankRec Results**. Variable name: `BankRecResults`. Type: **Array**. Value: `[]`. (Power Automate only allows Initialize variable at the top level.)
   - b. Add **Condition**. Name: **Have BANKREC**. Expression: `length(body('Filter_BANKREC'))` `is greater than` `0`.
   - c. Inside **True** add **Apply to each**. Name: **Each BankRec PDF**. "Select an output from previous steps", paste as expression: `body('Filter_BANKREC')`
   - d. Inside the loop add SharePoint **Get file content**. Name: **Get BankRec PDF**. Site Address: **FlowSiteURL**. File Identifier, paste as expression: `items('Each_BankRec_PDF')?['{Identifier}']`
   - e. Under it (still inside the loop) add **Run a prompt**. Name: **Read BankRec PDF**. Prompt: `IR - Read Bank Rec PDF` (choose the prompt first and let the step reload). BankRecPDF, paste as expression: `base64(body('Get_BankRec_PDF'))`
   - f. Under it (still inside the loop) add **Append to array variable**. Name: **Add BankRec Result**. Name: `BankRecResults`. Value, paste as expression: `outputs('Read_BankRec_PDF')?['body']`
   - Leave the loop's concurrency setting off (the default). Each PDF is one prompt call, so two small PDFs cost about the same as one combined package.
9. *(If you already built the one-PDF version: change **Have BANKREC** from `is equal to 1` to `is greater than 0`, add the Apply to each inside True, drag **Get BankRec PDF** and **Read BankRec PDF** into it, change Get BankRec PDF's File Identifier to the `items(...)` expression above, add steps a and f, and change `bankRecJson` in **Run Review** as shown in 6G. If dragging won't work, delete the two steps and re-add them inside the loop with the same names.)*
10. In the **Sources JSON** Compose, replace the `BANKREC` line with the version in `docs/flow_sources_json_expression.txt` so several bank rec PDFs show as **Found** with a count instead of **Multiple Versions**.
11. The mortgage stays one statement per property. Add **Condition**. Name: **Have MORTGAGE**. Expression: `length(body('Filter_MORTGAGE'))` `is equal to` `1`. Inside **True** add SharePoint **Get file content**, name **Get Mortgage PDF**, Site Address **FlowSiteURL**, File Identifier as expression `first(body('Filter_MORTGAGE'))?['{Identifier}']`. Under it add **Run a prompt**, name **Read Mortgage PDF**, prompt `IR - Read Mortgage Statement PDF`, file as expression `base64(body('Get_Mortgage_PDF'))`.

### 6F. Make the empty report

12. Add SharePoint **Create new folder**. Name: **Make Results Folder**. Site: **FlowSiteURL**. List or Library: `Documents`. Folder Path, paste as expression: `concat(replace(outputs('Internal_Review_Folder_Path'),'Shared Documents/',''),'/Review Results')`  (It does nothing if the folder is already there.)
13. Add SharePoint **Get files (properties only)**. Name: **List Old Reports**. Site: **FlowSiteURL**. Library: `Documents`. Limit Entries to Folder, paste as expression: `concat(outputs('Internal_Review_Folder_Path'),'/Review Results')`
14. Add **Filter array**. Name: **Old Reports This Period**. From: `value` of *List Old Reports*. Click **Edit in advanced mode** and paste: `@startsWith(toLower(item()?['{FilenameWithExtension}']), toLower(concat(triggerBody()?['text'],'_')))`
   *(If your PropertyCode input is not called `text`, delete `triggerBody()?['text']` and pick PropertyCode from the list instead.)*
15. Add **Compose**. Name: **Review Attempt**. Expression: `concat('R', add(length(body('Old_Reports_This_Period')), 1))`
16. Add **Compose**. Name: **Report File Name**. Expression — then swap in your two inputs where shown: `concat(PROPERTYCODE, '_', replace(REVIEWPERIOD,'-','.'), '_Internal_Review_', outputs('Review_Attempt'), '.xlsx')`
17. Add SharePoint **Get file content**. Name: **Get Template**. Site: the tool's home site. File: browse to `Internal Review Agent/Internal_Review_Report_Template_v2_0.xlsx`.
18. Add SharePoint **Create file**. Name: **Create Report**. Site: **FlowSiteURL**. Folder Path: expression `concat('/', outputs('Internal_Review_Folder_Path'), '/Review Results')`. File Name: output of *Report File Name*. File Content: **File content** from *Get Template*.
19. Add **Delay**. Count `15`, Unit `Second`. (Gives SharePoint a moment before Excel opens the new file.)

### 6G. Run the review

20. Add **Run script from SharePoint library**. Name: **Run Review**. Workbook Location: **FlowSiteURL**. Workbook Library: `body('Get_Drive_Id')?['id']`. Workbook: expression `body('Create_Report')?['Id']`. Script: `04_RunInternalReview.osts`. Boxes for the script's inputs appear. Fill them:

| Box | Value |
|---|---|
| propertyCode | your PropertyCode input |
| reviewPeriod | your ReviewPeriod input |
| reviewAttempt | output of *Review Attempt* |
| submissionType | expression: `if(equals(outputs('Review_Attempt'),'R1'),'Initial','Re-review')` |
| reportFileName | output of *Report File Name* |
| sourcesJson | output of *Sources JSON* |
| tbJson | expression: `if(empty(outputs('Read_TB')?['body/result']),'',string(outputs('Read_TB')?['body/result']))` |
| bsssJson | same, with `Read_BSSS` |
| t12Json | same, with `Read_T12` |
| bcJson | same, with `Read_BC` |
| bsJson | same, with `Read_BS` |
| glJson | same, with `Read_GL` |
| pmFeeJson | expression: `if(empty(outputs('Read_PM_Fee')?['body/result']),'',string(outputs('Read_PM_Fee')?['body/result']))` |
| ameJson | expression: `string(createArray(coalesce(outputs('Read_AME_AR')?['body/result'],json('{}')),coalesce(outputs('Read_AME_AP')?['body/result'],json('{}')),coalesce(outputs('Read_AME_GPR')?['body/result'],json('{}')),coalesce(outputs('Read_AME_SD')?['body/result'],json('{}')),coalesce(outputs('Read_AME_RR')?['body/result'],json('{}'))))` |
| bankRecJson | expression: `if(empty(variables('BankRecResults')),'',string(variables('BankRecResults')))` |
| mortgageJson | expression: `if(empty(outputs('Read_Mortgage_PDF')?['body']),'',string(outputs('Read_Mortgage_PDF')?['body']))` |
| rulesetJson | leave empty |

> The `if(empty(...` wrapper is what lets the review run when an optional file is missing: the box is simply passed in blank. Never type `[]` or `{}` into a box as a placeholder: leave it blank. (The review now reports a wrong value as a Warning naming the box rather than failing, but the tests for that source still won't run.) The script finds the numbers inside whatever the AI prompt step returns.

### 6H. Email the findings

21. Add **Send an email (V2)**. Name: **Email Findings**.

| Field | Value |
|---|---|
| To | `RequesterEmail` input |
| Subject | expression: `outputs('Run_Review')?['body/result/summary']` |
| Body | Type: `Internal Review complete.` then new line, pick expression `outputs('Run_Review')?['body/result/findingsText']`, then new line, `Report:` and expression `concat(FLOWSITEURL,'/',replace(body('Create_Report')?['Path'],' ','%20'))` |

22. **Save** the flow. Fix anything the flow checker underlines in red, then **Publish**.

## PART 7 — Tell the agent what to do (5 minutes)

1. In the agent → the flow tool → inputs: map `RequesterEmail` to the variable **System.User.Email**. (For the pilot you may type your own email instead.)
2. Add to the agent's Instructions:

```
When the user asks for an internal review, collect the Yardi property code and the review period as MM-YYYY, then run the Validate Internal Review Packages tool.
Show the Required File Validation result exactly as returned.
If required files are complete, tell the user the review is running and the results will arrive as a Teams message, with the report saved in the property's Internal Review / Review Results folder.
Never calculate, estimate or restate accounting amounts yourself. Never say a property passed, failed, is ready or is not ready; that is the reviewing manager's decision, recorded in the report's Manager Decision box.
```

3. **Publish** the agent.

## PART 8 — The test, with the answer key

Ask the agent: `Run the internal review for mn610wes 07-2026`

**CHECK 1:** The agent shows the validation message and says the review started.

**CHECK 2:** Within about 5 minutes the Teams message arrives: `mn610wes 07-2026 R1: Review Complete - 3 exception(s), 44 warning(s), 58 to monitor, 85 passed. Awaiting manager decision.`

**CHECK 3:** Open the new report in `Review Results`. Compare it with `SAMPLE_mn610wes_07.2026_Internal_Review_R1.xlsx`. They should match. Executive Summary shows 3 / 44 / 58 / 85 with the **Manager Decision** box blank, with the operating bank rec shown as Exception and the security deposit rec as Clean.

The two exceptions are real: the Balance Sheet in the folder shows Accrued Expense 22010 at 112,327.91 but the TB shows 85,745.35, and its Current Year Earnings are 26,582.56 lower than TB net income. The Balance Sheet was exported before the last entry posted. Replace it with a fresh one, run again, and you get **R2** with 0 exceptions.

**CHECK 4:** The BSSS and TB "Modified" dates in SharePoint did not change.

**CHECK 5 (one-cent test):** Copy the 610 West folder files to a test folder/property, change one BSSS amount by 0.01, run again. You must get a BSSS-01 exception with difference 0.01.

## PART 9 — Fix-it table

| What you see | What it means | What to do |
|---|---|---|
| A **Read …** step fails: "file not found" / "invalid file" | Excel did not accept the file pointer | Inside that Condition, above the Run script, add SharePoint **Get file metadata** (File Identifier = the same `first(body('Filter_…'))?['{Identifier}']`). In Run script, set Workbook to the **Id** from Get file metadata. |
| **Get Drive Id** fails | The site blocked that address | Delete the step. In every Run script, type `Documents` in Workbook Library instead. |
| **Read BSSS** fails but the others work | The macro file will not open in Excel Online | Tell me the exact error text. Short-term: save a copy of the BSSS as `.xlsx` in the folder. |
| A Read step fails on a Yardi report | It is an old-style `.xls` (really a web page) | Open in desktop Excel → Save As → `.xlsx`. Ask accountants to export as Excel (.xlsx). |
| **Run Review** boxes are missing or wrong after you edit a script | The flow remembers the old script | In that step, pick a different script, then pick the right one again. The boxes refresh. |
| **CASH-00** exception | The subtotals read off the PDF do not foot to the reconciled balance | Review that bank rec by hand; the cash tests below it are not reliable. Send me the PDF. |
| **CASH-00** warning naming a section | One line inside that section was misread or missed. The tie-out still stands; only that section's ageing list is short | Eyeball that section of the rec. Send me the PDF so the prompt can be tightened. |
| "PDF too big" / prompt fails on the bank rec | The combined package is over the prompt's size or page limit | Save only the Bank Reconciliation Report pages (not the bank statements) as the PDF named "bank rec". The review only needs those pages. |
| **Create Report** fails: file already exists | Two runs at the same moment | Run again. The attempt number moves up. |
| Email never arrives, flow shows **Succeeded** | `RequesterEmail` came in empty | Part 7 step 1. |
| Flow stops right after answering the agent | Your environment ends the flow at the response step | Move the **Respond to the agent** step to the very end, and send me the run time from the run history; we will split the reads into parallel branches. |
| Way too many / too few T12 warnings | Thresholds | Bottom of script 04, `defaultRuleset()`: `minChange: 1000` is the smallest dollar move worth a warning. Raise it for fewer warnings. |
| **Read GL** times out or returns nothing | The GL is very large | Tell me the property and row count. The reader already returns summaries rather than every row, so the next step is reading it in chunks. |
| Too many GL-02 manual entries listed | Threshold | `glLargeEntry: 25000` in `defaultRuleset()`. |
| GPR concessions or write-off show as Monitor with a variance | The accounts those GPR columns post to differ by chart | Correct `ameTies` in `defaultRuleset()` so each GPR column names the right accounts for that chart. |
| PMF-05 says no journal entry matches | The income behind the adjustment was never posted, or it went to a different account | Check the GL for that account. This is the test working as intended. |
| PMF-07 fires on a property with genuine seasonal swings | Threshold | `feeSpikePct: 25` and `feeSpikeAmt: 50000` in `defaultRuleset()`. |
| An AME report will not read | It is an HTML-named `.xls`, or a report type the script does not know | Re-export as `.xlsx`. The script reads only the five named AME reports. |

## PART 10 — What gets tested

| Rule | Test | If it fails |
|---|---|---|
| SRC-01 | Every required source is present, one version only. Bank rec required when the TB has cash; mortgage statement required when the TB has debt | Exception |
| SRC-02 | Each Excel file is for the requested property and month (read from inside the file) | Exception; that file's tests are skipped |
| AME-00 | Each AME report is readable and is for the requested property and month | Exception |
| AME-01 | Aged Receivables total, prepays, and Payables Aging total tie to the TB | Exception |
| AME-02 | Deposits on hand (plus delinquent deposits) = the TB deposit liability | Exception |
| AME-03 | Rent Roll market rent = GPR market rent | Exception |
| GPR-01 | GPR market rent, gain/loss to lease, vacancy, model, concessions and write-off vs TB activity | Reviewed / Monitor |
| SD-01 | Security deposit cash is at least what is owed to residents | Exception |
| CLR-01 | Clearing and suspense accounts are $0.00 at month end | Exception |
| BAL-01 | Accounts carry the balance side they should | Exception |
| BC-03 | Year to date within 10% and $25,000 of budget | Warning |
| PMF-00 | The PM Fee workbook is readable and is for the requested property and month | Exception |
| PMF-01 | Total Base foots and agrees to the Yardi Report tab | Exception |
| PMF-02 | No fee base line has been typed over its formula | Exception |
| PMF-03 | Fee = adjusted base x contract rate, with the minimum and maximum applied | Exception |
| PMF-04 | The fee calculated is the fee expensed and accrued in the GL | Exception / Warning |
| PMF-05 | Every hand-entered adjustment matches a journal entry in the GL account it names | Exception |
| PMF-06 | Adjustments with no GL account beside them | Reviewed / Monitor |
| PMF-07 | The fee base is within 25% and $50,000 of the prior 3-month average | Exception |
| PMF-08 | The fee rate on the Yardi Report tab matches the rate used | Reviewed / Monitor |
| DEP-01 | Depreciation and amortization steady month to month | Exception if missing, Warning if it moves |
| GL-01 | Every GL account section agrees to the TB — beginning, activity and ending | Exception |
| GL-03 | Every entry is posted to the review period | Exception |
| ACCR-01 | The prior accrual reverses to $0.00 before the new month's accrual is posted | Exception |
| GL-02 | Manual journal entries over $25,000 or round thousands, listed for judgement | Reviewed / Monitor |
| GL-04 | Manual entries dated outside the review period | Warning |
| TB-01, TB-02 | TB is in balance; columns were read correctly | Exception |
| BSSS-01 | Every BSSS schedule ties to the TB to the cent; reversed signs called out | Exception |
| BSSS-02 | Balance sheet account with a balance and no schedule | Exception / Monitor / Warning per the coverage table |
| BSSS-03 | Same account supported twice | Exception |
| AR-01, AP-01 | A/R Other (12075) and A/P Other (21065) open items over 30 days | Exception |
| BS-01, BS-02 | Balance Sheet agrees to the TB; current year earnings = TB net income | Exception |
| BC-01, T12-00 | Budget Comparison and T12 agree to the TB (catches stale reports) | Exception |
| CASH-00 | The subtotals read from the PDF foot to the reconciled balance | Exception |
| CASH-00 | Each section's listed lines add to that section's subtotal | Warning, naming the section |
| CASH-01 | Bank rec GL balance = TB cash, unreconciled difference = 0.00 | Exception |
| CASH-02, CASH-03 | Age of every outstanding check, deposit, reconciling item and other item at month-end | Monitor over 30 days, Warning over 60, Exception over 90 |
| CASH-04 | Every TB cash account has a reconciliation | Exception |
| CASH-06 | Each cash account has only one reconciliation (bank recs may arrive one PDF per account) | Exception |
| DEBT-01 | Statement principal = TB mortgage payable | Exception |
| DEBT-02, DEBT-03 | Escrow balances = TB escrow accounts; interest billed = accrued interest | Warning |
| DEBT-04 | Statement is the one billed for the following month | Warning |
| MAJOR-01 | Mortgage interest, property tax, insurance, management fee recorded when budgeted | Exception |
| MAJOR-02 | Those four vs budget: over 15% or over $5,000 | Warning |
| UTIL-01 | Utility account over 20% off its prior 3-month average | Warning |
| UTIL-02 | Utility active 6+ of prior 11 months and $0 this month | Exception |
| CONT-02, CONT-03 | Contract Services: recurring and $0 this month; over 15% or $5,000 off trend | Warning |
| T12-01, T12-02 | Same two tests for all other income and expense accounts (40000–69999) | Warning |
| BC-02 | 15 largest other budget variances, listed for your judgement | Reviewed / Monitor |

Not in this version: "Changes Since Last Review" is not filled yet. Every result carries a stable `FindingKey` on the **All Results** tab, which is what the R1-vs-R2 comparison will use.
