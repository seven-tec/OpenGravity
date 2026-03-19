
import { parseConfig } from './src/config.js';
import { DatabaseManager } from './src/core/database.js';
import { ToolRegistry } from './src/tools/registry.js';
import { FirestoreService } from './src/services/database/firestore.js';
import { Agent } from './src/core/agent.js';
import * as dotenv from 'dotenv';

dotenv.config();

async function test() {
  const config = parseConfig(process.env as any);
  const db = new DatabaseManager(config.database.dbPath);
  const firestore = new FirestoreService('service-account.json');
  const tools = new ToolRegistry();
  tools.initialize(config, db);

  const agent = new Agent(config, db, tools, firestore);

  console.log('--- Testing Simple Message ---');
  const resp1 = await agent.process('test-user', 'dime algo interesante de la IA');
  console.log('Response:', resp1);

  console.log('\n--- Testing Loop Protection (Simulated via logs should show) ---');
  // We can't easily force Groq to loop here without multiple calls, 
  // but we can check if it calls get_current_time once and then answers.
  const resp2 = await agent.process('test-user', 'qué hora es?');
  console.log('Response:', resp2);
}

test().catch(console.error);
