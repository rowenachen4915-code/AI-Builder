// Mock of the ExcelScript API, just enough for these scripts to run under Node.
// It is NOT the real Excel runtime: it models ranges, values, formulas and tables only.
// If a script starts calling an ExcelScript method not mocked here, add it here AND to types/excelscript.d.ts.
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures');

function mockWb(data) {
  const tables = {};
  const rng = (s, r, c, rc, cc) => ({
    getValues: () => s.vals.slice(r - s.r0, r - s.r0 + rc).map(x => x.slice(c - s.c0, c - s.c0 + cc)),
    // Real getFormulas() returns the formula text for formula cells and the literal value for constants.
    getFormulas: () => (s.forms || s.vals).slice(r - s.r0, r - s.r0 + rc).map(x => x.slice(c - s.c0, c - s.c0 + cc)),
    getRowIndex: () => r, getColumnIndex: () => c,
    setValues: v => { v.forEach((row, i) => { while (s.vals.length <= r + i) s.vals.push([]); row.forEach((x, j) => { const R = s.vals[r + i]; while (R.length <= c + j) R.push(""); R[c + j] = x; }); }); },
    setValue(v) { this.setValues([[v]]); },
    getFormat: () => ({ getFont: () => ({ setBold() {} }), autofitColumns() {} }),
    setNumberFormatLocal() {},
  });
  const sheet = n => { const s = data[n]; return {
    getName: () => n,
    getUsedRange: () => s.vals.length ? rng(s, s.r0, s.c0, s.vals.length, s.vals[0].length) : undefined,
    getRange: () => rng(s, 0, 0, 0, 0),
    getRangeByIndexes: (r, c, rc, cc) => rng(s, r, c, rc, cc),
    getCell: (r, c) => rng(s, r, c, 1, 1),
    addTable: () => { const t = { rows: [], setName(nm) { tables[nm] = t; }, addRows(i, v) { t.rows.push(...v); }, resize() { t.resized = true; } }; return t; },
  }; };
  // The findings tables that exist in report template v2.0 (see tools/build_template.py).
  ['tblBSSS', 'tblBankRec', 'tblT12', 'tblBudget', 'tblGL', 'tblPMFee', 'tblOther', 'tblSourceFindings', 'tblAllResults']
    .forEach(t => tables[t] = { resize() { this.resized = true; } });
  return {
    getWorksheets: () => Object.keys(data).map(sheet),
    getWorksheet: n => data[n] ? sheet(n) : undefined,
    addWorksheet: n => { data[n] = { r0: 0, c0: 0, vals: [] }; return sheet(n); },
    getTable: n => tables[n], _tables: tables, _data: data,
  };
}

/** Runs a compiled script's main() exactly as Power Automate would: workbook first, then the parameters. */
function run(script, wb, ...args) {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'build', script, 's.js'), 'utf8'), ctx);
  return vm.runInContext('main', ctx)(wb, ...args);
}
const load = f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const readFixture = f => fs.readFileSync(path.join(FIX, f), 'utf8');
function template() { const d = load('template.json'); for (const k in d) { d[k].r0 = 0; d[k].c0 = 0; } return mockWb(d); }
module.exports = { mockWb, run, load, readFixture, template, ROOT };
