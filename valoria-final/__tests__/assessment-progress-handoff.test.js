import fs from 'node:fs';
import path from 'node:path';

describe('assessment progress handoff verification', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'api/assessment-progress.js'), 'utf8');

  test('restore and save use the Edge Web Crypto verifier with the shared site token contract', () => {
    expect(source).toContain('runtime: "edge"');
    expect(source).toContain('../lib/valu-handoff-token-edge.js');
    expect(source).toContain('await verifyValuHandoffTokenEdge(handoffToken, tasterId)');
    expect(source).not.toContain('node:crypto');
  });

  test('restore retains snapshot ownership and identity checks after token verification', () => {
    expect(source).toContain('resolvedIdentity.user_id !== handoff.sub');
    expect(source).toContain('resolveTasterIdentity(tasterId)');
    expect(source).toContain('progress.identity_hash !== `valu_progress_${tasterId}`');
  });
});
