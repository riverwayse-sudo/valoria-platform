// Public origin of the valoria-site deployment this assessment app belongs to.
//
// Every outbound link in this app (sign in, sign up, journey continuation,
// report, profile setup) points at a site route. Those were hardcoded to
// https://valoriainstitute.com, so on staging the assessment handed the
// participant back to production and the staging journey was never completed.
//
// __SITE_ORIGIN__ is replaced with a string literal by Vite at build time (see
// vite.config.js) from VALORIA_SITE_URL. The typeof guard keeps the module
// importable in Jest, where Vite's substitution has not run: Babel rejects
// `import.meta`, so the value must not come from import.meta.env.
export const SITE_ORIGIN =
  typeof __SITE_ORIGIN__ !== 'undefined' && __SITE_ORIGIN__
    ? String(__SITE_ORIGIN__).replace(/\/$/, '')
    : 'https://valoriainstitute.com';

// Absolute URL for a site path. `path` is expected to be a leading-slash route.
export function siteUrl(path = '/') {
  return `${SITE_ORIGIN}${path}`;
}
