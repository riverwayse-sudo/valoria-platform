import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default ?? "" } catch { return "" } })()
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? ""
const FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") ?? "info@valoriainstitute.com"
const FROM_NAME = Deno.env.get("BREVO_FROM_NAME") ?? "Valoria Institute"
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} })

const ASSESSMENT_URL = "https://assessment.valoriainstitute.com/"
const PROFILE_URL = "https://valoriainstitute.com/profile/setup"

async function isPrivileged(req:Request):Promise<boolean>{
  const match=(req.headers.get("authorization")??"").match(/^Bearer\s+(.+)$/i)
  if(!match)return false
  const bearer=match[1]
  if(SERVICE_ROLE_KEY && bearer===SERVICE_ROLE_KEY)return true
const invokeKey=req.headers.get("x-valoria-function-key")
  if(invokeKey){
    const {data:validInvokeKey,error:invokeKeyError}=await db.rpc("is_valid_valoria_function_invoke_key",{p_key:invokeKey})
    if(!invokeKeyError && validInvokeKey===true)return true
  }
    try{
    const {data:{user},error}=await db.auth.getUser(bearer)
    if(error||!user)return false
    const {data:admin,error:adminError}=await db.from("admin_users").select("id").eq("id",user.id).maybeSingle()
    return !adminError && Boolean(admin)
  }catch{return false}
}
function escapeHtml(v="") {
  return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]??c))
}
function nextDelayDays(stage) { return [2,3,5][stage] ?? null }

async function sendEmail(candidate) {
  if (!BREVO_API_KEY) throw new Error("BREVO_NOT_CONFIGURED")
  const firstName = escapeHtml((candidate.full_name || candidate.display_name || "there").trim().split(/\s+/)[0] || "there")
  const missingAssessment = Boolean(candidate.missing_assessment)
  const missingProfile = Boolean(candidate.missing_profile)
  const primaryUrl = missingAssessment ? ASSESSMENT_URL : PROFILE_URL
  const primaryLabel = missingAssessment ? "COMPLETE YOUR VALU INDEX →" : "COMPLETE YOUR PROFILE →"

  let subject = "Your Valoria profile is waiting"
  let headline = "Your professional signal<br><em>isn't finished yet.</em>"
  let body = "You have already started your Valoria journey. There is one important step still waiting for you."
  if (missingAssessment && missingProfile) {
    subject = "Complete your VALU Index and professional profile"
    headline = "Complete the journey.<br><em>Make your capability visible.</em>"
    body = "You started the Valoria journey, but your professional record is not yet complete. Start with the VALU Index, then finish your professional profile."
  } else if (missingAssessment) {
    subject = "Complete your VALU Index"
    headline = "You started.<br><em>Now complete your assessment.</em>"
    body = "Your Valoria account is ready, but your VALU Index is not yet complete. Finish the assessment so your professional record can move forward."
  } else if (missingProfile) {
    subject = "Your Valoria professional profile is incomplete"
    headline = "Your assessment is complete.<br><em>Now finish your profile.</em>"
    body = "Your VALU assessment is complete. The next step is to finish your professional profile so your capability can be properly represented and considered for the relevant marketplace pathway."
  }

  const checklist = [
    missingAssessment ? "Complete your VALU Index" : null,
    missingProfile ? "Finish your professional profile" : null
  ].filter(Boolean).map(x => '<li style="margin:0 0 9px;color:rgba(247,244,238,.72)">'+escapeHtml(x)+"</li>").join("")

  const extraProfileLink = (missingAssessment && missingProfile)
    ? '<p style="text-align:center;margin:12px 0 0"><a href="'+PROFILE_URL+'" style="color:#C9A84C;font-size:11px;text-decoration:none;letter-spacing:.05em">FINISH YOUR PROFILE AFTER THE ASSESSMENT →</a></p>'
    : ""

  const html =
    '<div style="margin:0;padding:40px 20px;background:#1A1A2E;font-family:Arial,sans-serif;color:#F7F4EE">'+
    '<div style="max-width:580px;margin:0 auto;background:#1A1A2E;border:1px solid rgba(201,168,76,.24);padding:40px">'+
    '<div style="font-size:11px;font-weight:700;letter-spacing:.18em;color:#C9A84C">VALORIA INSTITUTE</div>'+
    '<h1 style="font-weight:300;font-size:30px;line-height:1.15;margin:22px 0 14px">'+headline+"</h1>"+
    '<p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,.68)">Hi '+firstName+",</p>"+
    '<p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,.68)">'+body+"</p>"+
    '<div style="margin:24px 0;padding:20px;border:1px solid rgba(201,168,76,.18);background:rgba(201,168,76,.04)">'+
    '<div style="font-size:10px;letter-spacing:.15em;color:rgba(201,168,76,.75);font-weight:700;margin-bottom:12px">WHAT REMAINS</div>'+
    '<ul style="padding-left:20px;margin:0;font-size:13px;line-height:1.7">'+checklist+"</ul></div>"+
    '<p style="font-size:13px;line-height:1.8;color:rgba(247,244,238,.58)">Completing these steps gives Valoria the information required to establish your professional record and determine the relevant next stage of your journey.</p>'+
    '<p style="text-align:center;margin:30px 0"><a href="'+primaryUrl+'" style="display:inline-block;background:#C9A84C;color:#1A1A2E;padding:15px 26px;text-decoration:none;font-weight:700;letter-spacing:.07em;font-size:11px">'+primaryLabel+"</a></p>"+
    extraProfileLink+
    '<p style="font-size:11px;line-height:1.7;color:rgba(247,244,238,.38);margin-top:28px">Your record will stop receiving completion reminders once the required steps are complete.</p>'+
    '<div style="margin-top:30px;padding-top:20px;border-top:1px solid rgba(255,255,255,.07);font-size:10px;color:rgba(247,244,238,.28);letter-spacing:.05em">WORTH. BUILT. · VALORIA INSTITUTE</div>'+
    "</div></div>"

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method:"POST",
    headers:{"api-key":BREVO_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      sender:{name:FROM_NAME,email:FROM_EMAIL},
      to:[{email:candidate.email,name:candidate.full_name||candidate.display_name||firstName}],
      replyTo:{name:FROM_NAME,email:FROM_EMAIL},
      subject,
      htmlContent:html,
      tags:["valoria","assessment-completion",missingAssessment?"assessment":"profile"]
    })
  })
  const text = await response.text()
  if (!response.ok) throw new Error("BREVO_EMAIL_"+response.status+": "+text.slice(0,300))
}

