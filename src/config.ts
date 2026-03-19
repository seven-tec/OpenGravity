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
    systemPrompt: z.string().default('You are OpenGravity, an autonomous AI agent. IMPORTANT TOOL USAGE RULES: 1) If a tool call fails, report the error to the user immediately and do NOT retry the same command. 2) Only call each tool once per request. 3) After receiving tool results, provide your final answer to the user. 4) Do not call tools in loops.'),
  }),
  database: z.object({
    dbPath: z.string().default('./data/opengravity.db'),
  }),
  audio: z.object({
    elevenlabsApiKey: z.string().optional(),
    whisperApiKey: z.string().optional(),
    elevenlabsVoiceId: z.string().default('21m00Tcm4TlvDq8ikWAM'),
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
      elevenlabsApiKey: env.ELEVENLABS_API_KEY,
      whisperApiKey: env.WHISPER_API_KEY,
      elevenlabsVoiceId: env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM',
    },
    shell: {
      timeoutMs: parseInt(env.SHELL_TIMEOUT_MS ?? '30000', 10),
    },
  });
}
