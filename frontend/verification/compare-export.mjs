import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJson, root} from './check.mjs';

export function compareExport(exported, seed) {
  if (!exported || typeof exported !== 'object' || Array.isArray(exported)) throw new Error('Export must be a JSON object from the database root.');
  const differences = [], credentialPaths = [];
  let differenceCount = 0;
  function compare(expected, actual, location) {
    if (expected && typeof expected === 'object') {
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) { differenceCount++; if (differences.length < 100) differences.push({path: location, issue: 'missing_or_wrong_shape'}); return; }
      for (const [key, value] of Object.entries(expected)) compare(value, actual[key], `${location}/${key}`);
    } else if (expected !== actual) { differenceCount++; if (differences.length < 100) differences.push({path: location, issue: actual === undefined ? 'missing' : 'different_value'}); }
  }
  function scanKeys(value, location = '') {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      const current = `${location}/${key}`;
      if (/^(password|passwordHash|passwordSalt|private_key|refreshToken|idToken|serviceAccountKey)$/i.test(key) && credentialPaths.length < 100) credentialPaths.push(current);
      scanKeys(child, current);
    }
  }
  for (const [key, expected] of Object.entries(seed)) compare(expected, exported[key], `/${key}`);
  scanKeys(exported);
  const staticRoots = Object.keys(seed);
  return {status: differenceCount === 0 && credentialPaths.length === 0 ? 'MATCH' : 'REVIEW_REQUIRED',
    provenance: 'user_supplied_export_not_a_live_connection_test', staticRootsCompared: staticRoots,
    missingRoots: staticRoots.filter(key => !(key in exported)), differenceCount, differencePaths: differences,
    additionalRootNames: Object.keys(exported).filter(key => !(key in seed)), credentialFieldPaths: credentialPaths,
    notes: ['Only expected static seed fields are compared. Additional content and runtime records are preserved.', 'Reports contain paths and issue types, never private record values or answer text.', 'Differences may be intentional edits; do not re-import the root to repair them.']};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const supplied = process.argv[2];
  if (!supplied) { console.error('Usage: npm run compare:export -- "exports/firebase-export.json"'); process.exitCode = 2; }
  else {
    try {
      const input = path.resolve(supplied);
      if (input === path.join(root, 'Backend/database/english-battle.seed.json')) throw new Error('Use a real Console export, not the local seed as both inputs.');
      const report = compareExport(JSON.parse(fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '')), readJson('Backend/database/english-battle.seed.json'));
      console.log(JSON.stringify({...report, exportFileModifiedAt: fs.statSync(input).mtime.toISOString()}, null, 2));
      process.exitCode = report.status === 'MATCH' ? 0 : 1;
    } catch (error) { console.error(error.message); process.exitCode = 2; }
  }
}
