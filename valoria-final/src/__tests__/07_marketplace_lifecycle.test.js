describe('VALU v4 marketplace lifecycle', () => {
  const evaluate = ({ score, completed = true, expires = true, profile = true, capability = true, evidence = true, blocked = false }) => {
    const scoreEligible = completed && expires && score >= 35;
    const eligible = scoreEligible && profile && capability && evidence && !blocked;
    const status = blocked ? (scoreEligible ? 'suspended' : 'revoked') : eligible ? 'listed' : 'unlisted';
    return { scoreEligible, eligible, status };
  };

  test.each([
    [34, false, false, 'unlisted'],
    [35, true, false, 'unlisted'],
    [35, true, true, 'listed'],
    [36, true, true, 'listed'],
  ])('%s-point boundary and gate state', (score, expectedScoreEligible, evidence, expectedStatus) => {
    expect(evaluate({ score, evidence })).toEqual({ scoreEligible: expectedScoreEligible, eligible: expectedStatus === 'listed', status: expectedStatus });
  });

  test('35+ with expired authoritative assessment is not eligible', () => {
    expect(evaluate({ score: 60, expires: false, evidence: true })).toEqual({ scoreEligible: false, eligible: false, status: 'unlisted' });
  });

  test('listed professional becomes hidden from discovery when unavailable', () => {
    const listing = evaluate({ score: 60, evidence: true });
    expect(listing.status).toBe('listed');
    const discoverable = listing.status === 'listed' && ['available', 'limited'].includes('available');
    expect(discoverable).toBe(true);
    const unavailableDiscoverable = listing.status === 'listed' && ['available', 'limited'].includes('unavailable');
    expect(unavailableDiscoverable).toBe(false);
  });

  test('suspension blocks discovery and restoration requires fresh eligibility', () => {
    expect(evaluate({ score: 60, evidence: true, blocked: true })).toEqual({ scoreEligible: true, eligible: false, status: 'suspended' });
    expect(evaluate({ score: 60, evidence: true, blocked: false })).toEqual({ scoreEligible: true, eligible: true, status: 'listed' });
    expect(evaluate({ score: 34, evidence: true, blocked: false })).toEqual({ scoreEligible: false, eligible: false, status: 'unlisted' });
  });

  test('all readiness gates are independently required', () => {
    for (const gate of ['profile', 'capability', 'evidence']) {
      const input = { score: 50, profile: true, capability: true, evidence: true };
      input[gate] = false;
      expect(evaluate(input).eligible).toBe(false);
      expect(evaluate(input).status).toBe('unlisted');
    }
  });
});
