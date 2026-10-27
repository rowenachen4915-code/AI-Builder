# Handoff — Property Accounting Review Tool suite

**Prepared:** 17 September 2026
**Last working session:** 5 September 2026
**Owner:** Rowena Chen — Property Accounting, Greystar
**Purpose of this document:** bring a new session fully up to speed before a second project is merged into this suite. Read it end to end before editing anything.

---

## 1. What this is

Six single-file HTML applications that automate month-end close review and AME reconciliation for property accounting. Each runs entirely client-side from a local file — **no network calls, no external dependencies, no data transmission of any kind.** That is not incidental; it is the security argument that makes internal distribution acceptable, and it is a hard constraint on every change. A dependency that needs a CDN, a fetch, or a server is not an option.

| Tool | Master file (current) | Does |
|---|---|---|
| Landing page | `Property_Accounting_Review_Tool_18.html` | Embeds and launches all five tools; shared SheetJS payload |
| AME Review — Yardi | `AME_Review_Yardi_15.html` | Ties AR, prepaid rent, security deposits, GPR lines, AP aging to the trial balance |
| AME Review — OneSite | `AME_Review_OneSite_5.html` | Reconciles a OneSite packet against itself, optionally to a TB |
| AME Review — Entrata | `AME_Review_Entrata_6.html` | Ties Entrata consolidated reports to a Yardi TB, with property scoping |
| Monthly Close Review | `Monthly_Close_Review_24.html` | BS tie-out, GL scrub, T12, budget variance, mortgage escrow, ruleset checks |
| TB Reconciliation & Xref | `TB_Recon_and_Xref_4.html` | Period-over-period TB recon with a multi-COA mapping library |

`_1`-style suffixes on any file are browser download de-duplication, not versions. Version numbering is per tool and does not move in lockstep; the landing page number is its own.

**Deployment:** SharePoint Online as a downloadable file (v1 strategy — SharePoint cannot serve these as live pages). Single canonical filename, in-tool version display rather than filename versioning, read-only permissions for accountants, users warned about the mark-of-the-web prompt. If hosted infrastructure ever becomes necessary the path is a D2AI intake, not an external platform. **External hosting and external backend services are out of scope and not to be proposed.**

---

## 2. Architecture

### File shell
Each tool is assembled from five parts, in order:

1. Shell HTML + CSS (fully variable-driven; see theming below)
2. Inlined SheetJS (community build)
3. Shared helpers script
4. Report registry + extraction script
5. Run/render + UI script

The landing page stores each tool as a `<script type="text/plain" id="tool-{name}">` payload plus one `<script type="text/plain" id="lib-sheetjs">` block. Each tool payload carries exactly one `/*__SHEETJS_LIB__*/` token where the library is spliced back in at launch. This de-duplication is why the landing page is ~1.7 MB instead of ~4.7 MB.

### Sentinel escaping (do not skip this)
Literal `</script`, `<script` and `<!--` inside a payload will break the browser's HTML tokenizer — specifically via the script-data → escaped → double-escaped state machine, where `</script` stops closing the block. Those three strings are therefore replaced with sentinels (`\u0001A\u0001`, `\u0001B\u0001`, `\u0001C\u0001`) in the stored payloads and unescaped on splice. Any new payload added to the landing page must go through the same escaping.

### Build invariants — verify all of these after every rebuild
- Every tool payload reconstructs **byte-for-byte** against its standalone source file.
- SheetJS appears exactly once in the landing page; exactly one splice token per tool payload.
- Tokenizer walk balances: script blocks opened == closed (currently 7/7).
- No literal `</script`, `<script`, `<!--` outside sentinels.
- Exactly one `plate-sig` div per tool; **zero** in the landing page shell. No `byline` anywhere.

`parsecheck.py` simulates the browser tokenizer states and catches unclosed script blocks before any browser test. Use it.

### Working method for edits
Do not edit the embedded app script in place. Extract it to `app.js`, edit, syntax-check with `node -e "new Function(fs.readFileSync('app.js','utf8'))"`, reassemble, then re-run the invariants. For Monthly Close Review this split/rebuild loop is mandatory — the file is large enough that in-place edits go wrong quietly.

### Theming
All five tools plus the landing page have light and dark palettes driven by 16–19 CSS custom properties, `[data-theme="dark"]` overrides, and a `@media (prefers-color-scheme:dark)` fallback. A masthead toggle stores an explicit choice in `localStorage`, wrapped in try/catch because a tool launched from the landing page runs in a document with no real origin where `localStorage` **throws**. Print rules re-declare the light values over `[data-theme="dark"]` so a review printed from a dark screen is legible. Contrast was measured, not eyeballed; nothing in the dark palette is below 4.5:1.

**Any new UI must resolve colour through the variables.** No named colours, no inline hex, no canvas fills.

---

## 3. The hard-won knowledge

This is the part that is expensive to rediscover.

### PDF extraction is the failure-prone layer
The extractor is hand-written (`PDFDoc`, ~1,400 lines in Monthly Close Review, with a ToUnicode CMap reader for subset fonts). Distinct root causes already found and fixed, each needing its own fix:

