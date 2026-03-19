import { config as dotenv } from 'dotenv';
import http from 'http';
import { parseConfig, type EnvSchema } from './config.js';
import { DatabaseManager } from './core/database.js';
import { ToolRegistry } from './tools/registry.js';
import { Agent } from './core/agent.js';
import { createBot } from './bot/bot.js';
import { FirestoreService } from './services/database/firestore.js';

dotenv();

const PORT = parseInt(process.env.PORT || '7860', 10);

function createHealthCheckServer(): http.Server {
  const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'opengravity'
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_found' }));
    }
  });
  return server;
}

async function main() {
  console.log('🤖 OpenGravity Core v1.0 - Initializing...');

  const config = parseConfig(process.env as EnvSchema);

  console.log(`[Config] Telegram: ${config.telegram.allowedUserIds.length} user(s) allowed`);
  console.log(`[Config] LLM: Groq (${config.llm.groqModel})`);

  const db = new DatabaseManager(config.database.dbPath);
  console.log(`[Database] Initialized at ${config.database.dbPath}`);

  const firestore = new FirestoreService('service-account.json');

  const tools = new ToolRegistry();
  tools.initialize(config, db);
  console.log(`[Tools] ${tools.names.length} tools registered`);

  const agent = new Agent(config, db, tools, firestore);

  const bot = await createBot(config, agent, db);
  console.log('[Bot] Ready - Starting long polling...');

  const healthServer = createHealthCheckServer();
  healthServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Health] Server running on port ${PORT}`);
  });

  await bot.start();
  console.log('[OpenGravity] Bot is live! Press Ctrl+C to stop.');

  process.on('SIGINT', async () => {
    console.log('\n[OpenGravity] Shutting down...');
    healthServer.close();
    await bot.stop();
    db.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[OpenGravity] Received SIGTERM, shutting down...');
    healthServer.close();
    await bot.stop();
    db.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[OpenGravity] Fatal error:', error);
  process.exit(1);
});
