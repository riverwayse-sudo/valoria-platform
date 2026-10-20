// Supabase Edge Function: sync-lead-to-brevo
// Triggered by a Database Webhook on INSERT to your leads table.
// Pushes the new row straight into Brevo as a contact on your Webinar list.

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? (() => { try { return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}")?.default ?? "" } catch { return "" } })();
const BREVO_LIST_ID = 3; // your "identified_contacts" list

Deno.serve(async (req: Request) => {
  try {
    const auth = req.headers.get("authorization") ?? "";
    if (!SERVICE_ROLE_KEY || auth !== `Bearer ${SERVICE_ROLE_KEY}`) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    const payload = await req.json();
    // Supabase DB webhooks send { type, table, record, old_record }
    const record = payload.record ?? payload;

    const email = (record.email ?? "").trim().toLowerCase();
    if (!email) {
      return new Response(JSON.stringify({ skipped: "no email" }), { status: 200 });
    }

    const brevoRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": Deno.env.get("BREVO_API_KEY") ?? "",
      },
      body: JSON.stringify({
        email,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true, // if contact already exists (e.g. came in via Meta first), update instead of erroring
        attributes: {
          FIRSTNAME: record.full_name ?? "",
          ROLE: record.role ?? "",
          INTEREST: record.interest ?? "",
          SOURCE: record.source ?? "supabase",
        },
      }),
    });

    const result = await brevoRes.json();

    if (!brevoRes.ok) {
      console.error("Brevo error:", result);
      return new Response(JSON.stringify({ error: result }), { status: brevoRes.status });
    }

    return new Response(JSON.stringify({ success: true, brevo: result }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});