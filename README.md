# Internal Review Agent

Office Scripts review engine for Greystar's Accounting Manager Internal Review Agent (Copilot Studio + Power Automate).

**Start with `CLAUDE.md`** (how it works, constraints, design decisions), then `TASKS.md` (the backlog).

```
npm install
npm test          # expect: 93 passed, 0 failed
npm run calibrate # expect: mn610wes 07-2026 R1: Review Complete - 3 exception(s), 44 warning(s), 58 to monitor, 85 passed. Awaiting manager decision.
```

Deploying a script: open Excel Online → Automate → the script → select all → paste the file from `scripts/` → Save. If `main()`'s parameters changed, re-pick the script in its Power Automate step so the input boxes refresh.

`calibration/` holds real client financial data including bank statements. Keep this repository private.
