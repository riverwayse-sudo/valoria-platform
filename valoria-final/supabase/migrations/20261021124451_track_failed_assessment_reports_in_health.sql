CREATE OR REPLACE FUNCTION private.valu_reconciliation_health()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE report jsonb;
BEGIN
  WITH latest_reviews AS (
    SELECT DISTINCT ON (source_record_type, source_record_id)
      source_record_type, source_record_id, decision, candidate_record_type, candidate_record_id, evidence_reference
    FROM public.identity_reconciliation_reviews
    ORDER BY source_record_type, source_record_id, reviewed_at DESC NULLS LAST, created_at DESC, id DESC
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'full_assessments_total', (SELECT count(*) FROM public.valu_assessments),
    'full_assessments_completed', (SELECT count(*) FROM public.valu_assessments WHERE completed_at IS NOT NULL),
    'pending_assessment_reports', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL
        AND a.report_status = 'PENDING'
        AND (a.ai_report IS NULL OR btrim(a.ai_report) = '')
    ),
    'failed_assessment_reports', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL
        AND a.report_status = 'FAILED'
        AND (a.ai_report IS NULL OR btrim(a.ai_report) = '')
    ),
    'completed_assessments_missing_taster_id', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL AND a.taster_id IS NULL
    ),
    'missing_taster_link_assessments_without_review', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL AND a.taster_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.identity_reconciliation_reviews r
          WHERE r.source_record_type = 'assessment' AND r.source_record_id = a.id
        )
    ),
    'missing_taster_link_assessments_without_verified_taster_review', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL AND a.taster_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM latest_reviews r
          WHERE r.source_record_type = 'assessment'
            AND r.source_record_id = a.id
            AND r.decision = 'verified_match'
            AND r.candidate_record_type = 'taster'
            AND r.candidate_record_id IS NOT NULL
            AND r.evidence_reference IS NOT NULL
        )
    ),
    'completed_assessment_taster_owner_conflicts', (
      SELECT count(*) FROM public.valu_assessments a
      JOIN public.taster_sessions t ON t.id = a.taster_id
      WHERE a.completed_at IS NOT NULL
        AND (
          a.user_id IS DISTINCT FROM t.user_id
          OR lower(trim(coalesce(a.name, ''))) IS DISTINCT FROM lower(trim(coalesce(t.name, '')))
          OR lower(trim(coalesce(a.role, ''))) IS DISTINCT FROM lower(trim(coalesce(t.role, '')))
        )
    ),
    'professional_profiles_total', (SELECT count(*) FROM public.professional_profiles),
    'profiles_without_full_assessment', (
      SELECT count(*) FROM public.professional_profiles p
      WHERE NOT EXISTS (SELECT 1 FROM public.valu_assessments a WHERE a.user_id = p.id AND a.completed_at IS NOT NULL)
    ),
    'completed_assessments_without_profile', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.id = a.user_id)
    ),
    'completed_assessments_missing_identity_link', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL AND a.user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.assessment_identity_links l WHERE l.assessment_id = a.id AND l.user_id = a.user_id)
    ),
    'completed_assessments_missing_assessment_identity_audit_link', (
      SELECT count(*) FROM public.valu_assessments a
      WHERE a.completed_at IS NOT NULL AND a.user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.assessment_identity_links l WHERE l.assessment_id = a.id AND l.user_id = a.user_id)
    ),
    'assessment_identity_owner_conflicts', (
      SELECT count(*) FROM public.assessment_identity_links l
      JOIN public.valu_assessments a ON a.id = l.assessment_id
      WHERE l.user_id IS DISTINCT FROM a.user_id
    ),
    'journey_missing_or_wrong_current_assessment', (
      SELECT count(*) FROM public.valu_assessments a
      LEFT JOIN public.professional_journey j ON j.user_id = a.user_id AND j.current_assessment_id = a.id
      WHERE a.completed_at IS NOT NULL AND j.user_id IS NULL
    ),
    'listed_profiles_eligibility_or_visibility_conflicts', (
      SELECT count(*) FROM public.professional_profiles p
      WHERE p.listing_status = 'listed'
        AND (p.eligible_for_listing IS DISTINCT FROM true OR p.visibility IS DISTINCT FROM 'public')
    ),
    'listed_profiles_profile_incomplete_info', (
      SELECT count(*) FROM public.professional_profiles p
      WHERE p.listing_status = 'listed' AND p.profile_complete IS DISTINCT FROM true
    ),
    'listed_test_fixtures_info', (
      SELECT count(*) FROM public.professional_profiles p
      WHERE p.listing_status = 'listed' AND coalesce(p.is_test, false) = true
    ),
    'listed_profiles_count', (SELECT count(*) FROM public.professional_profiles WHERE listing_status = 'listed'),
    'public_roster_count', (SELECT count(*) FROM public.marketplace_public_roster),
    'listed_profiles_missing_from_public_roster', (
      SELECT count(*) FROM public.professional_profiles p
      WHERE p.listing_status = 'listed'
        AND NOT EXISTS (SELECT 1 FROM public.marketplace_public_roster r WHERE r.professional_id = p.id)
    ),
    'public_roster_rows_not_listed', (
      SELECT count(*) FROM public.marketplace_public_roster r
      WHERE NOT EXISTS (SELECT 1 FROM public.professional_profiles p WHERE p.id = r.professional_id AND p.listing_status = 'listed')
    ),
    'active_capabilities_total', (SELECT count(*) FROM public.professional_capabilities WHERE is_active = true),
    'active_capabilities_eligible_but_not_listed', (
      SELECT count(*) FROM public.professional_capabilities
      WHERE is_active = true AND eligible_for_listing = true AND eligibility_status IS DISTINCT FROM 'listed'
    ),
    'taster_sessions_total', (SELECT count(*) FROM public.taster_sessions),
    'taster_sessions_unlinked', (SELECT count(*) FROM public.taster_sessions WHERE user_id IS NULL),
    'completed_tasters_unlinked', (SELECT count(*) FROM public.taster_sessions WHERE completed_at IS NOT NULL AND user_id IS NULL),
    'taster_version_unknown', (
      SELECT count(*) FROM public.taster_sessions WHERE taster_version IS NULL OR taster_version_source = 'legacy_unknown'
    ),
    'taster_progress_in_progress', (SELECT count(*) FROM public.taster_progress WHERE status = 'in_progress'),
    'taster_progress_expired_in_progress', (
      SELECT count(*) FROM public.taster_progress WHERE status = 'in_progress' AND expires_at <= now()
    ),
    'taster_progress_completed', (SELECT count(*) FROM public.taster_progress WHERE status = 'completed'),
    'taster_identity_candidate_account_linked', (
      SELECT count(*) FROM public.taster_identity_candidates WHERE identity_status = 'account_linked'
    ),
    'taster_identity_candidate_contact_candidate', (
      SELECT count(*) FROM public.taster_identity_candidates WHERE identity_status = 'contact_candidate'
    ),
    'taster_identity_candidate_conflicting_evidence', (
      SELECT count(*) FROM public.taster_identity_candidates WHERE identity_status = 'conflicting_evidence'
    ),
    'taster_identity_candidate_unresolved', (
      SELECT count(*) FROM public.taster_identity_candidates WHERE identity_status = 'unresolved'
    ),
    'identity_review_queue_open', (
      SELECT count(*) FROM latest_reviews r
      WHERE r.decision IS DISTINCT FROM 'resolved_no_link'
        AND NOT (
          r.source_record_type = 'assessment'
          AND r.decision = 'verified_match'
          AND r.candidate_record_type = 'account'
          AND EXISTS (
            SELECT 1 FROM public.valu_assessments a
            JOIN public.assessment_identity_links l ON l.assessment_id = a.id AND l.user_id = r.candidate_record_id
            WHERE a.id = r.source_record_id AND a.user_id = r.candidate_record_id
          )
        )
        AND NOT (
          r.source_record_type = 'taster'
          AND r.decision = 'verified_match'
          AND r.candidate_record_type = 'account'
          AND EXISTS (
            SELECT 1 FROM public.taster_sessions t
            WHERE t.id = r.source_record_id
              AND t.completed_at IS NOT NULL
              AND t.user_id = r.candidate_record_id
              AND (
                NOT EXISTS (SELECT 1 FROM public.taster_identity_candidates c WHERE c.taster_id = t.id)
                OR EXISTS (SELECT 1 FROM public.taster_identity_candidates c WHERE c.taster_id = t.id AND c.linked_user_id = r.candidate_record_id)
              )
          )
        )
        AND NOT (
          r.source_record_type = 'assessment'
          AND r.decision = 'verified_match'
          AND r.candidate_record_type = 'taster'
          AND EXISTS (
            SELECT 1 FROM public.valu_assessments a
            JOIN public.taster_sessions t ON t.id = r.candidate_record_id
            WHERE a.id = r.source_record_id
              AND a.taster_id = t.id
              AND a.user_id IS NOT NULL
              AND a.user_id = t.user_id
              AND lower(regexp_replace(trim(coalesce(a.name, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(t.name, '')), '\s+', ' ', 'g'))
              AND lower(regexp_replace(trim(coalesce(a.role, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(t.role, '')), '\s+', ' ', 'g'))
          )
        )
    ),
    'identity_review_queue_applied', (
      SELECT count(*) FROM latest_reviews r
      WHERE
        (
          r.source_record_type = 'assessment'
          AND r.decision = 'verified_match'
          AND r.candidate_record_type = 'account'
          AND EXISTS (
            SELECT 1 FROM public.valu_assessments a
            JOIN public.assessment_identity_links l ON l.assessment_id = a.id AND l.user_id = r.candidate_record_id
            WHERE a.id = r.source_record_id AND a.user_id = r.candidate_record_id
          )
        )
        OR (
          r.source_record_type = 'taster'
          AND r.decision = 'verified_match'
          AND r.candidate_record_type = 'account'
          AND EXISTS (
            SELECT 1 FROM public.taster_sessions t
            WHERE t.id = r.source_record_id
              AND t.completed_at IS NOT NULL
              AND t.user_id = r.candidate_record_id
              AND (
                NOT EXISTS (SELECT 1 FROM public.taster_identity_candidates c WHERE c.taster_id = t.id)
                OR EXISTS (SELECT 1 FROM public.taster_identity_candidates c WHERE c.taster_id = t.id AND c.linked_user_id = r.candidate_record_id)
              )
          )
        )
        OR (
          r.source_record_type = 'assessment'
          AND r.decision = 'verified_match'
          AND r.candidate_record_type = 'taster'
          AND EXISTS (
            SELECT 1 FROM public.valu_assessments a
            JOIN public.taster_sessions t ON t.id = r.candidate_record_id
            WHERE a.id = r.source_record_id
              AND a.taster_id = t.id
              AND a.user_id IS NOT NULL
              AND a.user_id = t.user_id
              AND lower(regexp_replace(trim(coalesce(a.name, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(t.name, '')), '\s+', ' ', 'g'))
              AND lower(regexp_replace(trim(coalesce(a.role, '')), '\s+', ' ', 'g')) = lower(regexp_replace(trim(coalesce(t.role, '')), '\s+', ' ', 'g'))
          )
        )
    ),
    'identity_review_queue_closed_no_link', (
      SELECT count(*) FROM latest_reviews
      WHERE decision = 'resolved_no_link'
    ),
    'journey_records_stale_over_7_days', (
      SELECT count(*) FROM public.professional_journey
      WHERE updated_at < now() - interval '7 days'
        AND coalesce(lifecycle_state, '') NOT IN ('completed', 'closed')
    ),
    'legacy_journey_events_table_rows', (SELECT count(*) FROM public.journey_events),
    'canonical_valoria_journey_events_rows', (SELECT count(*) FROM public.valoria_journey_events)
  ) INTO report;
  RETURN report;
END;
$function$