- Trailing newlines before `endstream` (Yardi) — over-trimming caused whole-page loss
- `endstream` appearing *inside* compressed page data — walk candidates, take the boundary yielding the most text
- Padded page streams after the deflate data ends (Entrata) — read output chunk by chunk or the browser decompressor discards the page
- Bracketed `/Filter [ /FlateDecode ]` not matching a single-value pattern (OneSite)
- CMap/Type0 fonts emitting raw glyph indices that pass every stream-decode check (Entrata)
- Invisible text layers (PNC)
- Compressed binary misread as plain text by testing for `(` instead of real text operators (`BT`/`Tj`/`TJ`)
- OneSite's `cm` page-scaling matrix — text operators must be composed through the full CTM before fragments are grouped into rows, or labels and amounts on one visual line end up hundreds of units apart

### Silent failure is the enemy
`pdfDiagnose` is a shared failure gate wired into all four PDF-capable tools. It classifies a failure as `not-pdf`, `encrypted`, `scanned`, `font-encoded`, `cmap-unsupported`, or `extractor-gap` and says so on screen, instead of producing "report not found" with a normal-looking page. `cmap-unsupported` exists specifically for Entrata's Type0 pattern and points the reviewer at Monthly Close Review, which is the only CMap-capable reader. All three AME readers count streams attempted vs. decoded (Entrata additionally counts `partial`), so a partly-decoded file **refuses rather than reporting a short figure.** A short figure that looks plausible is worse than a refusal.

### Yardi trial balance PDFs have no machine-readable column headers
Correct column layout is established **arithmetically**: prove `beginning + debits − credits = ending` across all account rows and take the layout with the highest agreement rate. Also: Yardi prints GL codes hard against descriptions with no separator (`11020-000Cash - Operating`), so the code cut is made at the modal code shape (digit width, separator, suffix width) derived from all lines in the document. Values like `0.00` and `-49,794.78` otherwise satisfy an account-code regex and must be excluded by detecting commas, leading signs, or a `0.` prefix.

Two Yardi TB producers exist: one emits code and name as separate text runs, the other emits them merged and needs the splitting pass. Both are handled. Yardi also has stacked vs. flattened column headings depending on export path — this caused a beginning-balance bug seen by other users but not locally.

### Property scoping in consolidated exports
**Entrata:** units of the subject property print bare; other properties' units carry a `propertycode-` prefix. The subject code is read from the TB header line formatted `Property Name (propertycode)`. Reports are parsed twice on rebuild — once with no known subject to identify the TB, then again with the subject known so property-specific scoring works. Longer property names must be tested before shorter ones or "Elan Memorial Park" matches inside "Elan Memorial Park Retail".

**OneSite:** fiscal periods print as six digits (e.g. `082026`) whose meaning depends on the owner's chart — calendar month on one, period N of a fiscal year on another. The convention must be resolved **once per packet** from corroborating evidence across all reports and the TB, then applied uniformly. The earlier per-report resolution assuming a July year-start silently read four of ten reports as the wrong month.

### Other format traps
- Format is sniffed from leading bytes, never from extension — Yardi ships HTML tables named `.xls`.
- Entrata `.xlsx` files pad the front with placeholder ZIP entries, so checking the first 4 KB for `[Content_Types].xml` fails. Check the first **and last** 64 KB (the central directory always lives at the end).
- Files are classified by content scoring against report fingerprints **before** any extraction, and role assignment is constrained to roles a file can actually fill.
- The bundled SheetJS community build silently drops all formatting on write, which is why the Excel export is a custom OOXML writer.

### Rulesets (Monthly Close Review)
Library currently covers Greystar Yardi (base), TA Realty Yardi, CBRE Yardi, MIG Yardi, Nuveen Yardi. Design decisions worth preserving:

- Inheritance via an `extends` field
- Coding rules, expected accruals and expected reclasses are **deliberately omitted** — they vary per close
- GL scrub scope (P&L and capex only) is per-ruleset, because account numbering differs by chart
- `tieoutExclude` governs the budget variance and T12 modules as well as tie-out
- `*prefix` syntax matches account suffixes (e.g. `*9999` for summary rows)
- `restrictedAccounts` rule type exists for the Nuveen capex check
- Net income tie-out uses the **balance sheet**, not the TB — Yardi posts current-year earnings at zero on the TB

### Testing discipline
Real packets are the calibration targets, not synthetic data: **flfusapa** (Yardi), **Broadstone Woodmill Creek / txparres** (OneSite), **Capriana** (Entrata), **Parkside Residences**, **610 West**, plus 149 mortgage statements across 26 servicers. Figures are verified to the penny against printed reports. Per-module unit suites are kept at full pass after every change. As of the last session: 7/7 PDF-slot, 16/16 gate, 7/7 period, flfusapa 6 of 6 measures tying, txparres 25 read / 0 skipped, Capriana 4 read with the June TB correctly refused.

---

## 4. Open items

Ordered roughly by value per unit of effort.

