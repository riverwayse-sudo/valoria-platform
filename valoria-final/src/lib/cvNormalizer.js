// Conservative, dependency-free CV normalizer.
// It converts extracted plain text into evidence fields without pretending to understand
// facts that cannot be reliably inferred. Unknown fields remain empty for review.

const clean = (s) => String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
const lines = (text) => String(text || '').split('\n').map(clean).filter(Boolean);
const sectionNames = {
  experience: /^(experience|work experience|employment|professional experience|career history)$/i,
  education: /^(education|academic background|qualifications)$/i,
  skills: /^(skills|core skills|technical skills|competencies)$/i,
  certifications: /^(certifications?|professional certifications?)$/i,
  achievements: /^(achievements?|awards?|accomplishments?)$/i,
};

function sections(text) {
  const result = {};
  let current = 'general';
  for (const line of lines(text)) {
    const match = Object.entries(sectionNames).find(([, re]) => re.test(line));
    if (match) { current = match[0]; result[current] ||= []; continue; }
    result[current] ||= [];
    result[current].push(line);
  }
  return result;
}

function firstNameLine(text) {
  const ls = lines(text);
  return ls.find(l => l.length >= 3 && l.length <= 80 && !/@|https?:\/\//i.test(l) && !/curriculum|resume|cv/i.test(l)) || '';
}

function yearsFromText(text) {
  const matches = [...String(text || '').matchAll(/(\d+)\s*\+?\s*years?/gi)].map(m => Number(m[1]));
  return matches.length ? Math.max(...matches) : 0;
}

function listFromSection(section = []) {
  return section.slice(0, 30).map(v => ({ description: v }));
}

export function normalizeCvText(text) {
  const raw = String(text || '');
  const s = sections(raw);
  const general = s.general || [];
  const name = firstNameLine(raw);
  const email = (raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
  const headline = general.find(l => l !== name && l.length <= 120 && !/@|https?:\/\//i.test(l)) || '';

  const skills = (s.skills || []).flatMap(line => line.split(/[,;|•]/).map(clean)).filter(Boolean).slice(0, 50);
  const industries = [];
  const industryTerms = ['banking','finance','fintech','technology','telecommunications','healthcare','education','energy','oil and gas','manufacturing','retail','government','consulting','nonprofit'];
  const lower = raw.toLowerCase();
  industryTerms.forEach(term => { if (lower.includes(term)) industries.push(term); });

  return {
    name,
    email,
    headline,
    summary: general.filter(l => l.length >= 40).slice(0, 3).join(' '),
    years_experience: yearsFromText(raw),
    experience: listFromSection(s.experience),
    education: listFromSection(s.education),
    skills,
    certifications: listFromSection(s.certifications),
    achievements: listFromSection(s.achievements),
    industries,
    specializations: [],
    promotions: 0,
    parser_version: 'v1',
    extraction_warnings: Object.keys(s).filter(k => k !== 'general' && !s[k]?.length).map(k => `${k} section not detected`),
  };
}
