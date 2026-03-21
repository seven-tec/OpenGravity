import { config } from 'dotenv';
import http from 'http';
import dns from 'node:dns';
import fs from 'fs';
import path from 'path';
import { parseConfig, type EnvSchema } from './config.js';
import { DatabaseManager } from './core/database.js';
import { ToolRegistry } from './tools/registry.js';
import { Agent } from './core/agent.js';
import { createBot } from './bot/bot.js';
import { FirestoreService } from './services/database/firestore.js';
import { AudioService } from './services/audio/audio_service.js';
import { TTSInterface } from './services/audio/tts_interface.js';

// Override system DNS if needed
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  console.log('[System] DNS servers set to 8.8.8.8, 1.1.1.1');
} catch (e) {
  console.warn('[System] Could not override DNS servers.');
}

config(); // Changed from dotenv();

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
    } else if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OpenGravity Service is running. Check /health for status.');
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'not_found' }));
    }
  });
  return server;
}

async function main() {
  console.log('🤖 OpenGravity Core v1.2-ARCHITECT - Initializing...');

  // --- Google Workspace ADC Secret Injection ---
  if (process.env.GOG_CREDENTIALS) {
    try {
      const credsPath = path.join(process.cwd(), 'adc.json');
      fs.writeFileSync(credsPath, process.env.GOG_CREDENTIALS);
      process.env.GOG_AUTH_MODE = 'adc';
      process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
      console.log('🔐 [Auth] Google Workspace ADC configured from environment');
    } catch (e) {
      console.error('❌ [Auth] Failed to write Google credentials', e);
    }
  }

  const config = parseConfig(process.env as EnvSchema);

  console.log(`[Config] Telegram: ${config.telegram.allowedUserIds.length} user(s) allowed`);
  console.log(`[Config] LLM: Groq (${config.llm.groqModel})`);

  const db = new DatabaseManager(config.database.dbPath);
  console.log(`[Database] Initialized at ${config.database.dbPath}`);

  const firestore = new FirestoreService('service-account.json');

  const tools = new ToolRegistry();
  await db.initialize();
  tools.initialize(config, db, firestore);
  console.log(`[Tools] ${tools.names.length} tools registered`);

  const agent = new Agent(config, db, tools, firestore);

  const audio = new AudioService(config);
  const tts = new TTSInterface(config);

  const bot = await createBot(config, agent, db, audio, tts);
  console.log('[Bot] Ready - Starting long polling...');

  const healthServer = createHealthCheckServer();
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
