import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool } from './base.js';

const execAsync = promisify(exec);

export class GoogleWorkspaceTool implements Tool {
  name = 'google_workspace';
  description = 'Integración con Google Workspace (Gmail, Calendar, Drive, Sheets, Docs, Contacts) usando gog CLI.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string' as const,
            description: 'Acción a realizar (ej: gmail search, calendar events, drive search, etc.)',
            enum: [
              'gmail search', 'gmail send', 'gmail drafts',
              'calendar events', 'calendar create', 'calendar update',
              'drive search', 'contacts list',
              'sheets get', 'sheets update', 'sheets append',
              'docs cat', 'docs export'
            ]
          },
          args: {
            type: 'string' as const,
            description: 'Argumentos adicionales para el comando gog (ej: "--max 10" o para búsqueda "query")'
          }
        },
        required: ['action'] as string[]
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const action = params.action as string;
    const args = (params.args as string) || '';

    // Mapeo simple de acciones a comandos de gog
    const command = `gog ${action} ${args}`;

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      
      if (stderr && !stdout) {
        return JSON.stringify({ success: false, error: stderr });
      }

      return JSON.stringify({
        success: true,
        output: stdout || '(sin salida)',
        stderr: stderr || null
      });
    } catch (error) {
      const err = error as any;
      return JSON.stringify({
        success: false,
        error: err.message,
        stdout: err.stdout,
        stderr: err.stderr
      });
    }
  }
}