Deno.serve(async(req)=>{
  try {
    if(!(await isPrivileged(req))) return Response.json({error:"Unauthorized"},{status:401})
    const payload = await req.json().catch(()=>({}))
    const limit = Math.min(Math.max(Number(payload?.limit??20),1),50)

    const [uRes,pRes,aRes] = await Promise.all([
      db.from("users").select("id,email,full_name,user_type,created_at").eq("user_type","professional").not("email","is",null),
      db.from("professional_profiles").select("id,display_name,profile_complete,assessment_completed_at"),
      db.from("valu_assessments").select("user_id,completed_at").not("completed_at","is",null)
    ])
    if (uRes.error) throw uRes.error
    if (pRes.error) throw pRes.error
    if (aRes.error) throw aRes.error

    const profileMap = new Map((pRes.data??[]).map(p=>[p.id,p]))
    const assessedIds = new Set((aRes.data??[]).map(a=>a.user_id).filter(Boolean))
    const candidates = (uRes.data??[]).map(u=>{
      const p=profileMap.get(u.id)
      const missingAssessment=!assessedIds.has(u.id)
      const missingProfile=!p || p.profile_complete!==true
      return {...u,display_name:p?.display_name??null,missing_assessment:missingAssessment,missing_profile:missingProfile,done:!missingAssessment&&!missingProfile}
    })

    for (const c of candidates) {
      if (c.done) {
        await db.from("assessment_completion_reminders").update({completed_at:new Date().toISOString(),updated_at:new Date().toISOString(),missing_assessment:false,missing_profile:false}).eq("user_id",c.id)
      } else {
        await db.from("assessment_completion_reminders").upsert({user_id:c.id,missing_assessment:c.missing_assessment,missing_profile:c.missing_profile,updated_at:new Date().toISOString()},{onConflict:"user_id",ignoreDuplicates:false})
      }
    }

    const dueRes = await db.from("assessment_completion_reminders")
      .select("user_id,reminder_stage,missing_assessment,missing_profile,last_sent_at,next_send_at,attempt_count")
      .is("completed_at",null).is("campaign_completed_at",null)
      .lte("next_send_at",new Date().toISOString()).order("next_send_at",{ascending:true}).limit(limit)
    if (dueRes.error) throw dueRes.error

    const byId=new Map(candidates.map(c=>[c.id,c]))
    let sent=0,failed=0,skipped=0
    for (const row of dueRes.data??[]) {
      const c=byId.get(row.user_id)
      if (!c || c.done) { skipped++; continue }
      const attemptCount=Number(row.attempt_count??0)+1
      const stage=Number(row.reminder_stage??0)
      await db.from("assessment_completion_reminders").update({attempt_count:attemptCount,last_error:null,updated_at:new Date().toISOString()}).eq("user_id",row.user_id)
      try {
        await sendEmail(c)
        const nextDays=nextDelayDays(stage)
        const nextStage=stage+1
        const exhausted=nextDays===null
        const nextSend=nextDays?new Date(Date.now()+nextDays*86400000).toISOString():new Date("9999-12-31T00:00:00Z").toISOString()
        await db.from("assessment_completion_reminders").update({
          reminder_stage:nextStage,last_sent_at:new Date().toISOString(),next_send_at:nextSend,
          campaign_completed_at:exhausted?new Date().toISOString():null,last_error:null,updated_at:new Date().toISOString()
        }).eq("user_id",row.user_id)
        sent++
      } catch(err) {
        failed++
        const retryMinutes=Math.min(1440,Math.max(30,2**Math.min(attemptCount,8)*5))
        await db.from("assessment_completion_reminders").update({
          last_error:String(err?.message??err).slice(0,500),
          next_send_at:new Date(Date.now()+retryMinutes*60000).toISOString(),
          updated_at:new Date().toISOString()
        }).eq("user_id",row.user_id)
      }
    }

    return Response.json({ok:true,candidates:candidates.filter(c=>!c.done).length,due:dueRes.data?.length??0,sent,failed,skipped})
  } catch(err) {
    console.error("assessment-completion-reminders",err)
    return Response.json({ok:false,error:String(err?.message??err).slice(0,500)},{status:500})
  }
})