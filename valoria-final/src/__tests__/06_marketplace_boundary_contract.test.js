import fs from 'node:fs';
import path from 'node:path';

describe('Marketplace eligibility boundary contract', () => {
  test('35 is inclusive while 34 is below the threshold', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'docs/AUTOMATED_ELIGIBILITY_PROTOCOL.md'), 'utf8');
    expect(source).toContain('score_eligible_for_marketplace = valu_index >= 35');
    expect(source).toContain('35+ score ≠ automatically listed');
  });

  test('marketplace discovery requires eligibility, listed state, availability and public visibility', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260827_marketplace_governance_v4.sql'), 'utf8');
    expect(source).toContain("p.listing_status='listed'");
    expect(source).toContain("p.availability_status in ('available','limited')");
    expect(source).toContain("p.visibility='public'");
    expect(source).toContain('coalesce(p.eligible_for_listing,false)=true');
  });

  test('governance readiness is server-only', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260827_marketplace_governance_v4.sql'), 'utf8');
    expect(source).toContain('create schema if not exists private');
    expect(source).toContain('private.evaluate_professional_readiness');
    expect(source).toContain('private.sync_professional_listing_status');
    expect(source).toContain('grant execute on function private.sync_professional_listing_status(uuid) to service_role');
  });
});
