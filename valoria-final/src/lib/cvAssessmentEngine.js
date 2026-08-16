// Deterministic Valoria CV evidence assessment. No external AI dependency.
// The engine is intentionally pure: the same normalized CV produces the same result.

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const count = (value) => Array.isArray(value) ? value.length : 0;
const has = (value) => typeof value === 'string' && value.trim().length > 0;

const DIMENSIONS = {
  completeness: 15,
  experience_depth: 20,
  career_progression: 15,
  skills_evidence: 15,
  achievement_evidence: 15,
  education_certification: 10,
  professional_positioning: 10,
};

function scoreCompleteness(cv) {
  const checks = [
    has(cv.name), has(cv.summary), count(cv.experience) > 0,
    count(cv.education) > 0, count(cv.skills) > 0,
    count(cv.certifications) > 0, count(cv.achievements) > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * DIMENSIONS.completeness);
}

function scoreExperience(cv) {
  const years = Number(cv.years_experience) || 0;
  const roles = count(cv.experience);
  return clamp(Math.round(Math.min(years, 12) / 12 * 14 + Math.min(roles, 6) / 6 * 6), 0, DIMENSIONS.experience_depth);
}

function scoreProgression(cv) {
  const roles = Array.isArray(cv.experience) ? cv.experience : [];
  const seniorSignals = roles.filter(r => /lead|senior|manager|director|head|chief|principal|executive/i.test(`${r.title || ''} ${r.level || ''}`)).length;
  const promotions = Number(cv.promotions) || 0;
  return clamp(Math.round(Math.min(seniorSignals, 3) / 3 * 10 + Math.min(promotions, 2) / 2 * 5), 0, DIMENSIONS.career_progression);
}

function scoreSkills(cv) {
  const skills = count(cv.skills);
  const evidenced = Array.isArray(cv.skills) ? cv.skills.filter(s => typeof s === 'object' ? s.evidence : false).length : 0;
  return clamp(Math.round(Math.min(skills, 12) / 12 * 9 + Math.min(evidenced, 6) / 6 * 6), 0, DIMENSIONS.skills_evidence);
}

function scoreAchievements(cv) {
  const achievements = Array.isArray(cv.achievements) ? cv.achievements : [];
  const quantified = achievements.filter(a => /\d+%|\$|₦|million|billion|increased|reduced|grew|saved|delivered/i.test(typeof a === 'string' ? a : a.description || '')).length;
  return clamp(Math.round(Math.min(achievements.length, 6) / 6 * 8 + Math.min(quantified, 4) / 4 * 7), 0, DIMENSIONS.achievement_evidence);
}

function scoreEducation(cv) {
  return clamp(Math.min(count(cv.education), 2) * 3 + Math.min(count(cv.certifications), 4) * 1, 0, DIMENSIONS.education_certification);
}

function scorePositioning(cv) {
  let score = 0;
  if (has(cv.headline)) score += 3;
  if (has(cv.summary) && cv.summary.trim().length >= 80) score += 3;
  if (count(cv.industries) > 0) score += 2;
  if (count(cv.specializations) > 0) score += 2;
  return clamp(score, 0, DIMENSIONS.professional_positioning);
}

export function assessCv(cv = {}) {
  const dimensions = {
    completeness: scoreCompleteness(cv),
    experience_depth: scoreExperience(cv),
    career_progression: scoreProgression(cv),
    skills_evidence: scoreSkills(cv),
    achievement_evidence: scoreAchievements(cv),
    education_certification: scoreEducation(cv),
    professional_positioning: scorePositioning(cv),
  };

  const score = Object.values(dimensions).reduce((sum, value) => sum + value, 0);
  const gaps = [];
  const evidence = [];
  const recommendations = [];

  if (!has(cv.summary)) { gaps.push('Professional summary is missing.'); recommendations.push('Add a concise professional positioning statement.'); }
  if (!count(cv.experience)) { gaps.push('Employment history is missing.'); recommendations.push('Add complete employment history with role, organization and dates.'); }
  if (!count(cv.achievements)) { gaps.push('Achievement evidence is missing.'); recommendations.push('Add measurable outcomes and professional achievements.'); }
  if (!count(cv.certifications)) gaps.push('No certifications were identified.');
  if (count(cv.skills) < 5) recommendations.push('Expand the skills section and connect key skills to evidence from work history.');

  if (score >= 80) evidence.push('Strong overall professional evidence.');
  else if (score >= 60) evidence.push('Moderate professional evidence with identifiable development gaps.');
  else evidence.push('Professional evidence requires substantial strengthening before a strong marketplace profile can be established.');

  return {
    version: 'v1',
    score,
    dimensions,
    evidence,
    gaps,
    recommendations,
    assessed_at: new Date().toISOString(),
  };
}

export { DIMENSIONS };
