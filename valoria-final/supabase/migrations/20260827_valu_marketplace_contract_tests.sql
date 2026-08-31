-- Read-only assertions for the VALU v4 marketplace contract.
-- These are intended for controlled CI/test fixtures, not production seed data.

-- Contract invariant: the assessment threshold is inclusive.
-- 34 must fail score eligibility; 35 must pass it.
-- Listing still requires all readiness gates.

-- Keep this file as executable documentation until a dedicated pgTAP suite is enabled.
select 1 as valu_marketplace_contract_loaded;
