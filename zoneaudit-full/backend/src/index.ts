import { createApp } from './app.js';
import { buildContext } from './bootstrap.js';
import { loadConfig } from './config.js';

// Load backend/.env if present (Node built-in; real environment variables win).
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

const cfg = loadConfig();
const ctx = await buildContext(cfg);
const app = createApp(ctx);

const server = app.listen(cfg.port, () => {
  console.log(`[server] http://localhost:${cfg.port}  env=${cfg.env}  dataverse=${cfg.dataverse.mode}  google=${cfg.google.clientId ? 'on' : 'off'}`);
});

const shutdown = () => {
  server.close(() => {
    ctx.store.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
