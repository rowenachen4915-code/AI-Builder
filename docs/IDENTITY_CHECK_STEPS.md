# Identity check: step-by-step for Validate Flow (as it is on 2026-10-27)

Written against the real flow (see `flow-export/`). Input names: PropertyCode = `text`, ReviewPeriod = `text_1`, RequesterEmail = `text_2`, AcceptedCode = `text_3`, AcceptedPeriod = `text_4`. Every expression below is pasted with **fx**, then **Add**. Click **Save draft** after each step. Restore point if anything goes wrong: Version history, 2026-10-26 9:58 pm.

**Done already:** inputs AcceptedCode and AcceptedPeriod (optional); Init Detected Code and Init Detected Period at the top.

## 1. Delete the empty row in Required Files Complete
Open **Required Files Complete**. The second row ("Choose a value / is equal to / Choose a value") → **…** at its end → **Delete**.

## 2. Move Get Drive Id and Have TB up
Drag **Get Drive Id** (top of Required Files Complete's True side) onto the **+** between **Compose - Required Files Status** and **Respond to the agent**. Then drag **Have TB** (Read TB moves with it) onto the **+** between **Get Drive Id** and **Respond to the agent**. Keep both names exactly. If dragging fails: **…** → Copy action, **…** → Delete, then **+** at the new spot → Paste an action, and check the name has no "-copy".

## 3. Make sure a failure here can never silence the agent
These two steps now run before the agent gets its answer. If one failed (no access to the site, an unreadable TB), every step after it would be skipped, including the answer, and the manager would get nothing.
- Click **Have TB** → **Settings** tab → **Run after** → **Get Drive Id**: tick **Is successful**, **Has failed**, **Is skipped**, **Has timed out**.
(Step 5 does the same for the step after Have TB.)

## 4. Read the code and period found in the TB
Open **Have TB** → **True** side. Under **Read TB** add **Set variable** twice:
- Name it `Set Detected Code`. Name: `DetectedCode`. Value:
  `toLower(trim(coalesce(outputs('Read_TB')?['body/result/propertyCode'],'')))`
- Name it `Set Detected Period`. Name: `DetectedPeriod`. Value:
  `trim(coalesce(outputs('Read_TB')?['body/result/period'],''))`

## 5. Compare them with what was asked for
On the **+** between **Have TB** and **Respond to the agent**, add three **Compose** steps, in this order:
- **Code Mismatch**:
  `if(and(not(empty(variables('DetectedCode'))),not(contains(createArray(toLower(trim(triggerBody()?['text'])),toLower(trim(coalesce(triggerBody()?['text_3'],'')))),variables('DetectedCode')))),variables('DetectedCode'),'')`
- **Period Mismatch**:
  `if(and(not(empty(variables('DetectedPeriod'))),not(contains(createArray(trim(triggerBody()?['text_1']),trim(coalesce(triggerBody()?['text_4'],''))),variables('DetectedPeriod')))),variables('DetectedPeriod'),'')`
- **Identity Line**:
  `if(and(empty(outputs('Code_Mismatch')),empty(outputs('Period_Mismatch'))),'',concat('IDENTITY MISMATCH: the Trial Balance in the folder is for property ',variables('DetectedCode'),', period ',variables('DetectedPeriod'),', not ',trim(triggerBody()?['text']),' ',trim(triggerBody()?['text_1']),'. The review was not started.'))`

Then **Code Mismatch** → **Settings** → **Run after** → **Have TB**: tick all four (successful, failed, skipped, timed out).

Each is blank when the TB matches. Code Mismatch holds the TB's code when it does not; Period Mismatch the TB's period.

## 6. Change what the flow tells the agent
Open **Respond to the agent**.
- **Status**: delete the current value, then paste:
  `concat(outputs('Compose_-_Required_Files_Status'),if(empty(outputs('Identity_Line')),'',concat(decodeUriComponent('%0D%0A'),outputs('Identity_Line'))))`
- **Note**: delete the current text, then paste:
  `if(and(contains(outputs('Compose_-_Required_Files_Status'),'REQUIRED FILES COMPLETE'),empty(outputs('Identity_Line'))),'Review started. You''ll get a Teams message with the results in a few minutes, and the report will be saved to the property''s Internal Review > Review Results folder.','Review not started.')`
- **+ Add an output** → **Text** → name `DetectedCode`, value `outputs('Code_Mismatch')`.
- **+ Add an output** → **Text** → name `DetectedPeriod`, value `outputs('Period_Mismatch')`.

## 7. Only start the review when the identity matches
Open **Required Files Complete** → **Add row** (keep **And**). Left box: `empty(outputs('Identity_Line'))`. Middle: **is equal to**. Right box: `true` (pasted with fx, so it is the value true, not the word).

## 8. Pass the accepted values to the review
Open **Run Review**.
- **propertyCode**: delete, then paste `concat(trim(triggerBody()?['text']),if(empty(triggerBody()?['text_3']),'',concat(',',toLower(trim(triggerBody()?['text_3'])))))`
- **reviewPeriod**: delete, then paste `concat(trim(triggerBody()?['text_1']),if(empty(triggerBody()?['text_4']),'',concat(',',trim(triggerBody()?['text_4']))))`

## 9. Record the acceptance on the report
Open **Sources JSON**. Delete its whole expression and paste the one in `docs/flow_sources_json_ValidateFlow.txt` (all of it). It is your current expression with two changes: the bank rec line now says "2 bank rec PDFs (one per account)" instead of "Multiple Versions", and a CONFIRMATION line at the end tells the review who accepted a mismatch and when (shown on the report as SRC-04).

## 10. Fix Have GL
Open **Have GL**. Its condition reads `length(body('Filter_BC'))`; it must be `length(body('Filter_GL'))`. Click the token in the left box, change BC to GL, **Update**.

## 11. Tidy up
Delete **Get file properties** at the bottom (the Teams card uses Get Report Link).

## 12. Save, check, publish
**Save draft** → **Flow checker** (fix anything red; send a screenshot if unsure) → **Publish**. Then in the agent: **Tools** → the flow → check the inputs show AcceptedCode and AcceptedPeriod and the outputs show DetectedCode and DetectedPeriod (remove and re-add the tool if they do not appear).

## 13. Quick test before the topic changes
Run mn610wes 07-2026 from the agent as usual. It must behave exactly as before: the review starts and the Teams card arrives. That proves nothing broke. The topic change that asks the manager comes next (TOPICS_REBUILD_GUIDE Part B step 4b).
