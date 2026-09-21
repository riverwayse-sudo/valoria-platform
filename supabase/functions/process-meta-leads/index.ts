import { createClient } from "npm:@supabase/supabase-js@2"

const url=Deno.env.get("SUPABASE_URL")??""
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""
const token=Deno.env.get("META_PAGE_ACCESS_TOKEN")??""
const version=Deno.env.get("META_GRAPH_API_VERSION")??""
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})
function delay(n:number){return Math.min(Math.max(60,2**Math.min(n,10)*30),21600)}
function mapFields(a:any[]){const m:any={};for(const x of Array.isArray(a)?a:[]){const k=String(x?.name??"").trim().toLowerCase();if(k)m[k]=Array.isArray(x?.values)?x.values[0]:x?.values??x?.value??""}return m}
function pick(m:any,keys:string[]){for(const k of keys){const v=m[k];if(v!=null&&String(v).trim())return String(v).trim()}return ""}
async function getLead(id:string){
  if(!token)throw new Error("META_PAGE_ACCESS_TOKEN_NOT_CONFIGURED")
  const base=version?"https://graph.facebook.com/"+version+"/"+encodeURIComponent(id):"https://graph.facebook.com/"+encodeURIComponent(id)
  const q=new URLSearchParams({access_token:token,fields:"id,created_time,field_data,ad_id,adset_id,form_id,page_id"})
  const r=await fetch(base+"?"+q.toString(),{headers:{accept:"application/json"}});const t=await r.text();let b:any={};try{b=t?JSON.parse(t):{}}catch{}
  if(!r.ok)throw new Error("META_GRAPH_"+r.status+": "+String(b?.error?.message??t).slice(0,300));return b
}
Deno.serve(async req=>{
  try{
    if(!(req.headers.get("authorization")??"").toLowerCase().startsWith("bearer "))return Response.json({error:"Unauthorized"},{status:401})
    const p=await req.json().catch(()=>({}));const limit=Math.min(Math.max(Number(p?.limit??20),1),50)
    const {data:events,error}=await db.from("meta_lead_events").select("*").is("processed_at",null).lte("next_attempt_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(limit)
    if(error)throw error
    let processed=0,failed=0,skipped=0
    for(const e of events??[]){
      const attempt=Number(e.attempt_count??0)+1
      await db.from("meta_lead_events").update({attempt_count:attempt}).eq("id",e.id)
      try{
        const lead=await getLead(e.leadgen_id);const f=mapFields(lead.field_data)
        const email=pick(f,["email","e-mail"]);const fullName=pick(f,["full_name","fullname","name"])||[pick(f,["first_name","firstname"]),pick(f,["last_name","lastname"])].filter(Boolean).join(" ")
        const row={source:"meta_lead_ads",external_id:"meta:"+e.leadgen_id,full_name:fullName||null,email:email?email.toLowerCase():null,phone:pick(f,["phone_number","phone","mobile"])||null,role:pick(f,["job_title","job","role"])||null,organisation:pick(f,["company_name","company","organisation","organization"])||null,source_detail:e.form_id,meta_page_id:e.page_id,meta_form_id:e.form_id,meta_leadgen_id:e.leadgen_id,meta_ad_id:e.ad_id,meta_adset_id:e.adset_id,meta_field_data:lead.field_data??[],raw_payload:{webhook:e.payload,lead},consent:true,consent_basis:"meta_lead_ad_form",created_at:lead.created_time??e.created_time??e.created_at,meta_processed_at:new Date().toISOString(),brevo_synced:false,brevo_next_attempt_at:new Date().toISOString(),brevo_last_error:email?null:"META_LEAD_MISSING_EMAIL"}
        const {error:upsertError}=await db.from("lead_captures").upsert(row,{onConflict:"source,external_id"});if(upsertError)throw upsertError
        await db.from("meta_lead_events").update({processed_at:new Date().toISOString(),last_error:null}).eq("id",e.id)
        if(email)processed++;else skipped++
      }catch(err){failed++;await db.from("meta_lead_events").update({last_error:String(err?.message??err).slice(0,500),next_attempt_at:new Date(Date.now()+delay(attempt)*1000).toISOString()}).eq("id",e.id)}
    }
    return Response.json({ok:true,selected:events?.length??0,processed,failed,skipped,meta_configured:Boolean(token)})
  }catch(err){console.error("process-meta-leads",err);return Response.json({ok:false,error:String(err?.message??err).slice(0,500)},{status:500})}
})