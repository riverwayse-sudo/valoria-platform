import { createClient } from "npm:@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default ?? "" } catch { return "" } })()
const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY") ?? ""
const FROM_EMAIL = Deno.env.get("BREVO_FROM_EMAIL") ?? "info@valoriainstitute.com"
const FROM_NAME = Deno.env.get("BREVO_FROM_NAME") ?? "Valoria Institute"
const LOGO_URL = "https://raw.githubusercontent.com/riverwayse-sudo/valoria-site/main/public/logo.png"
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth:{autoRefreshToken:false,persistSession:false} })

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
function delay(attempt:number){ return Math.min(Math.max(60,2 ** Math.min(attempt,10) * 30),21600) }
function escapeHtml(v=""){ return String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]??c)) }

async function sendEmail(row:any, config:any){
  if(!BREVO_API_KEY) throw new Error("BREVO_NOT_CONFIGURED")
  if(!config.meeting_link) throw new Error("MEETING_LINK_NOT_CONFIGURED")

  const firstName = escapeHtml((row.full_name ?? "there").trim().split(/\s+/)[0] || "there")
  const title = escapeHtml(config.event_title)
  const meeting = escapeHtml(config.meeting_link)
  const date = new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(config.event_start))
  const time = new Intl.DateTimeFormat("en-NG",{timeZone:"Africa/Lagos",hour:"numeric",minute:"2-digit",hour12:true}).format(new Date(config.event_start))

  const start=new Date(config.event_start)
  const end=new Date(config.event_end)
  const icsDate=(d)=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,"Z")
  const uid="valoria-"+config.event_session_id+"-"+String(row.email).trim().toLowerCase().replace(/[^a-z0-9]/g,"")
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Valoria Institute//Events//EN","CALSCALE:GREGORIAN","METHOD:PUBLISH","BEGIN:VEVENT","UID:"+uid,"DTSTAMP:"+icsDate(new Date()),"DTSTART:"+icsDate(start),"DTEND:"+icsDate(end),"SUMMARY:"+config.event_title,"DESCRIPTION:Join the Valoria Institute session: "+config.meeting_link,"LOCATION:"+config.meeting_link,"STATUS:CONFIRMED","END:VEVENT","END:VCALENDAR"].join("\r\n")
  const calendarBase64=btoa(unescape(encodeURIComponent(ics)))
  const googleCalendarUrl="https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(config.event_title)+"&dates="+icsDate(start)+"/"+icsDate(end)+"&details="+encodeURIComponent("Join the session: "+config.meeting_link)+"&location="+encodeURIComponent(config.meeting_link)
  const html = `<div style="margin:0;padding:40px 20px;background:#1A1A2E;font-family:Arial,sans-serif;color:#F7F4EE">
    <div style="max-width:560px;margin:0 auto;background:#1A1A2E;border:1px solid rgba(201,168,76,.25);padding:40px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.18em;color:#C9A84C">VALORIA INSTITUTE</div>
      <h1 style="font-weight:300;font-size:30px;line-height:1.15;margin:22px 0 14px">Your meeting link<br/><em style="color:#C9A84C">is here.</em></h1>
      <p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,.68)">Hi ${firstName},</p>
      <p style="font-size:14px;line-height:1.8;color:rgba(247,244,238,.68)">You're registered for <strong style="color:#F7F4EE">${title}</strong>.</p>
      <div style="margin:24px 0;padding:18px;border:1px solid rgba(201,168,76,.18);background:rgba(201,168,76,.04)">
        <div style="font-size:10px;letter-spacing:.15em;color:rgba(201,168,76,.7);font-weight:700">SESSION</div>
        <div style="font-size:15px;margin-top:8px;color:#F7F4EE">${date}</div>
        <div style="font-size:15px;margin-top:4px;color:#F7F4EE">${time} WAT</div>
      </div>
      <p style="text-align:center;margin:30px 0">
        <a href="${meeting}" style="display:inline-block;background:#C9A84C;color:#1A1A2E;padding:15px 28px;text-decoration:none;font-weight:700;letter-spacing:.08em;font-size:12px">JOIN THE SESSION →</a>
      </p>
      <p style="text-align:center;margin:10px 0 24px"><a href="${googleCalendarUrl}" style="display:inline-block;border:1px solid #C9A84C;color:#C9A84C;padding:12px 20px;text-decoration:none;font-weight:700;font-size:11px;letter-spacing:.06em">ADD TO GOOGLE CALENDAR</a></p>
      <p style="font-size:11px;line-height:1.7;color:rgba(247,244,238,.4)">A calendar invitation is attached to this email. Save it to your calendar so you have the session time and meeting link available.<br/><br/>We look forward to seeing you.</p>
    </div>
  </div>`

  const response = await fetch("https://api.brevo.com/v3/smtp/email",{
    method:"POST",
    headers:{"api-key":BREVO_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      sender:{name:FROM_NAME,email:FROM_EMAIL},
      to:[{email:row.email,name:row.full_name||firstName}],
      replyTo:{name:FROM_NAME,email:FROM_EMAIL},
      subject:`Your Valoria meeting link — ${config.event_title}`,
      htmlContent:html,
      tags:["valoria","meeting-link","calendar-invite",row.source,config.event_session_id],
      attachment:[{content:calendarBase64,name:`valoria-session-${config.event_session_id}.ics`}]
    })
  })
  const text = await response.text()
  if(!response.ok) throw new Error(`BREVO_EMAIL_${response.status}: ${text.slice(0,300)}`)
}

