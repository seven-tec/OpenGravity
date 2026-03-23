import { parseConfig } from './src/config.js';
import { DatabaseManager } from './src/core/database.js';
import { ToolRegistry } from './src/tools/registry.js';
import { FirestoreService } from './src/services/database/firestore.js';
import { Agent } from './src/core/agent.js';
import { ObservabilityService } from './src/services/observability.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  const config = parseConfig(process.env as any);
  const db = new DatabaseManager(config.database.dbPath);
  await db.initialize();
  const firestore = new FirestoreService('service-account.json');
  const obs = new ObservabilityService(firestore);
  const tools = new ToolRegistry();
  await tools.initialize({ config, db, firestore });

  const agent = new Agent(config, db, tools, firestore, obs);

  console.log('--- Clearing History ---');
  await agent.clearHistory('test-user');

  console.log('--- Testing Simple Message ---');
  console.log('--- Testing Personal Persona ---');
  const resp1 = await agent.process('test-user', 'Che fiera, ¿cómo viene la mano con el proyecto? ¿Alguna novedad interesante en el mundo de la IA hoy?');
  console.log('Response:', resp1);

  console.log('\n--- Testing Functional & Tone ---');
  const resp2 = await agent.process('test-user', 'Che boludo, ¿qué hora es?');
  console.log('Response:', resp2);
}

test().catch(console.error);
