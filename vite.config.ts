import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';

// The access password is never committed. At build time it is read from the
// APP_PASSWORD environment variable (a GitHub Actions secret when deployed)
// and only its salted SHA-256 hash is embedded in the app.
export const PASSWORD_SALT = 'uk-theory-trainer:v1:';

export default defineConfig(({ command }) => {
  let password = process.env.APP_PASSWORD;
  if (!password) {
    if (command === 'build' && process.env.CI) {
      throw new Error('APP_PASSWORD is not set. Add it as a repository secret (Settings → Secrets and variables → Actions).');
    }
    password = 'letmein'; // local development default only
  }
  const hash = createHash('sha256').update(PASSWORD_SALT + password).digest('hex');
  return {
    base: './',
    plugins: [react()],
    define: {
      __PW_HASH__: JSON.stringify(hash),
      __PW_SALT__: JSON.stringify(PASSWORD_SALT),
      __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
    },
    test: { environment: 'node' },
    build: { chunkSizeWarningLimit: 700 },
  };
});
