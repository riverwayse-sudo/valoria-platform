const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function requireUser(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match || !SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${match[1]}`,
    },
  });

  if (!response.ok) return null;
  return response.json();
}

export function serverConfigOk() {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}
