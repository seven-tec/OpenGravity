import type { Config } from '../config.js';
import type { DatabaseManager } from '../core/database.js';
import type { FirestoreService } from '../services/database/firestore.js';

export interface ToolDependencies {
  config: Config;
  db?: DatabaseManager;
  firestore?: FirestoreService;
}

export type ToolConstructor = new (deps: ToolDependencies) => Tool;

export interface Tool {
  name: string;
  description: string;
  execute(params: Record<string, unknown>): Promise<string>;
  getDefinition(): {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[]; items?: { type: string } }>;
      required?: string[];
    };
  };
}

export interface ToolContext {
  userId: string;
  shellTimeoutMs: number;
}
