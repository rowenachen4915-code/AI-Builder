// Compiles each Office Script on its own, the way Excel Online does: every script is a standalone
// program with its own main() and helpers, so they cannot be compiled together (their helper
// names collide). Output goes to build/<name>/s.js, which the test harness loads.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const tsc = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc');
const tscCmd = fs.existsSync(tsc) ? tsc : 'tsc';
const types = path.join(ROOT, 'types', 'excelscript.d.ts');
let failed = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'scripts')).filter(x => x.endsWith('.ts')).sort()) {
  const name = f.replace(/\.ts$/, ''), out = path.join(ROOT, 'build', name);
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'scripts', f), path.join(out, 's.ts'));
  try {
    execFileSync(tscCmd, ['--target', 'es2019', '--strict', '--noImplicitAny', '--lib', 'es2019', types, path.join(out, 's.ts'), '--outDir', out], { stdio: 'pipe', shell: process.platform === 'win32' });
    console.log(`ok     ${name}`);
  } catch (e) { failed++; console.log(`FAILED ${name}\n${(e.stdout || '').toString()}${(e.stderr || '').toString()}`); }
}
if (failed) { console.log(`\n${failed} script(s) failed to compile`); process.exit(1); }
