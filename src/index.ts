import { Launcher } from './core/launcher.js';
import http from 'http';
import { DASHBOARD_HTML } from './utils/dashboard_html.js';

const PORT = parseInt(process.env.PORT || '7860', 10);

function createHealthCheckServer(obs: any): http.Server {
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'opengravity'
      }));
    } else if (req.url === '/api/status' && obs) {
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ 
        events: obs.getEvents() 
      }));
    } else if (req.url === '/dashboard' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(DASHBOARD_HTML);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_found' }));
    }
  });
  return server;
}

async function main() {
  const launcher = new Launcher();
  const { bot, db, obs } = await launcher.bootstrap();

  console.log('[Bot] Ready - Starting long polling...');

  const healthServer = createHealthCheckServer(obs);
  healthServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Health] Server running on port ${PORT}`);
  });

  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log('[Bot] Webhook cleared successfully.');
  } catch (err) {
    console.warn('[Bot] Warning: Could not clear webhook (DNS/Network issue). Continuing anyway...');
  }
  
  console.log('[Bot] Webhook check finished.');
  console.log('[OpenGravity] Bot is live! Press Ctrl+C to stop.');
  await bot.start();

  const shutdown = async (signal: string) => {
    console.log(`\n[OpenGravity] Received ${signal}, shutting down...`);
    healthServer.close();
    await bot.stop();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[OpenGravity] Fatal error:', error);
  process.exit(1);
});
