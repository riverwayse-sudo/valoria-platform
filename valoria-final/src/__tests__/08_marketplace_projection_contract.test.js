const fs = require('node:fs');
const path = require('node:path');

describe('Marketplace projection contract', () => {
  const migrations = path.join(process.cwd(), 'supabase', 'migrations');

  test('the recovered production migration is version controlled', () => {
    expect(fs.existsSync(path.join(migrations, '20260916134743_fix_valu_marketplace_capability_projection_and_profile_avatar_gate.sql')).toBe(true);
    expect(fs.existsSync(path.join(migrations, '20260916134934_queue_readiness_on_avatar_changes.sql')).toBe(true);
    expect(fs.existsSync(path.join(migrations, '20260916135628_fix_marketplace_unique_professional_capability_projection.sql')).toBe(true);
  });

  test('category projection is capability-row based, not primary-capability based', () => {
    const source = fs.readFileSync(path.join(migrations, '20260919160000_close_marketplace_governance_gaps.sql'), 'utf8');
    expect(source).toContain('join public.professional_capabilities c');
    expect(source).toContain("c.eligibility_status='listed'");
    expect(source).not.toContain('array_agg(pc.capability ORDER BY');
  });

  test('the public projection exposes the unified capability array', () => {
    const source = fs.readFileSync(path.join(migrations, '20260919160000_close_marketplace_governance_gaps.sql'), 'utf8');
    expect(source).toContain('caps.capabilities');
    expect(source).toContain("case when c.capability='talent' then 'candidate' else c.capability end");
  });
});