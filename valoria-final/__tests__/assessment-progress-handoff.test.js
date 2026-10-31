import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomUUID } from 'node:crypto';
import { verifyValuHandoffTokenEdge } from '../lib/valu-handoff-token-edge.js';

describe('assessment progress handoff verification', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'api/assessment-progress.js'), 'utf8');
  const originalSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = 'unit-test-only-handoff-secret';
  const tasterId = randomUUID();

  function makeToken(overrides = {}) {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      v: 1,
      typ: 'assessment_session',
      aud: 'valu-full-assessment',
      sub: 'user-test-123',
      taster_id: tasterId,
      iat: now,
      exp: now + 60 * 60,
      jti: 'test-token-id-1234567890',
      ...overrides,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
    return encoded + '.' + signature;
  }

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
  });

  afterAll(() => {
    if (originalSecret === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalSecret;
  });

  test('restore and save use the Edge Web Crypto verifier with the shared site token contract', () => {
    expect(source).toContain('runtime: "edge"');
    expect(source).toContain('../lib/valu-handoff-token-edge.js');
    expect(source.split('await verifyValuHandoffTokenEdge(handoffToken, tasterId, reason =>').length - 1).toBe(2);
    expect(source).not.toContain('verifyValuHandoffToken(handoffToken, tasterId)');
    expect(source).not.toContain('node:crypto');
  });

  test('restores a correctly signed dashboard assessment session token', async () => {
    const verified = await verifyValuHandoffTokenEdge(makeToken(), tasterId);
    expect(verified).toMatchObject({
      sub: 'user-test-123',
      taster_id: tasterId,
      aud: 'valu-full-assessment',
    });
  });

  test('rejects a token signed with a different secret', async () => {
    const token = makeToken();
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'different-unit-test-secret';
    const failure = jest.fn();
    const verified = await verifyValuHandoffTokenEdge(token, tasterId, failure);
    expect(verified).toBeNull();
    expect(failure).toHaveBeenCalledWith('signature_invalid');
  });

  test('rejects non-canonical token encoding without throwing', async () => {
    const failure = jest.fn();
    const verified = await verifyValuHandoffTokenEdge('%%%_invalid.%%%_invalid', tasterId, failure);
    expect(verified).toBeNull();
    expect(failure).toHaveBeenCalledWith('token_encoding_invalid');
  });

  test('restore retains snapshot ownership and identity checks after token verification', () => {
    expect(source).toContain('resolvedIdentity.user_id !== handoff.sub');
    expect(source).toContain('resolveTasterIdentity(tasterId)');
    expect(source).toContain('progress.identity_hash !== `valu_progress_${tasterId}`');
  });
});