Deno.serve(async(req)=>{
  try{
    if(!(await isPrivileged(req))) return Response.json({error:"Unauthorized"},{status:401})
    const payload=await req.json().catch(()=>({}))
    const limit=Math.min(Math.max(Number(payload?.limit??20),1),50)
    const sourceFilter=typeof payload?.source==="string" ? payload.source : null

    const source=sourceFilter ?? "event_registration"
    const {data:rows,error}=await db
      .from("lead_captures")
      .select("*")
      .eq("source",source)
      .eq("automation_sent",false)
      .eq("consent",true)
      .not("email","is",null)
      .lte("automation_next_attempt_at",new Date().toISOString())
      .order("created_at",{ascending:true})
      .limit(limit)

    if(error) throw error

    let sent=0,failed=0
    for(const row of rows??[]){
      const attempt=Number(row.automation_attempt_count??0)+1
      await db.from("lead_captures").update({automation_attempt_count:attempt,automation_last_attempt_at:new Date().toISOString()}).eq("id",row.id)
      try{
        // Event registrations must resolve automation by the registered session.
        // Never fall back to the first enabled event configuration: that can send
        // a previous event's meeting details/assets to a new registrant.
        const configQuery = db.from("lead_automation_configs")
          .select("*")
          .eq("source",source)
          .eq("enabled",true)
          .not("meeting_link","is",null)
          .limit(1)
        const {data:configs,error:configError} = source === "event_registration" && row.event_session_id
          ? await configQuery.eq("event_session_id",row.event_session_id)
          : await configQuery
        if(configError) throw configError
        const config=configs?.[0]
        if(!config) throw new Error(
          source === "event_registration"
            ? `EVENT_AUTOMATION_NOT_CONFIGURED_FOR_SESSION_${row.event_session_id || "UNKNOWN"}`
            : "EVENT_AUTOMATION_NOT_CONFIGURED"
        )
        await sendEmail(row,config)
        await db.from("lead_captures").update({automation_sent:true,automation_sent_at:new Date().toISOString(),automation_last_error:null,automation_next_attempt_at:new Date().toISOString()}).eq("id",row.id)
        sent++
      }catch(err){
        failed++
        await db.from("lead_captures").update({automation_last_error:String(err?.message??err).slice(0,500),automation_next_attempt_at:new Date(Date.now()+delay(attempt)*1000).toISOString()}).eq("id",row.id)
      }
    }

    return Response.json({ok:true,selected:rows?.length??0,sent,failed,configured:Boolean(BREVO_API_KEY)})
  }catch(err){
    console.error("send-lead-meeting-link",err)
    return Response.json({ok:false,error:String(err?.message??err).slice(0,500)},{status:500})
  }
})