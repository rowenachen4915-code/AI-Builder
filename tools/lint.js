// Checks for Office Scripts rules that plain TypeScript does not enforce, each of which was hit during the build.
// Excel Online rejects a script that breaks them, usually with an unhelpful message, so catch them here first.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const rules = [
  { re: /\.(map|filter|forEach|some|every|reduce|sort|find|findIndex|flatMap)\(\s*[A-Za-z_$][\w$]*\s*[,)]/, msg: 'Array callbacks must be arrow functions: write .map(x => f(x)), not .map(f)' },
  { re: /:\s*any\b|<any>|as any\b/, msg: 'Office Scripts does not allow the any type' },
  { re: /^\s*(import|export)\s/, msg: 'Office Scripts cannot import or export; each script must be self-contained' },
  { re: /^(const|let|var)\s/, msg: 'Avoid top-level variables; put values inside main() or a function' },
  { re: /r2\(\s*[\w.]*[Rr]ate\s*(\/\s*100)?\s*\)/, msg: 'Never round a rate to 2 decimals (0.0225 becomes 0.02); use r4 or no rounding' },
];
let n = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'scripts')).filter(x => x.endsWith('.ts'))) {
  const src = fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8');
  if (!/function main\(workbook: ExcelScript\.Workbook/.test(src)) { n++; console.log(`${f}: missing function main(workbook: ExcelScript.Workbook, ...)`); }
  src.split('\n').forEach((line, i) => rules.forEach(r => { if (r.re.test(line) && !/\/\/\s*lint-ok/.test(line)) { n++; console.log(`${f}:${i + 1}: ${r.msg}\n    ${line.trim().slice(0, 110)}`); } }));
}
console.log(n ? `\n${n} problem(s)` : 'lint: no problems');
process.exit(n ? 1 : 0);
