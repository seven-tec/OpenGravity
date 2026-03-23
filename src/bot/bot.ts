import { Bot, session } from 'grammy';
import type { AppContext, SessionData } from './middleware/whitelist.js';
import { createWhitelistMiddleware } from './middleware/whitelist.js';
import { createHandlers } from './handlers.js';
import type { Agent } from '../core/agent.js';
import type { DatabaseManager } from '../core/database.js';
import type { Config } from '../config.js';
import type { AudioService } from '../services/audio/audio_service.js';
import type { TTSInterface } from '../services/audio/tts_interface.js';

export async function createBot(
  config: Config,
  agent: Agent,
  db: DatabaseManager,
  audio: AudioService,
  tts: TTSInterface
): Promise<Bot<AppContext>> {
  const bot = new Bot<AppContext>(config.telegram.botToken);

  bot.use(session({
    initial: (): SessionData => ({
      lastMessageAt: undefined,
      messageCount: 0,
    }),
  }));

  bot.use(createWhitelistMiddleware(config.telegram.allowedUserIds));

  const handlers = createHandlers(agent, db, audio, tts, config.telegram.botToken);

  bot.command('start', handlers.onStart);
  bot.command('help', handlers.onHelp);
  bot.command('status', handlers.onStatus);
  bot.command('clear', handlers.onClear);
  bot.command('memory', handlers.onMemory);
  bot.command('time', handlers.onTime);

  bot.on('message:text', handlers.onMessage);
  bot.on('message:voice', handlers.onVoice);
  bot.on('message:photo', handlers.onPhoto);

  bot.catch((err) => {
    console.error('[Bot] Error:', err.error);
  });

  return bot;
}
