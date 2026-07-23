#!/usr/bin/env node
/* Contrôle de syntaxe SURO — pensé pour le no-build.
 *
 * Piège connu : `node --check fichier.js` parse en CommonJS et NE DÉTECTE PAS
 * certaines erreurs de syntaxe propres aux modules ES. C'est exactement ce qui
 * a laissé passer l'« écran blanc » (ternaire malformé dans ops/src). On force
 * donc l'analyse des modules ES (ops/src) en tant que modules (.mjs).
 *
 *   - ops/src/**  → modules ES  → vérifiés en mode module
 *   - js/**, app/js/** → scripts navigateur classiques → vérifiés en mode script
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, copyFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const walk = (dir, acc = []) => {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return acc; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (/\.(mjs|js)$/.test(e)) acc.push(p);
  }
  return acc;
};

const tmp = mkdtempSync(join(tmpdir(), 'suro-syntax-'));
let count = 0;
let failed = 0;

const check = (file, asModule) => {
  count += 1;
  let target = file;
  if (asModule && file.endsWith('.js')) {
    // node --check respecte l'extension : on force le mode module via .mjs
    target = join(tmp, `m${count}.mjs`);
    copyFileSync(file, target);
  }
  try {
    execFileSync(process.execPath, ['--check', target], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    const msg = (err.stderr || err.message || '').toString().split('\n').slice(0, 4).join('\n');
    console.error(`FAIL  ${file}\n${msg}\n`);
  }
};

// Modules ES (portail ops) — analysés comme modules
for (const f of walk('ops/src')) check(f, true);
// Scripts navigateur classiques — analysés comme scripts
for (const dir of ['js', 'app/js']) for (const f of walk(dir)) check(f, false);

console.log(`${count - failed}/${count} fichiers sans erreur de syntaxe`);
process.exit(failed ? 1 : 0);
