import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
