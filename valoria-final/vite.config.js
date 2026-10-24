import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The public site origin this assessment app belongs to. Vite replaces
// __SITE_ORIGIN__ with a string literal at build time, so no env object is
// needed at runtime and the value is tree-shaken into the bundle.
//
// Deliberately NOT import.meta.env.VITE_SITE_URL: Jest transforms this app with
// Babel, which rejects `import.meta` ("Cannot use 'import.meta' outside a
// module"), so any module reading it could not be imported by a test. Vite's
// `define` substitution happens before Babel would ever see it.
const SITE_ORIGIN = (process.env.VALORIA_SITE_URL || 'https://valoriainstitute.com').replace(/\/$/, '');

export default defineConfig({
  define: { __SITE_ORIGIN__: JSON.stringify(SITE_ORIGIN) },
  // VALU is served as a first-class route of the Valoria application.
  // The standalone assessment deployment remains only as the upstream origin during migration.
  base: '/valu/assessment/',
  plugins: [react()],
  publicDir: 'public',
  server: {
    fs: {
      strict: true,
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
});
