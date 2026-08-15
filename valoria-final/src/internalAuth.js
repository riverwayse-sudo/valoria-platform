// Internal API authentication shared by server-only report/email endpoints.
// These routes read or mutate sensitive assessment data and must fail closed.
export function isInternalRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authorization = typeof req?.headers?.get === "function"
    ? req.headers.get("authorization")
    : req?.headers?.authorization;

  return authorization === `Bearer ${secret}`;
}
