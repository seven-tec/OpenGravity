import { z } from 'zod';
import type { Tool, ToolDependencies } from '../base.js';
import type { DatabaseManager } from '../../core/database.js';

export default class GetRecentMessagesTool implements Tool {
  name = 'get_recent_messages';
  description = 'Retrieve recent conversation messages for the current user. Returns the last N messages from SQLite database.';

  schema = z.object({
    limit: z.number().int().min(1).max(100).default(10).describe('Cantidad de mensajes a recuperar'),
    search: z.string().optional().describe('Término de búsqueda opcional'),
  });

  private db: DatabaseManager | undefined;

  constructor(deps: ToolDependencies) {
    this.db = deps.db;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          limit: {
            type: 'number' as const,
            description: 'Number of recent messages to retrieve (default: 10)',
          },
          search: {
            type: 'string' as const,
            description: 'Optional search term to filter messages',
          },
        },
        required: [] as string[],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { limit, search } = params as { limit: number; search?: string };

    if (!this.db) {
      return JSON.stringify({ error: 'Database not initialized', _toolError: true, _stopLoop: true });
    }

    try {
      const messages = this.db.searchMessages(search || '', limit);
      return JSON.stringify({
        success: true,
        count: messages.length,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      });
    } catch (error) {
      const err = error as Error;
      return JSON.stringify({ error: err.message, _toolError: true, _stopLoop: true });
    }
  }
}
