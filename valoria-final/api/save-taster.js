// api/save-taster.js
// Persists directional taster results separately from the authoritative
// full-assessment score table.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EXPERIENCE = new Set(['0-3','4-8','9-15','15+']);
const CLUSTERS = new Set(['P','R','I','M','E']);
function json(res, status, data) { res.status(status).setHeader('Cache-Control','no-store'); return res.json(data); }
function plain(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function validTasterAnswers(value) {
  return plain(value) && Object.keys(value).length === 9 && Array.from({ length: 9 }, (_, i) => {
    const answer = value[i];
    return Number.isInteger(answer) && answer >= 0 && answer <= 3;
  }).every(Boolean);
}
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res,405,{error:'Method not allowed'});
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json(res,500,{error:'Server misconfigured.'});
  const { name, role, experience, tasterAnswers, clusterScores, strongestCluster, weakestCluster } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 200) return json(res,400,{error:'Name is required.'});
  if (typeof role !== 'string' || !role.trim() || role.trim().length > 160) return json(res,400,{error:'Role is required.'});
  if (experience != null && !EXPERIENCE.has(experience)) return json(res,400,{error:'Invalid experience band.'});
  if (!validTasterAnswers(tasterAnswers)) return json(res,400,{error:'Incomplete taster answers.'});
  if (!plain(clusterScores) || !['P','R','I','M','E'].every(id => Number.isFinite(clusterScores[id]) && clusterScores[id] >= 0 && clusterScores[id] <= 100)) return json(res,400,{error:'Invalid taster scores.'});
  if (!CLUSTERS.has(strongestCluster) || !CLUSTERS.has(weakestCluster)) return json(res,400,{error:'Invalid taster clusters.'});
  const row = { name:name.trim(), role:role.trim(), experience:experience || null, taster_answers:tasterAnswers, cluster_scores:clusterScores, strongest_cluster:strongestCluster, weakest_cluster:weakestCluster };
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/taster_sessions`, { method:'POST', headers:{'Content-Type':'application/json',apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,Prefer:'return=minimal'}, body:JSON.stringify(row) });
    if (!r.ok) { console.error('save-taster: insert failed', r.status, await r.text()); return json(res,502,{error:'Could not save taster session.'}); }
  } catch (err) { console.error('save-taster: network error',err); return json(res,502,{error:'Could not save taster session.'}); }
  return json(res,200,{saved:true});
}
