import { z } from 'zod';

export const ConfigSchema = z.object({
  telegram: z.object({
    botToken: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
    allowedUserIds: z.array(z.string()).min(1, 'TELEGRAM_ALLOWED_USER_IDS is required'),
  }),
  llm: z.object({
    groqApiKey: z.string().min(1, 'GROQ_API_KEY is required'),
    openrouterApiKey: z.string().optional(),
    groqModel: z.string().default('llama-3.3-70b-versatile'),
    openrouterModel: z.string().default('anthropic/claude-3-haiku'),
  }),
  agent: z.object({
    maxContextMessages: z.number().int().positive().default(10),
    maxIterations: z.number().int().min(1).max(10).default(5),
    systemPrompt: z.string().default('Eres "OpenGravity", el sistema operativo de asistencia avanzada y copiloto de ingeniería de Pablo. Tu personalidad es la de un colega senior: técnico, eficiente, sarcástico y extremadamente resolutivo. Hablas con modismos de Chile y Argentina (fiera, boludo, crack, al toque). MODOS: 1) ENTRADA DE VOZ: Ignora errores fonéticos. 2) SALIDA DE VOZ: Sé extremadamente conciso (max 2-3 oraciones). 3) HERRAMIENTAS: Tenés acceso a Firestore.'),
  }),
  database: z.object({
    dbPath: z.string().default('./data/opengravity.db'),
  }),
  audio: z.object({
    whisperProvider: z.enum(['openai', 'groq']).default('groq'),
    elevenlabsApiKey: z.string().optional(),
    whisperApiKey: z.string().optional(),
    elevenlabsVoiceId: z.string().default('hpp4J3VqNfWAUOO0d1Us'),

  }),
  shell: z.object({
    timeoutMs: z.number().int().positive().default(30000),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

export interface EnvSchema {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_ALLOWED_USER_IDS?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  GROQ_MODEL?: string;
  OPENROUTER_MODEL?: string;
  MAX_CONTEXT_MESSAGES?: string;
  MAX_ITERATIONS?: string;
  AGENT_SYSTEM_PROMPT?: string;
  DB_PATH?: string;
  ELEVENLABS_API_KEY?: string;
  WHISPER_API_KEY?: string;
  WHISPER_PROVIDER?: string;
  ELEVENLABS_VOICE_ID?: string;
  SHELL_TIMEOUT_MS?: string;
}

export function parseConfig(env: EnvSchema): Config {
  const telegramAllowedIds = env.TELEGRAM_ALLOWED_USER_IDS?.split(',').map(id => id.trim()) ?? [];
  
  return ConfigSchema.parse({
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN ?? '',
      allowedUserIds: telegramAllowedIds,
    },
    llm: {
      groqApiKey: env.GROQ_API_KEY ?? '',
      openrouterApiKey: env.OPENROUTER_API_KEY,
      groqModel: env.GROQ_MODEL ?? 'llama-3.3-70b-versatile',
      openrouterModel: env.OPENROUTER_MODEL ?? 'anthropic/claude-3-haiku',
    },
    agent: {
      maxContextMessages: parseInt(env.MAX_CONTEXT_MESSAGES ?? '10', 10),
      maxIterations: parseInt(env.MAX_ITERATIONS ?? '5', 10),
      systemPrompt: env.AGENT_SYSTEM_PROMPT ?? 'You are OpenGravity, an autonomous AI agent.',
    },
    database: {
      dbPath: env.DB_PATH ?? './data/opengravity.db',
    },
    audio: {
      whisperProvider: (env.WHISPER_PROVIDER as 'openai' | 'groq') ?? 'groq',
      elevenlabsApiKey: env.ELEVENLABS_API_KEY,
      whisperApiKey: env.WHISPER_API_KEY ?? env.GROQ_API_KEY,
      elevenlabsVoiceId: env.ELEVENLABS_VOICE_ID ?? 'hpp4J3VqNfWAUOO0d1Us',

    },
    shell: {
      timeoutMs: parseInt(env.SHELL_TIMEOUT_MS ?? '30000', 10),
    },
  });
}
