# Handoff — AME Review Tools (Yardi · OneSite · Entrata)

**Prepared:** 19 September 2026
**Last working session on these tools:** 5 September 2026
**Owner:** Rowena Chen — Property Accounting, Greystar
**Scope:** the three AME Review tools only. The Monthly Close Review, TB Recon & Xref, and the landing-page bundle are referenced where they interact, but are not documented here.

This document is written to be loaded as standing context. It is descriptive, not conversational — read it end to end before changing code.

---

## 0. Orientation in ten lines

- Three browser tools, one per property management system, each a **single self-contained HTML file**.
- Each reads a month-end close packet (PDF / Excel / HTML / CSV / ZIP) and ties figures to a **Yardi trial balance**.
- **Zero network.** No fetch, no CDN, no backend, no telemetry. This is a hard constraint, not a preference.
- Distribution is a SharePoint download. Users open the file from disk (`file://`).
- Files are identified by **content**, never by filename or extension.
- Extraction failures must be **loud and named**, never silent or partial.
- All three share a hand-written PDF extractor (`PDFDoc`) and a failure gate (`pdfDiagnose`).
- Calibration is done against **real packets**, not synthetic data. Synthetic data has never caught the bugs that mattered.
- Output is a pass/fail per tie-out with the specific variance, not a report the reviewer has to interpret.
- Findings prompt professional judgement; they are not conclusions. The UI says so.

---

## 1. Current masters

| Tool | Master file | Reads | Ties to |
|---|---|---|---|
| AME Review — Yardi | `AME_Review_Yardi_15.html` | 5 Yardi reports + TB | Yardi TB |
| AME Review — OneSite | `AME_Review_OneSite_5.html` | ~6–10 OneSite reports (zip or loose) + optional TB | Comparison worksheet, then TB |
| AME Review — Entrata | `AME_Review_Entrata_6.html` | 5 Entrata reports + TB | Yardi TB |

All three are also embedded in `Property_Accounting_Review_Tool_18.html` (the landing page), with SheetJS de-duplicated into one shared payload. **Any change to a tool requires a landing-page rebuild**, or the bundle silently ships a stale copy.

`_1`-style filename suffixes are browser download de-duplication, not version numbers. Versions move per tool, not in lockstep.

---

## 2. What each tool actually ties

### 2.1 Yardi

**Inputs:** Aged Receivables, Rent Roll, GPR (Gross Potential Rent), Security Deposit Activity, AP Aging, Trial Balance. Accepts PDF, Excel, HTML-named-`.xls`, CSV, or a ZIP of any of those.

**Tie-outs:**

| # | Check | Against |
|---|---|---|
| 1 | Accounts receivable | TB ending balance |
| 2 | Prepaid rent | TB ending balance |
| 3 | Rent Roll market rent ↔ GPR market rent | each other |
| 4 | GPR market rent | TB current-month activity |
| 5 | GPR gain/loss to lease | TB current-month activity |
| 6 | GPR concessions | TB current-month activity |
| 7 | GPR vacancy | TB current-month activity |
| 8 | GPR model / non-revenue units | TB current-month activity |
| 9 | GPR bad debt / write-offs | TB current-month activity |
| 10 | Security deposits on TB | deposits-on-hand column |
| 11 | AP aging total | TB ending balance |

**Structural facts learned from real packets — do not "fix" these:**

- **Prepaid rent lives on the Aged Receivables report**, not a separate file. There is no prepaid report to ask for.
- **Deposits on hand ≠ rent roll deposits**, by design. The difference is move-out refunds pending. Tying rent roll deposits to the TB produces a false break.
- The **GPR report carries two market rent totals**. Column selection matters; picking the wrong one is silently plausible.
- Checks 4–9 only hold **after the GPR journal entry has posted**. Before posting, the tool should report the GPR block as not-yet-applicable rather than failing it.

**Dual purpose.** The tool is used at close *and again during financials review*, to confirm nothing has been posted to the tied accounts after the AME. Any change that assumes a single point-in-time run breaks the second use case.

### 2.2 OneSite

**Input:** one drop — a zip packet or loose files. Optional trial balance.

**Stage 1 — internal consistency.** Nine comparison-worksheet rows sourced across six reports:

| Row | Sourced from |
|---|---|
| Gross Market Rent | Monthly Transaction Summary, Reconciliation Summary |
| Resident Deposits In | Resident Deposit Activity, Monthly Transaction Summary |
| Resident Deposits Out | Resident Deposit Activity, Monthly Transaction Summary |
| Total Deposits on Hand | Resident Summary Balances |
| Total Bank Deposits | Bank Deposit Summary |
| Beginning Delinquency | Delinquent and Prepaid |
| Ending Delinquency | Delinquent and Prepaid, Resident Summary Balances |
| Beginning Prepaid | Delinquent and Prepaid |
| Ending Prepaid | Delinquent and Prepaid, Resident Summary Balances |

