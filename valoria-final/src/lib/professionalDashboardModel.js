// Track-aware professional dashboard model.
// This is intentionally presentation-agnostic: UI components consume this model,
// while authoritative listing decisions remain server-side in Supabase.

export const TRACKS = Object.freeze({
  TALENT: 'talent',
  SPEAKER: 'speaker',
  FACILITATOR: 'facilitator',
});

export function getTrackEvidenceRequirements(track) {
  switch (track) {
    case TRACKS.TALENT:
      return [
        { key: 'profile', label: 'Professional profile' },
        { key: 'cv', label: 'CV uploaded' },
        { key: 'assessment', label: 'CV assessment completed' },
      ];
    case TRACKS.SPEAKER:
      return [
        { key: 'profile', label: 'Professional profile' },
        { key: 'speaking_history', label: 'Speaking history' },
        { key: 'speaking_engagements', label: 'Speaking engagements' },
      ];
    case TRACKS.FACILITATOR:
      return [
        { key: 'profile', label: 'Professional profile' },
        { key: 'facilitation_history', label: 'Facilitation history' },
        { key: 'facilitation_engagements', label: 'Facilitation engagements' },
      ];
    default:
      return [{ key: 'profile', label: 'Professional profile' }];
  }
}

export function buildDashboardModel({ track, profileComplete = false, cvUploaded = false, assessment = null, evidence = {}, listing = {} } = {}) {
  const requirements = getTrackEvidenceRequirements(track);
  const checks = requirements.map((requirement) => {
    let complete = false;
    if (requirement.key === 'profile') complete = Boolean(profileComplete);
    else if (requirement.key === 'cv') complete = Boolean(cvUploaded);
    else if (requirement.key === 'assessment') complete = assessment?.status === 'assessed';
    else complete = Array.isArray(evidence[requirement.key]) ? evidence[requirement.key].length > 0 : Boolean(evidence[requirement.key]);
    return { ...requirement, complete };
  });

  const processing = assessment?.status === 'processing';
  const assessmentReview = assessment?.status === 'review_required';
  const assessmentFailed = assessment?.status === 'failed';
  const revoked = listing?.status === 'suspended' || listing?.admin_revoked === true;
  const allEvidenceComplete = checks.every((item) => item.complete);

  // Never derive LISTED solely from client state. This is only the dashboard
  // presentation model; `listing.status` remains authoritative.
  const status = revoked ? 'suspended' : listing?.status || (allEvidenceComplete ? 'pending' : 'pending');

  return {
    track,
    requirements: checks,
    allEvidenceComplete,
    assessment: {
      status: assessment?.status || 'not_started',
      score: Number.isFinite(assessment?.score) ? assessment.score : null,
      processing,
      reviewRequired: assessmentReview,
      failed: assessmentFailed,
    },
    listing: {
      status,
      isListed: status === 'listed',
      isSuspended: revoked,
    },
    readiness: allEvidenceComplete && !processing && !assessmentReview && !assessmentFailed && !revoked,
  };
}
