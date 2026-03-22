import { config } from 'dotenv';
import dns from 'node:dns';
import fs from 'fs';
import path from 'path';
import { parseConfig, type EnvSchema, type Config } from '../config.js';
import { DatabaseManager } from './database.js';
import { ToolRegistry } from '../tools/registry.js';
import { Agent } from './agent.js';
import { createBot } from '../bot/bot.js';
import { FirestoreService } from '../services/database/firestore.js';
import { AudioService } from '../services/audio/audio_service.js';
import { TTSInterface } from '../services/audio/tts_interface.js';
import { ObservabilityService } from '../services/observability.js';

export class Launcher {
  private config!: Config;
  private db!: DatabaseManager;
  private firestore!: FirestoreService;
  private obs!: ObservabilityService;
  private tools!: ToolRegistry;
  private agent!: Agent;
  private audio!: AudioService;
  private tts!: TTSInterface;

  async bootstrap() {
    console.log('🤖 [Launcher] Initializing OpenGravity Core...');
    
    this.setupDNS();
    config();
    this.injectGoogleCredentials();
    
    this.config = parseConfig(process.env as EnvSchema);
    console.log(`[Config] Telegram: ${this.config.telegram.allowedUserIds.length} user(s) allowed`);
    console.log(`[Config] LLM: Groq (${this.config.llm.groqModel})`);

    this.db = new DatabaseManager(this.config.database.dbPath);
    await this.db.initialize();

    this.firestore = new FirestoreService('service-account.json', this.config.vision.hfToken);
    this.obs = new ObservabilityService(this.firestore);

    this.tools = new ToolRegistry();
    await this.tools.initialize({ 
      config: this.config, 
      db: this.db, 
      firestore: this.firestore 
    });

    // Cortex Pipeline: Initializing middlewares
    const observabilityMiddleware = new (await import('./middlewares/observability_middleware.js')).ObservabilityMiddleware(this.obs);

    this.agent = new Agent(this.config, this.db, this.tools, this.firestore, this.obs, [
      observabilityMiddleware
    ]);

    this.audio = new AudioService(this.config);
    this.tts = new TTSInterface(this.config);

    const bot = await createBot(this.config, this.agent, this.db, this.audio, this.tts);
    
    return {
      bot,
      config: this.config,
      db: this.db,
      obs: this.obs
    };
  }

  private setupDNS() {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      console.log('[System] DNS servers set to 8.8.8.8, 1.1.1.1');
    } catch (e) {
      console.warn('[System] Could not override DNS servers.');
    }
  }

  private injectGoogleCredentials() {
    if (process.env.GOG_CREDENTIALS) {
      try {
        const credsPath = path.join(process.cwd(), 'adc.json');
        let credsSource = process.env.GOG_CREDENTIALS.trim();
        
        if (!credsSource.startsWith('{')) {
          credsSource = Buffer.from(credsSource, 'base64').toString('utf8');
        }

        fs.writeFileSync(credsPath, credsSource);
        process.env.GOG_AUTH_MODE = 'adc';
        process.env.GOOGLE_APPLICATION_CREDENTIALS = credsPath;
        console.log('🔐 [Auth] Google Workspace ADC configured from environment');
      } catch (e) {
        console.error('❌ [Auth] Failed to write Google credentials', e);
      }
    }
  }
}
