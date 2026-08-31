// Service-only worker for the VALU v4 marketplace readiness queue.
// Vercel Cron invokes this endpoint; CRON_SECRET prevents public execution.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function json(data, status=200){ return new Response(JSON.stringify(data), { status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'} }); }

export default async function handler(req){
  if(req.method!=='GET' && req.method!=='POST') return json({error:'Method not allowed'},405);
  if(!SUPABASE_URL || !SERVICE_ROLE_KEY || !CRON_SECRET) return json({error:'Server misconfigured.'},500);
  const auth=req.headers.get('authorization') || '';
  const cron=req.headers.get('x-vercel-cron') || '';
  if(auth !== `Bearer ${CRON_SECRET}` && cron !== CRON_SECRET) return json({error:'Unauthorized.'},401);
  try {
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/refresh_professional_readiness_queue`,{
      method:'POST',headers:{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_limit:100})
    });
    if(!r.ok){ console.error('process-readiness-queue:',r.status); return json({error:'Queue processing failed.'},502); }
    const processed=await r.json();
    return json({ok:true,processed:Number(processed)||0});
  } catch(err){ console.error('process-readiness-queue:',err?.message||'unknown'); return json({error:'Queue processing failed.'},502); }
}
