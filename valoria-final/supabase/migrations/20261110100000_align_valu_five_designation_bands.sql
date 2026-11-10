-- Re-align stored VALU designations to the approved five-band standard.
-- This changes only derived designation text. Scores, assessment answers, validity,
-- eligibility, consent and listing states are not modified.
update public.valu_assessments
set designation = case
  when total_score >= 80 then 'Force to Align With'
  when total_score >= 65 then 'Emerging Force'
  when total_score >= 50 then 'Developing Professional'
  when total_score >= 35 then 'Building Foundations'
  else 'At the Starting Point'
end
where completed_at is not null
  and total_score between 0 and 100
  and designation is distinct from case
    when total_score >= 80 then 'Force to Align With'
    when total_score >= 65 then 'Emerging Force'
    when total_score >= 50 then 'Developing Professional'
    when total_score >= 35 then 'Building Foundations'
    else 'At the Starting Point'
  end;

update public.assessment_sessions
set designation = case
  when valu_index >= 80 then 'Force to Align With'
  when valu_index >= 65 then 'Emerging Force'
  when valu_index >= 50 then 'Developing Professional'
  when valu_index >= 35 then 'Building Foundations'
  else 'At the Starting Point'
end
where completed_at is not null
  and valu_index between 0 and 100
  and designation is distinct from case
    when valu_index >= 80 then 'Force to Align With'
    when valu_index >= 65 then 'Emerging Force'
    when valu_index >= 50 then 'Developing Professional'
    when valu_index >= 35 then 'Building Foundations'
    else 'At the Starting Point'
  end;

update public.professional_profiles
set designation = case
  when valu_index >= 80 then 'Force to Align With'
  when valu_index >= 65 then 'Emerging Force'
  when valu_index >= 50 then 'Developing Professional'
  when valu_index >= 35 then 'Building Foundations'
  else 'At the Starting Point'
end
where valu_index between 0 and 100
  and designation is distinct from case
    when valu_index >= 80 then 'Force to Align With'
    when valu_index >= 65 then 'Emerging Force'
    when valu_index >= 50 then 'Developing Professional'
    when valu_index >= 35 then 'Building Foundations'
    else 'At the Starting Point'
  end;

update public.marketplace_public_roster
set designation = case
  when valu_index >= 80 then 'Force to Align With'
  when valu_index >= 65 then 'Emerging Force'
  when valu_index >= 50 then 'Developing Professional'
  when valu_index >= 35 then 'Building Foundations'
  else 'At the Starting Point'
end
where valu_index between 0 and 100
  and designation is distinct from case
    when valu_index >= 80 then 'Force to Align With'
    when valu_index >= 65 then 'Emerging Force'
    when valu_index >= 50 then 'Developing Professional'
    when valu_index >= 35 then 'Building Foundations'
    else 'At the Starting Point'
  end;

