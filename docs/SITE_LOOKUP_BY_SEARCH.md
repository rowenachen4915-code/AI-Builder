# Validate flow: find the property site by search instead of the Excel

Hey Rowena, here's how to drop the Excel lookup from the validate flow. The flow can find the property's Accounting site by searching SharePoint for the Yardi code, so there's no list to keep updated. I tested the search on 233 properties and it found the right site for every one where the account running it has access.

## 1. Add a Compose called `Property_Code`

Make it the first step after the trigger:

```
toLower(trim(triggerBody()?['text']))
```

## 2. Replace `List rows present in a table` with "Send an HTTP request to SharePoint", named `Find_Property_Site`

- **Site Address:** the AI Creation site (any site the connection can open works; search covers the whole tenant)
- **Method:** GET
- **Uri:**
  ```
  _api/search/query?querytext='@{outputs('Property_Code')}*%20contentclass:STS_Site'&selectproperties='Path'&rowlimit=50&trimduplicates=false
  ```
- **Headers:** `Accept` = `application/json;odata=nometadata`

## 3. Add a Filter array called `Filter_Accounting_Site`

From:

```
split(string(body('Find_Property_Site')?['PrimaryQueryResult']?['RelevantResults']?['Table']?['Rows']), '"')
```

Condition (edit in advanced mode):

```
@and(
  startsWith(toLower(item()), 'https://greystar365.sharepoint.com/sites/prop-'),
  contains(toLower(item()), concat('-', outputs('Property_Code'))),
  contains(toLower(last(split(item(), '/'))), '-accounting'),
  not(contains(toLower(item()), 'accountingmonthend')),
  not(contains('abcdefghijklmnopqrstuvwxyz', substring(concat(last(split(toLower(last(split(item(), '/'))), concat('-', outputs('Property_Code')))), '-'), 0, 1)))
)
```

The last line stops a short code like `rpglo` from matching a different property's `rpglolas793` site. Codes followed by digits (`coretfox2`, `rprobins944`), names ending `-Accounting2` or `-Accounting59`, and the newer `txspepar_sdbl9b` shape all still match.

## 4. Add Composes `Accounting_Sites` and `Site_URL`

`Accounting_Sites` removes duplicates:

```
union(body('Filter_Accounting_Site'), json('[]'))
```

`Site_URL`:

```
if(equals(length(outputs('Accounting_Sites')), 1), first(outputs('Accounting_Sites')), '')
```

If no site or more than one site is found, this comes out blank, so the flow fails instead of reading the wrong site.

## 5. Point the flow at the new URL and add a status line

- In `Get files (properties only)` and `Get_Drive_Id`, change the Site Address from `first(body('List_rows_present_in_a_table')?['value'])?['FlowSiteURL']` to `outputs('Site_URL')`.
- Add this line to the reply the agent sends back:

```
if(equals(length(outputs('Accounting_Sites')),1), concat('SITE: ', outputs('Site_URL')), if(equals(length(outputs('Accounting_Sites')),0), concat('SITE NOT FOUND for ', outputs('Property_Code'), ' (no Accounting site, or no access)'), concat('MULTIPLE SITES for ', outputs('Property_Code'), ': ', join(outputs('Accounting_Sites'), ', '))))
```

## 6. Test with these codes

| Code | Expected |
|---|---|
| `az601pax` | `Prop-601PAX-az601pax-Accounting` |
| `rpnovhar` (a rebrand) | `Prop-NOVELHarpethHeights-rpnovhar-Accounting` |
| `rpglolas` | `Prop-GloLasVegas-rpglolas793-Accounting` |
| `txspepar` | `Prop-SpectraParks-txspepar_sdbl9b-Accounting` |
| `rpwaterb` | SITE NOT FOUND (Waterbend has no Accounting site) |

## Access

Agent flows run on the flow owner's connections, not the manager's. The search only finds sites the connection account can open; in my run, 65 TruAmerica properties came back empty for that reason or because their URLs don't contain the Yardi code. For production we'll ask Lauren to set the connections up under an account that has access to all the Prop- sites. Once that's in place, the old Excel can be retired.

Let me know if you have any questions.

---

## Checklist: every step that used the Excel site address (added 2026-10-30)

From the 2026-10-26 flow export. Each must read `outputs('Site_URL')` instead of `first(body('List_rows_present_in_a_table')?['value'])?['FlowSiteURL']`. SharePoint steps call the box **Site Address**; Excel "Run script" steps call it **Location**.

| # | Step | Where it sits | Box |
|---|---|---|---|
| 1 | Get files (properties only) | top level | Site Address |
| 2 | Get Drive Id | Required Files Complete → True | Site Address |
| 3 | Make Results Folder | Required Files Complete → True | Site Address |
| 4 | List Old Reports | Required Files Complete → True | Site Address |
| 5 | Create Report | Required Files Complete → True | Site Address |
| 6 | Get file properties (delete if IDENTITY_CHECK step 11 was done) | Required Files Complete → True | Site Address |
| 7 | Get Report Link | Required Files Complete → True | Site Address |
| 8 | Run Review | Required Files Complete → True | Location |
| 9 | Read TB | Have TB → True | Location |
| 10 | Read BSSS | Have BSSS | Location |
| 11 | Read T12 | Have T12 | Location |
| 12 | Read BC | Have BC | Location |
| 13 | Read BS | Have BS | Location |
| 14 | Read GL | Have GL | Location |
| 15 | Read PM Fee | Have PM Fee | Location |
| 16 | Get BankRec PDF | Have BANKREC → Each BankRec PDF loop | Site Address |
| 17 | Get Mortgage PDF | Have MORTGAGE | Site Address |

Proof all are done: delete **List rows present in a table** and **Save draft**. If any step still points at it, the save is refused and the error names the step.
