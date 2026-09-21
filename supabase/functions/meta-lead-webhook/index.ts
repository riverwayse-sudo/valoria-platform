import { createClient } from "npm:@supabase/supabase-js@2"

const url=Deno.env.get("SUPABASE_URL")??""
const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??""
const verifyToken=Deno.env.get("META_VERIFY_TOKEN")??""
const appSecret=Deno.env.get("META_APP_SECRET")??""
const pageId=Deno.env.get("META_PAGE_ID")??""
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}})

function safe(a:Uint8Array,b:Uint8Array){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0}
async function hmac(secret:string,body:string){const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const s=await crypto.subtle.sign("HMAC",k,new TextEncoder().encode(body));return Array.from(new Uint8Array(s)).map(x=>x.toString(16).padStart(2,"0")).join("")}

Deno.serve(async(req)=>{
  if(req.method==="GET"){
    const q=new URL(req.url).searchParams
    if(q.get("hub.mode")==="subscribe"&&verifyToken&&q.get("hub.verify_token")===verifyToken)return new Response(q.get("hub.challenge")??"",{status:200})
    return new Response("Forbidden",{status:403})
  }
  if(req.method!=="POST")return new Response("Method Not Allowed",{status:405})
  if(!appSecret)return Response.json({error:"META_APP_SECRET_NOT_CONFIGURED"},{status:503})
  const raw=await req.text();const sig=req.headers.get("x-hub-signature-256")??"";const expected=await hmac(appSecret,raw)
  if(!sig.startsWith("sha256=")||!safe(new TextEncoder().encode(sig.slice(7)),new TextEncoder().encode(expected)))return new Response("Invalid signature",{status:403})
  let payload:any;try{payload=JSON.parse(raw)}catch{return Response.json({error:"Invalid JSON"},{status:400})}
  if(payload?.object!=="page")return Response.json({ok:true,ignored:true})
  let queued=0
  for(const entry of payload.entry??[])for(const change of entry.changes??[]){
    if(change.field!=="leadgen")continue
    const v=change.value??{},leadgenId=String(v.leadgen_id??"").trim()
    if(!leadgenId)continue
    if(pageId&&String(entry.id)!==pageId)continue
    const {error}=await db.from("meta_lead_events").upsert({leadgen_id:leadgenId,page_id:v.page_id?String(v.page_id):String(entry.id??""),form_id:v.form_id?String(v.form_id):null,ad_id:v.ad_id?String(v.ad_id):null,adset_id:v.adset_id?String(v.adset_id):null,created_time:v.created_time?new Date(Number(v.created_time)*1000).toISOString():null,payload,next_attempt_at:new Date().toISOString(),last_error:null},{onConflict:"leadgen_id"})
    if(error){console.error("meta lead queue",error);return Response.json({error:"QUEUE_FAILED"},{status:500})}
    queued++
  }
  return Response.json({ok:true,queued})
})