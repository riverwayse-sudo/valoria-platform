// Single source of truth for when the site opens to the public.
//
// Both the server (middleware.js) and the client (Nav.jsx) import this
// exact module, so they can never disagree about whether the gate is
// open — that mismatch is exactly the kind of bug that only shows up
// on launch day itself, when it's hardest to fix fast.
//
// Reads NEXT_PUBLIC_LAUNCH_DATE so the value is:
//   (a) identical on server and client (NEXT_PUBLIC_ vars are available
//       in both — Next.js only *additionally* inlines them into the
//       client bundle, it doesn't hide them from server code), and
//   (b) changeable from Vercel's dashboard without touching code, in
//       case the date or time ever shifts.

const DEFAULT_LAUNCH_DATE = '2026-07-18T10:15:00+01:00' // 10:15 AM WAT (Africa/Lagos, UTC+1 year-round)

export const LAUNCH_DATE = new Date(
  process.env.NEXT_PUBLIC_LAUNCH_DATE || DEFAULT_LAUNCH_DATE
)

export function isLaunched(now = Date.now()) {
  return now >= LAUNCH_DATE.getTime()
}
