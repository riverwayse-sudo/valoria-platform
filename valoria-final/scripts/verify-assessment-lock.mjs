import {
  computeFingerprint,
  isLockActive,
} from '../src/assessmentLock.js';

const name = 'Test User';
const role = 'Director';
const fp = computeFingerprint(name, role);
const expiresAt = new Date();
expiresAt.setFullYear(expiresAt.getFullYear() + 1);

const lock = { fingerprint: fp, expiresAt: expiresAt.toISOString() };
const otherFp = computeFingerprint('Other', 'Role');

const results = [
  { test: 'same identity locked', pass: isLockActive(lock, fp) === true },
  { test: 'different identity not locked', pass: isLockActive(lock, otherFp) === false },
  { test: 'empty fingerprint not locked', pass: isLockActive(lock, null) === false },
  { test: 'expired lock inactive', pass: isLockActive({ fingerprint: fp, expiresAt: '2020-01-01T00:00:00.000Z' }, fp) === false },
];

const failed = results.filter((r) => !r.pass);
if (failed.length) {
  console.error('FAILED', failed);
  process.exit(1);
}
console.log(JSON.stringify({ sessionId: '58432b', runId: 'post-fix-node', results }));