**Two documented reconciling rules, both implemented:**

1. If Gross Market Rent differs between the Monthly Transaction Summary and the Reconciliation Summary, the difference must equal **"Adjust Prior Gross Market Rent"** under LESS ADJUSTMENTS on the MTS. If it does, that is a pass, not a break.
2. The **Delinquent and Prepaid report grosses** residents who are simultaneously prepaid and delinquent; every other report nets them. The resulting difference is predictable and explainable — the tool computes and displays it rather than flagging it.

**Stage 2 — TB tie-out, exactly eight lines.** AR, Prepaid, Security Deposits (to ending balance); Gross Market Rent, Loss to Lease, Gain to Lease, Vacancy, Model (to current-month activity). The scope was deliberately narrowed to these eight. **Do not reintroduce a sweep over every account in the OneSite entry** — that was removed on purpose.

**Gain/loss to lease account grouping.** On most charts both post to a single TB account (41010). Tying each separately against one account yields two false breaks on a correct entry. The tool groups lines by *resolved TB account* and ties them jointly, displaying components underneath — while still supporting split-account charts when the rules panel maps them separately.

### 2.3 Entrata

**Inputs:** Monthly Reconciliation, GPR, Resident Aged Receivables, Resident Deposit Audit, Rent Roll — plus a **Yardi** trial balance (Entrata is the PM system; the books are still Yardi).

**Seven tie-outs:** Aged Receivables, Prepaid Rent, Security Deposits → TB ending balance. Market Rent, Gain/Loss to Lease, Vacancy, Model → TB current-month activity.

**Supporting checks:** deposit audit roll-forward footing, deposit movement vs. ledger activity, beginning-balance comparison, cash variance, GPR internal consistency.

**Property scoping is the defining problem.** Entrata packets are frequently **consolidated across multiple properties** (residential plus retail), while the TB covers one property. The resolution:

- Read the subject property code from the TB header, formatted `Property Name (propertycode)`.
- Filter rows by unit prefix, Property Name column, or tab name — **never by grand total**.
- In consolidated exports, the subject property's units print **bare**; other properties' units carry a `code-` prefix (e.g. `txelare2-6011`).
- Reports are parsed **twice** during rebuild: once with no known subject to identify the TB, then again with the subject known so property-specific scoring works.
- On printed Monthly Reconciliation PDFs, property names lead each account line. **Test longer names before shorter ones** or "Elan Memorial Park" matches inside "Elan Memorial Park Retail".

---

## 3. Architecture

### 3.1 Assembly

Each tool concatenates five parts, in order:

1. Shell HTML + CSS (fully variable-driven)
2. Inlined SheetJS (community build)
3. Shared helpers script
4. Report registry + extraction script
5. Run/render + UI script

The landing page stores each tool as a `<script type="text/plain" id="tool-{name}">` payload plus one `<script type="text/plain" id="lib-sheetjs">` block. Each tool payload carries exactly one `/*__SHEETJS_LIB__*/` token where the library is spliced back in at launch.

### 3.2 Sentinel escaping — do not skip

A literal `</script`, `<script`, or `<!--` inside a payload breaks the browser's HTML tokenizer via the script-data → escaped → double-escaped state machine, at which point `</script` stops closing the block. All three sequences must be sentinel-escaped in embedded payloads and restored at splice time.

### 3.3 Intake: classifier first

Every file is classified by **what it says about itself** before any extraction is attempted:

- Format sniffed from leading **and trailing** bytes. (Entrata `.xlsx` files pad the front with placeholder ZIP entries, so checking the first 4096 bytes for `[Content_Types].xml` fails. Check the first 65536 **and** the last 65536, where the ZIP central directory lives.)
- Report identity from title text, column fingerprints, and row shape.
- Filename and extension are never trusted. Yardi ships HTML tables named `.xls`.

### 3.4 Failure gating: `pdfDiagnose`

Shared across all three tools. Classifies a PDF failure into a named cause rather than returning empty:

`not-pdf` · `encrypted` · `scanned` · `font-encoded` · `cmap-unsupported` · `extractor-gap`

Stream counting (attempted vs. decoded; Entrata also counts `partial`) is wired into all three readers so a **partially decoded file refuses rather than reporting short**. A short-but-plausible number is the worst possible output in this domain.

