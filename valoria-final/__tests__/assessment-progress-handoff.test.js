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

  test('rejects non-zero unused base64url bits instead of accepting alternate encodings', async () => {
    const failure = jest.fn();
    const verified = await verifyValuHandoffTokenEdge('Zh.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', tasterId, failure);
    expect(verified).toBeNull();
    expect(failure).toHaveBeenCalledWith('token_encoding_invalid');
  });

  test.each([
    [{ v: 2 }, 'token_version_invalid'],
    [{ typ: 'other' }, 'token_type_invalid'],
    [{ aud: 'other' }, 'token_audience_invalid'],
    [{ taster_id: randomUUID() }, 'snapshot_mismatch'],
    [{ exp: Math.floor(Date.now() / 1000) - 1 }, 'token_expired'],
    [{ iat: Math.floor(Date.now() / 1000) + 120 }, 'token_issued_in_future'],
  ])('rejects invalid signed claims: %j', async (overrides, reason) => {
    const failure = jest.fn();
    const verified = await verifyValuHandoffTokenEdge(makeToken(overrides), tasterId, failure);
    expect(verified).toBeNull();
    expect(failure).toHaveBeenCalledWith(reason);
  });

  test('restore retains snapshot ownership and identity checks after token verification', () => {
    expect(source).toContain('resolvedIdentity.user_id !== handoff.sub');
    expect(source).toContain('resolveTasterIdentity(tasterId)');
    expect(source).toContain('progress.identity_hash !== `valu_progress_${tasterId}`');
  });
});

describe('assessment progress restore runtime contract', () => {
  const secret = 'unit-test-only-handoff-secret';
  const tasterId = randomUUID();
  const originalUrl = process.env.SUPABASE_URL;
  const originalVercelEnv = process.env.VERCEL_ENV;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  function makeToken() {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      v: 1,
      typ: 'assessment_session',
      aud: 'valu-full-assessment',
      sub: 'user-test-123',
      taster_id: tasterId,
      iat: now,
      exp: now + 60 * 60,
      jti: 'runtime-restore-token-id-123456',
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
    return encoded + '.' + signature;
  }

  function loadHandler() {
    process.env.VERCEL_ENV = 'development';
    process.env.SUPABASE_URL = 'https://preview-test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = secret;
    const modulePath = require.resolve('../api/assessment-progress.js');
    delete require.cache[modulePath];
    return require('../api/assessment-progress.js').default;
  }

  function response(data, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => data };
  }

  afterEach(() => {
    delete global.fetch;
    const modulePath = require.resolve('../api/assessment-progress.js');
    delete require.cache[modulePath];
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = originalVercelEnv;
    if (originalServiceRole === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  });

  test('restores saved answers and position only after the signed account-owned snapshot is verified', async () => {
    const saved = {
      id: 'progress-row-1',
      session_id: '44444444-4444-4444-8444-444444444444',
      resume_token: 'resume-token-test',
      taster_id: tasterId,
      user_id: 'user-test-123',
      identity_hash: `valu_progress_${tasterId}`,
      name: 'Test Participant',
      role: 'Programme Manager',
      experience: '9-15',
      email: 'participant@example.com',
      current_question: 14,
      total_questions: 58,
      answers: { 0: 2, 1: 1, 2: 0, 9: 3, 10: 2 },
      timings: [100, 200, 300],
      session_seed: 42,
      status: 'in_progress',
      last_activity_at: new Date().toISOString(),
    };
    global.fetch = async url => {
      if (String(url).includes('/rest/v1/taster_sessions')) {
        return response([{
          id: tasterId,
          user_id: 'user-test-123',
          name: 'Test Participant',
          role: 'Programme Manager',
          experience: '9-15',
          completed_at: new Date().toISOString(),
          taster_answers: {},
        }]);
      }
      if (String(url).includes('/auth/v1/admin/users/')) {
        return response({ id: 'user-test-123', email: 'participant@example.com', email_confirmed_at: new Date().toISOString() });
      }
      if (String(url).includes('/rest/v1/valu_assessment_progress')) return response([saved]);
      throw new Error(`unexpected fetch: ${url}`);
    };

    const handler = loadHandler();
    const request = new Request('https://assessment.example.test/api/assessment-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore',
        handoff_token: makeToken(),
        taster_id: tasterId,
      }),
    });
    const result = await handler(request);
    const body = await result.json();

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.progress).toMatchObject({
      session_id: saved.session_id,
      resume_token: saved.resume_token,
      current_question: 14,
      total_questions: 58,
      answers: saved.answers,
      timings: saved.timings,
      user_id: 'user-test-123',
    });
  });

  test('first continuation seeds the saved opening answers into canonical bank positions', async () => {
    const openingAnswers = { 0: 1, 1: 2, 2: 0, 3: 1, 4: 2, 5: 0, 6: 1, 7: 2, 8: 0 };
    global.fetch = async url => {
      if (String(url).includes('/rest/v1/taster_sessions')) {
        return response([{
          id: tasterId,
          user_id: 'user-test-123',
          name: 'Test Participant',
          role: 'Programme Manager',
          experience: '9-15',
          completed_at: new Date().toISOString(),
          taster_answers: openingAnswers,
        }]);
      }
      if (String(url).includes('/auth/v1/admin/users/')) {
        return response({ id: 'user-test-123', email: 'participant@example.com', email_confirmed_at: new Date().toISOString() });
      }
      if (String(url).includes('/rest/v1/valu_assessment_progress')) return response([]);
      throw new Error(`unexpected fetch: ${url}`);
    };

    const handler = loadHandler();
    const request = new Request('https://assessment.example.test/api/assessment-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'restore',
        handoff_token: makeToken(),
        taster_id: tasterId,
      }),
    });
    const result = await handler(request);
    const body = await result.json();
    const { OPENING_POSITIONS } = await import('../src/assessmentJourney.js');
    const expected = Object.fromEntries(OPENING_POSITIONS.map((position, index) => [position, openingAnswers[index]]));

    expect(result.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.progress).toBeNull();
    expect(body.seeded_answers).toEqual(expected);
    expect(Object.keys(body.seeded_answers)).toHaveLength(9);
  });
});
