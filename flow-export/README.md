# Flow export

`ValidateFlow_published_2026-10-26.json` is the definition of the agent flow **Validate Flow** (formerly "Validate Internal Review Packages") as published 2026-10-26 21:58, exported from the solution `Internal Review Flow Backup` on 2026-10-27. It is a backup and a reference for writing flow instructions against the real step names. It is not deployed from here; the flow is edited in Copilot Studio.

Trigger inputs at that point: `text` = PropertyCode, `text_1` = ReviewPeriod, `text_2` = RequesterEmail. `AcceptedCode` (`text_3`) and `AcceptedPeriod` (`text_4`) were added in a draft on 2026-10-27 and are not in this export.

Findings from reading it (2026-10-27):
- **Have GL tests the wrong filter:** its condition is `length(body('Filter_BC')) = 1`, not `Filter_GL`. A folder with a GL but no single Budget Comparison skips the GL read; a folder with a Budget Comparison but no GL makes Read GL fail.
- **Get file properties is unused:** Build Results Card takes the link from Get Report Link. Get file properties can be deleted.
- **Sources JSON BANKREC line** is the original one (Multiple Versions when there are several PDFs). Script 04 already treats several bank recs that were all read as Found; the newer line in `docs/flow_sources_json_expression.txt` only improves the wording.
- **Respond to the agent's Note** always says "Review started" (TASKS T17).