`cmap-unsupported` points the reviewer at the Monthly Close Review, which carries the ToUnicode CMap reader.

### 3.5 PDF extraction — `PDFDoc`

Hand-written, roughly 1,400 lines, with ToUnicode CMap support. **pdf.js was evaluated, priced at ~1.30 MB, and deliberately deferred** — it was never inlined. `PDFDoc` is the extractor everywhere.

Known producer quirks, all load-bearing:

- **Yardi:** a trailing newline before `endstream` breaks naive decompressors. Over-trimming it loses whole pages.
- **Yardi:** GL codes abut descriptions with no separator (`11020-000Cash - Operating`). Greedy matching misreads `24010-0001st Mortgage Payable` as account `24010-0001`. Fix: derive the **modal code shape** (digit width, separator, suffix width) across the document and cut at exactly that width.
- **Yardi:** values like `0.00` and `-49,794.78` satisfy a naive account-code regex. Exclude on commas, leading signs, or a `0.` prefix.
- **Yardi:** PDF trial balances have **no machine-readable column headers**. `parseTBLines` identifies layout **arithmetically** — proving beginning + debits − credits = ending across account rows and selecting the layout with the highest agreement rate.
- **Yardi:** total lines emit **no whitespace between columns**. Whitespace splitting fails; use currency-token parsing.
- **Yardi:** grand total rows are identified arithmetically, not by label.
- **Yardi:** stacked multi-row column headers require join-before-match. There are two export paths (stacked vs. flattened) and they detect differently.
- **Entrata:** the literal string `endstream` appears inside compressed page data. Walk forward through candidate boundaries and pick the one yielding the most text.
- **Entrata:** page streams are padded after the deflate data ends, which makes the browser decompressor discard whole pages. Read output chunk by chunk.
- **Entrata:** a guard testing for `(` misidentified compressed binary as uncompressed text. Test for real PDF text operators (`BT` / `Tj` / `TJ`).
- **OneSite:** PDFs use a `cm` matrix to scale the page. Text operators must be composed through the **full current transformation matrix** before fragments are grouped into rows, or labels and amounts on the same visual line land hundreds of units apart and get split.
- **OneSite:** transaction codes print twice on the Monthly Transaction Summary — once in the code table with three figures, once in the GL entry with two. An **exact-token-count guard** isolates the right occurrence for deposit in/out sums.
- **OneSite:** the bracketed form `/Filter [ /FlateDecode ]` was not being recognised by the stream counter. Fixed; watch for it in any new reader.

Cell reconstruction from PDFs uses **physical x-position geometry** — right-edge anchoring for numeric columns, figures defining column boundaries. Whitespace splitting does not work on Yardi or Entrata exports.

### 3.6 OneSite period convention — resolve once per packet

OneSite prints fiscal periods as six digits (`082026`). The meaning depends on the owner's chart: **calendar month on one chart, period N of a fiscal year on another.** Earlier code assumed a July year-start and converted per report, which read four of ten reports in the Broadstone Woodmill Creek packet as February 2026 instead of August 2026. Only reports that also printed an "as of" date were caught by the existing cross-check.

The fix: **resolve the convention once per packet** from corroborating evidence across all reports and the trial balance, then apply it uniformly. A 7/7 unit suite covers both conventions, including the `022027` → August 2026 case.

### 3.7 Theming

CSS custom properties (16–19 per tool), a `[data-theme="dark"]` override block, and a `@media (prefers-color-scheme:dark)` rule. A Dark/Light toggle stores an explicit choice in `localStorage`, wrapped in try/catch for `file://` origins. **Print blocks re-declare light values.** Any hard-coded colour breaks dark mode, print, or both.

### 3.8 Rules panels

Each tool has an account-mapping rules panel with JSON import/export. Rules live in a file the user controls; nothing is transmitted. Account numbers differ across owner charts, so no mapping is hard-coded.

---

## 4. Calibration packets

Real data only. Each of these caught a bug that synthetic data did not:

| Packet | System | Caught |
|---|---|---|
| `flfusapa` (Fusion Apartments) | Yardi | Phantom packet splits, GL code de-gluing, arithmetic TB column detection |
| `610 West` | Yardi | `endstream` newline bug, no-whitespace total lines, dual GPR market rent totals |
| `txparres` / Broadstone Woodmill Creek | OneSite | Bracketed `/Filter` stream counting; period-convention bug (present but undetected in txparres) |
| Parkside Residences | OneSite | Comparison worksheet logic, `cm` matrix scaling, duplicate transaction codes |
| Capriana | Entrata | CMap/Type0 fonts emitting raw glyph indices past every prior check |
| `txelame2` (Elan Memorial Park) | Entrata | Consolidated multi-property scoping; surfaced a real 257.40 employee unit discount variance |

