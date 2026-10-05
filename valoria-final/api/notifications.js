export const config = { runtime: "edge" };

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default async function handler(req) {
  if (!["GET","PATCH"].includes(req.method)) return json({ error: "Method not allowed" }, 405);
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token || !SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Unauthorized" }, 401);

  const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!authRes.ok) return json({ error: "Unauthorized" }, 401);
  const authUser = await authRes.json();
  const userId = authUser?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  const adminHeaders = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

  if (req.method === "GET") {
    const params = new URLSearchParams({
      user_id: `eq.${userId}`,
      select: "id,type,title,body,action_label,action_url,read_at,created_at",
      order: "created_at.desc",
      limit: "30",
    });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/notifications?${params}`, { headers: adminHeaders });
    if (!res.ok) return json({ error: "Could not load notifications." }, 502);
    return json({ notifications: await res.json() });
  }

  let payload;
  try { payload = await req.json(); } catch { return json({ error: "Invalid request body" }, 400); }
  if (!payload?.id) return json({ error: "Notification id is required." }, 400);

  const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/notifications?id=eq.${encodeURIComponent(payload.id)}&user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...adminHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  if (!updateRes.ok) return json({ error: "Could not update notification." }, 502);
  return json({ success: true });
}
