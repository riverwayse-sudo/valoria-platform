-- Re-label stored VALU merit designations using the approved VI-BG-2026-001 bands.
-- Scores and assessment records are not changed; only the derived designation text is updated.

update public.valu_assessments
set designation = case
  when total_score >= 90 then 'Elite'
  when total_score >= 75 then 'Distinguished'
  when total_score >= 55 then 'Proficient'
  when total_score >= 35 then 'Standard'
  else 'Assessment Follow-up'
end
where completed_at is not null
  and total_score is not null
  and designation is distinct from case
    when total_score >= 90 then 'Elite'
    when total_score >= 75 then 'Distinguished'
    when total_score >= 55 then 'Proficient'
    when total_score >= 35 then 'Standard'
    else 'Assessment Follow-up'
  end;

update public.assessment_sessions
set designation = case
  when valu_index >= 90 then 'Elite'
  when valu_index >= 75 then 'Distinguished'
  when valu_index >= 55 then 'Proficient'
  when valu_index >= 35 then 'Standard'
  else 'Assessment Follow-up'
end
where completed_at is not null
  and valu_index is not null
  and designation is distinct from case
    when valu_index >= 90 then 'Elite'
    when valu_index >= 75 then 'Distinguished'
    when valu_index >= 55 then 'Proficient'
    when valu_index >= 35 then 'Standard'
    else 'Assessment Follow-up'
  end;

update public.professional_profiles
set designation = case
  when valu_index >= 90 then 'Elite'
  when valu_index >= 75 then 'Distinguished'
  when valu_index >= 55 then 'Proficient'
  when valu_index >= 35 then 'Standard'
  else 'Assessment Follow-up'
end
where valu_index is not null
  and designation is distinct from case
    when valu_index >= 90 then 'Elite'
    when valu_index >= 75 then 'Distinguished'
    when valu_index >= 55 then 'Proficient'
    when valu_index >= 35 then 'Standard'
    else 'Assessment Follow-up'
  end;

update public.marketplace_public_roster
set designation = case
  when valu_index >= 90 then 'Elite'
  when valu_index >= 75 then 'Distinguished'
  when valu_index >= 55 then 'Proficient'
  when valu_index >= 35 then 'Standard'
  else 'Assessment Follow-up'
end
where valu_index is not null
  and designation is distinct from case
    when valu_index >= 90 then 'Elite'
    when valu_index >= 75 then 'Distinguished'
    when valu_index >= 55 then 'Proficient'
    when valu_index >= 35 then 'Standard'
    else 'Assessment Follow-up'
  end;