---

## 5. Test and build discipline

**Before any file is handed over:**

1. Syntax-check each extracted `<script>` block: `node -e "new Function(scriptText)"`.
2. Run `parsecheck.py` — simulates the browser HTML tokenizer to catch script blocks that never close.
3. Rebuild the landing page and verify **byte-for-byte** that every embedded tool matches its source file. Hash them; do not assume.
4. Run the unit suite for the touched area (typically 7/7 or larger).
5. Run Playwright/Puppeteer end-to-end tests **when a browser is actually present**. It often is not — say so plainly rather than implying a visual check happened.
6. Re-run the relevant calibration packet and confirm figures to the penny.

Test suites verify **cell-for-cell parity** between formats of the same report, and **correct refusal** of encrypted, CMap-unsupported, and non-tabular inputs. Refusal cases are as important as success cases.

**Node harness note:** calling a function defined inside a sandboxed context requires `vm.runInContext('fnName', ctx)(args)`. Direct property access does not work for `function` declarations in evaluated scripts.

---

## 6. Hard constraints

Non-negotiable. A change that violates any of these does not ship.

1. **Zero network.** No fetch, no CDN, no external font, no analytics, no backend service. This is the security argument that makes internal distribution acceptable.
2. **Single file.** Each tool is one HTML file that works from `file://` with no sidecar assets.
3. **No external hosting.** SharePoint download is v1. If hosted infrastructure ever becomes necessary the path is a **D2AI intake** — Greystar's internal Data, Digital & AI group. External platforms are out of scope and are not to be proposed.
4. **Sentinel-safe payloads.**
5. **Variable-driven CSS.**
6. **Classifier-first intake, byte-sniffed formats.**
7. **Loud failure.** Every extraction path goes through `pdfDiagnose` or an equivalent named-cause gate. No bare `catch(e){}`.
8. **A subtle `RC` corner mark** in each tool; explicitly absent from the landing page shell.
9. **No AI in the tools.** The engines are deterministic and rules-based. A reviewer must be able to explain any figure the tool produces by pointing at a rule.

---

## 7. Open items

- **`pdfInflate` tolerant fallback** is ported across three tools in three distinct states, not uniformly. Normalising it is unfinished.
- **Landing-page rebuild cadence.** Any AME tool change invalidates bundle 18.
- **Ruleset scale UX** — a filter box in place of the grouped dropdown once entries exceed ~30. Affects the Monthly Close Review most, but the AME rules panels share the pattern.
- **Wrong-ruleset silent failure** is the top risk at portfolio scale: a false-green review built on the wrong chart of accounts. Coverage scoring and a mismatch guard bound to the `properties[]` field are the intended mitigations; `properties[]` is still decorative.

---

## 8. Notes for an agent implementation

If these tools are wrapped in or reimplemented as an agent, the following are the parts that carry the real value and the real risk.

**What must not be delegated to a model:**

- The tie-out arithmetic. Every figure must trace to a deterministic rule a reviewer can point at. A model producing a variance number is not auditable.
- The pass/fail decision. The threshold logic is the product.

**What a model can reasonably do:**

- Classify an unfamiliar report into a known report type when the fingerprint is ambiguous — with the deterministic classifier retained as the primary path and the model used only as a tiebreak that is **labelled as such** in the output.
- Explain a variance in prose once the deterministic engine has computed it.
- Propose rules-panel account mappings from an observed chart of accounts, for human confirmation before use. (This is the "bootstrapper" idea already on the list.)

**Constraints that will bite immediately:**

- **Zero network is incompatible with a hosted model call.** An agent that sends packet contents anywhere is a different product with a different approval path. Resident financial data leaving the browser is the exact thing the current architecture was built to avoid. Treat this as a governance question to raise before writing code, not an implementation detail.
- The extraction layer is roughly 1,400 lines of producer-specific PDF handling that took several sessions and six real packets to get right. It is portable as-is; rewriting it against a new runtime means re-earning every quirk in §3.5.
- The calibration packets are the regression suite. Any reimplementation must reproduce the same figures on all six before it is trusted.

**Fastest path to an agent-shaped version, if pursued:** keep `PDFDoc` and the tie-out engines intact as a deterministic core, expose them as callable functions, and let the agent layer handle intake routing, narration, and follow-up questions. The core stays auditable; the agent handles the parts that are genuinely conversational.