1. **Visual check of dark mode.** Verified structurally and numerically, never opened in a browser — the last session had Playwright but no Chromium. Open one tool, toggle, run a review, print a page. A palette can be arithmetically fine and still look wrong against sticky table headers.

2. **Bind `properties[]` to auto-select and a mismatch guard.** Currently decorative. This is the only open item that prevents a *wrong answer* (a false-green review built on the wrong client's COA) rather than a missing one. Do this before the client count grows.

3. **Port the tolerant `pdfInflate` chain.** State differs per tool — the older handoff got this wrong:
   - Monthly Close Review has the full chain (zlib-header drop, trailing-newline trim, chunked last resort)
   - Yardi and OneSite have the bare two-format loop → straight drop-in
   - Entrata has an `inflateTake` wrapper preferring the longest clean result → must be **woven into** that clean/partial contract, not pasted over it
   - TB Recon has no PDF code at all → nothing to port unless PDF TB input is wanted there

4. **Scale to ~30+ clients.** Every client runs an independent Yardi instance with its own COA, so `extends` inheritance buys nothing — all entries will be roots. Benchmarks show no computational ceiling (~1.35 KB per root, resolve time flat at 0.03–0.07 ms). The real risks are wrong-ruleset silent failures, an unusable 30-entry dropdown, and 30 independent calibration exercises. Mitigations: item 2 above, coverage scoring, a filter box replacing the grouped dropdown, and a bootstrapper that proposes ruleset fields from observed TB/GL data.

5. **pdf.js inlining — priced, not decided.** Obtainable build is `pdfjs-dist` 3.2.146 (UMD, easier to inline than 4.x/5.x ESM). Cost: 283 KB + 1,075 KB worker = **1.30 MB** modern, 1.42 MB legacy; landing page would go ~1.68 → ~2.94 MB. Two blockers were checked and cleared: neither file contains the three sentinel strings, and the worker self-registers via `globalThis.pdfjsWorker.WorkerMessageHandler` through `_setupFakeWorker`, so **no blob URL or network fetch is needed** — the `file://` constraint survives. Cost of the fake worker is main-thread parsing, so a 60-page packet freezes the UI unless chunked. Gain is narrow: Chase becomes readable (`CipherTransformFactory`/`PasswordException` are present), PGIM and Parkway likely improve, but Berkadia, Greystone and Rockland Trust stay OCR-only — no `/Font` objects means no text layer to recover. Roughly 20 of 26 servicers → 23, not 26. **Recommended shape if pursued:** pilot in Monthly Close Review only, run pdf.js as primary with the existing `PDFDoc` retained as fallback, port outward only if it wins on the calibration packets. The real work is not the inlining — `getTextContent()` returns positioned glyph runs, so the line-assembly layer is rewritten per tool. Everything above it survives.

---

## 5. Notes for integrating a second project

Anything merged into this suite has to clear the same bar the existing tools clear. Checklist for the incoming work:

- **Zero network.** No fetch, no CDN, no external font, no analytics. If a library is needed it gets inlined, and its size gets priced against the SheetJS de-duplication scheme.
- **Single file.** Shell + inlined libs + scripts, assembled in the order in §2.
- **Sentinel-safe.** Grep the incoming payload for `</script`, `<script`, `<!--` before it goes anywhere near the landing page.
- **Variable-driven CSS**, or dark mode and print will both break.
- **Classifier-first intake** and **byte-sniffed formats**, to match the rest of the suite's behaviour on real exports.
- **Loud failure.** Route any new extraction path through `pdfDiagnose` or an equivalent named-cause gate. No bare `catch(e){}`.
- **Corner mark:** a subtle `RC` `plate-sig` in each tool, explicitly absent from the landing page shell.
- **Rebuild-and-verify** every time: byte-for-byte payload reconstruction, `parsecheck.py`, then the invariant list.
- If the incoming project brings its own PDF reader, decide deliberately whether it replaces `PDFDoc`, falls back to it, or stays separate. Do not end up with two readers disagreeing silently on the same file.

Open question for whoever picks this up: whether the second project joins as a sixth embedded tool behind the landing page, or stays standalone and is only linked. That decision drives whether its libraries need de-duplicating and whether its version number enters the landing page's rebuild cycle.

---

## 6. Tooling available in a working session

- **SheetJS** (community build, inlined) — workbook parsing in all tools
- **Hand-written `PDFDoc`** — PDF text extraction; ToUnicode CMap reader for subset fonts
- **Node.js** — syntax checks via `new Function`, test harnesses, engine extraction, stress tests. Calling a function defined inside a sandboxed context needs `vm.runInContext('fnName', ctx)(args)`; direct property access does not work for `function` declarations in evaluated scripts.
- **Python** — `parsecheck.py` tokenizer simulation, file inspection, payload sizing
- **Playwright / Puppeteer** — end-to-end browser tests when a browser is actually present (it often isn't; say so rather than implying a visual check happened)
- Container network is typically restricted. `github.com` has been reachable; release assets, npm and browser CDNs have not.
