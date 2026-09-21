import { createClient } from "npm:@supabase/supabase-js@2"

const url = Deno.env.get("SUPABASE_URL") ?? ""
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => {
  try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default ?? "" } catch { return "" }
})()
const brevoKey = Deno.env.get("BREVO_API_KEY") ?? ""
const listId = Number(Deno.env.get("BREVO_LEAD_LIST_ID") ?? Deno.env.get("BREVO_LIST_ID") ?? "3")
const db = createClient(url, serviceKey, { auth:{autoRefreshToken:false,persistSession:false} })

function retryDelay(attempt:number){ return Math.min(Math.max(60,2**Math.min(attempt,10)*30),21600) }
function names(fullName=""){ const p=fullName.trim().split(/\s+/).filter(Boolean); return {first:p[0]??"",last:p.slice(1).join(" ")} }

Deno.serve(async(req)=>{
  try{
    if(!(req.headers.get("authorization")??"").toLowerCase().startsWith("bearer ")) return Response.json({error:"Unauthorized"},{status:401})
    const body=await req.json().catch(()=>({}))
    const limit=Math.min(Math.max(Number(body?.limit??20),1),50)
    const {data:rows,error}=await db.from("lead_captures").select("*").eq("brevo_synced",false).eq("consent",true).not("email","is",null).lte("brevo_next_attempt_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(limit)
    if(error) throw error
    let synced=0,failed=0
    for(const row of rows??[]){
      const attempt=Number(row.brevo_attempt_count??0)+1
      await db.from("lead_captures").update({brevo_attempt_count:attempt,brevo_last_attempt_at:new Date().toISOString()}).eq("id",row.id)
      try{
        if(!brevoKey) throw new Error("BREVO_NOT_CONFIGURED")
        if(!Number.isFinite(listId)||listId<=0) throw new Error("BREVO_LIST_NOT_CONFIGURED")
        const {first,last}=names(row.full_name)
        const attributes:any={FIRSTNAME:first,LASTNAME:last}
        if(Deno.env.get("BREVO_CUSTOM_ATTRIBUTES_ENABLED")==="true"){
          if(row.role) attributes.ROLE=row.role
          if(row.interest) attributes.INTEREST=row.interest
          attributes.SOURCE=row.source??"supabase"
          if(row.source_detail) attributes.SOURCE_DETAIL=row.source_detail
          if(row.utm_source) attributes.UTM_SOURCE=row.utm_source
          if(row.utm_medium) attributes.UTM_MEDIUM=row.utm_medium
          if(row.utm_campaign) attributes.UTM_CAMPAIGN=row.utm_campaign
        }
        const res=await fetch("https://api.brevo.com/v3/contacts",{method:"POST",headers:{"accept":"application/json","content-type":"application/json","api-key":brevoKey},body:JSON.stringify({email:String(row.email).trim().toLowerCase(),attributes,listIds:[listId],updateEnabled:true})})
        const responseText=await res.text(); let result:any={}; try{result=responseText?JSON.parse(responseText):{}}catch{}
        if(!res.ok) throw new Error("BREVO_CONTACT_"+res.status+": "+String(result?.message??responseText).slice(0,220))
        await db.from("lead_captures").update({brevo_synced:true,brevo_synced_at:new Date().toISOString(),brevo_last_error:null,brevo_next_attempt_at:new Date().toISOString(),brevo_contact_id:result?.id!=null?String(result.id):null}).eq("id",row.id)
        synced++
      }catch(err){
        failed++
        await db.from("lead_captures").update({brevo_last_error:String(err?.message??err).slice(0,500),brevo_next_attempt_at:new Date(Date.now()+retryDelay(attempt)*1000).toISOString()}).eq("id",row.id)
      }
    }
    return Response.json({ok:true,selected:rows?.length??0,synced,failed,brevo_configured:Boolean(brevoKey),list_id_configured:Number.isFinite(listId)&&listId>0})
  }catch(err){ console.error("sync-leads-to-brevo",err); return Response.json({ok:false,error:String(err?.message??err).slice(0,500)},{status:500}) }
})