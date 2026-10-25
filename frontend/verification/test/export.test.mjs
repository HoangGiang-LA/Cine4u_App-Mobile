import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareExport} from '../compare-export.mjs';
const seed = {categories: {vocabulary: {status: 'published'}}, questionAnswers: {q: {v1: {correctOptionId: 'a'}}}};
test('matches static fields while accepting additional runtime records and new content', () => {
  const actual = structuredClone(seed); actual.users = {alice: {displayName: 'Private User'}}; actual.categories.new = {status: 'draft'};
  const report = compareExport(actual, seed);
  assert.equal(report.status, 'MATCH'); assert.deepEqual(report.additionalRootNames, ['users']);
  assert(!JSON.stringify(report).includes('Private User'));
});
test('reports missing roots and changed paths without showing secret answer values', () => {
  const report = compareExport({questionAnswers: {q: {v1: {correctOptionId: 'SECRET_ANSWER'}}}}, seed);
  assert.equal(report.status, 'REVIEW_REQUIRED'); assert.deepEqual(report.missingRoots, ['categories']);
  assert.equal(report.differenceCount, 2); assert(!JSON.stringify(report).includes('SECRET_ANSWER'));
});
test('finds credential fields without printing their contents and rejects malformed exports', () => {
  const actual = structuredClone(seed); actual.users = {alice: {password: 'never-print-this'}};
  const report = compareExport(actual, seed);
  assert.equal(report.status, 'REVIEW_REQUIRED'); assert.deepEqual(report.credentialFieldPaths, ['/users/alice/password']);
  assert(!JSON.stringify(report).includes('never-print-this'));
  assert.throws(() => compareExport([], seed), /root/);
});
