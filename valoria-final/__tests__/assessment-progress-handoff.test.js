import fs from 'node:fs';
import path from 'node:path';

describe('assessment progress handoff verification', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'api/assessment-progress.js'), 'utf8');

  test('restore and save use the canonical Node handoff verifier', () => {
    expect(source).toContain('runtime: "nodejs"');
    expect(source).toContain('../lib/valu-handoff-token.js');
    expect(source).not.toContain('valu-handoff-token-edge');
    expect(source).toContain('verifyValuHandoffToken(handoffToken, tasterId)');
  });

  test('restore retains snapshot ownership and identity checks after token verification', () => {
    expect(source).toContain('resolvedIdentity.user_id !== handoff.sub');
    expect(source).toContain('resolveTasterIdentity(tasterId)');
    expect(source).toContain('progress.identity_hash !== `valu_progress_${tasterId}`');
  });
});
