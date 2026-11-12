const ALLOWED_SITE_ORIGINS = new Set([
  "https://valoriainstitute.com",
  "https://www.valoriainstitute.com",
  "https://staging.valoriainstitute.com",
  "https://valoria-staging-site.riverwayse.workers.dev",
  "https://valoria-redesign-staging-site.riverwayse.workers.dev",
]);

export function getSiteOrigin(req) {
  const headers = req?.headers;
  const requestOrigin = headers?.get?.("origin") || headers?.origin || headers?.Origin || "";
  if (ALLOWED_SITE_ORIGINS.has(requestOrigin)) return requestOrigin;

  const configured = String(process.env.VALORIA_SITE_URL || "https://valoriainstitute.com").trim().replace(/\/$/, "");
  return ALLOWED_SITE_ORIGINS.has(configured) ? configured : "https://valoriainstitute.com";
}
