-- Compensation expectations and speaker fee ranges are not part of the public
-- directory projection. Keep them available to authorized employer/operations
-- workflows only; anonymous and ordinary authenticated roles cannot select them.
revoke select (fee_range, salary_expectation)
on public.marketplace_public_roster
from anon, authenticated;
