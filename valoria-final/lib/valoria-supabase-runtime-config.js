export function getValoriaSupabaseConfig(env = process.env) {
  if (env.VERCEL_ENV === 'preview') {
    const url = String(env.VALU_PREVIEW_SUPABASE_URL || '').trim();
    const serviceRoleKey = String(env.VALU_PREVIEW_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const anonKey = String(env.VALU_PREVIEW_SUPABASE_ANON_KEY || '').trim();
    const publicUrl = String(env.VITE_SUPABASE_URL || '').trim();
    const publicAnonKey = String(env.VITE_SUPABASE_ANON_KEY || '').trim();

    if (!url || !serviceRoleKey || !anonKey || !publicUrl || !publicAnonKey || anonKey !== publicAnonKey) return null;
    try {
      const previewOrigin = new URL(url).origin;
      const publicOrigin = new URL(publicUrl).origin;
      if (previewOrigin !== publicOrigin) return null;
      return { url: previewOrigin, serviceRoleKey };
    } catch {
      return null;
    }
  }

  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  try {
    return { url: new URL(url).origin, serviceRoleKey };
  } catch {
    return null;
  }
}
