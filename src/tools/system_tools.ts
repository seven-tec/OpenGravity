import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolContext } from './base.js';
import type { DatabaseManager } from '../core/database.js';

const execAsync = promisify(exec);

const isWindows = process.platform === 'win32';

const ALLOWED_COMMANDS = isWindows
  ? new Set(['dir', 'pwd', 'whoami', 'type', 'echo', 'node', 'npm', 'git', 'curl', 'cls', 'cd', 'findstr', 'where', 'gog'])
  : new Set(['ls', 'pwd', 'whoami', 'date', 'cat', 'echo', 'node', 'npm', 'git', 'curl', 'clear', 'cd', 'find', 'grep', 'head', 'tail']);

const COMMAND_TIMEOUT_MS = 30000;

let dbInstance: DatabaseManager | null = null;

export function setDatabase(db: DatabaseManager): void {
  dbInstance = db;
}

export class GetRecentMessagesTool implements Tool {
  name = 'get_recent_messages';
  description = 'Retrieve recent conversation messages for the current user. Returns the last N messages from SQLite database.';

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

  async execute(params: Record<string, unknown> | null): Promise<string> {
    const safeParams = params ?? {};
    const limit = (safeParams.limit as number) || 10;
    const search = safeParams.search as string | undefined;

    if (!dbInstance) {
      return JSON.stringify({ error: 'Database not initialized', _toolError: true, _stopLoop: true });
    }

    try {
      const messages = dbInstance.searchMessages(search || '', limit);
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

export class GetCurrentTimeTool implements Tool {
  name = 'get_current_time';
  description = 'Get the current date and time in ISO format.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          timezone: {
            type: 'string' as const,
            description: 'Optional IANA timezone like UTC, America/New_York, Europe/London',
          },
        },
        required: [] as string[],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const timezone = params.timezone as string | undefined;
    const now = new Date();
    
    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          dateStyle: 'full',
          timeStyle: 'long',
        });
        return formatter.format(now);
      } catch {
        return `Invalid timezone: ${timezone}. Using local time: ${now.toISOString()}`;
      }
    }
    
    return now.toISOString();
  }
}

export class ExecuteShellTool implements Tool {
  name = 'execute_shell';
  description = `Execute a safe shell command with whitelisted commands only. Platform: ${isWindows ? 'Windows' : 'Unix/Linux'}.`;

  private context: ToolContext;

  constructor(context: ToolContext) {
    this.context = context;
  }

  getDefinition() {
    const allowedList = Array.from(ALLOWED_COMMANDS).join(', ');
    return {
      name: this.name,
      description: `Execute a safe shell command to inspect the system or project files. Use ONLY if other tools are insufficient. Allowed: ${allowedList}`,
      parameters: {
        type: 'object' as const,
        properties: {
          command: {
            type: 'string' as const,
            description: `Shell command to execute (allowed: ${allowedList})`,
          },
        },
        required: ['command'] as string[],
      },
    };
  }

  private sanitizeCommand(command: string): boolean {
    const parts = command.trim().split(/\s+/);
    const baseCmd = parts[0].toLowerCase();
    
    if (!ALLOWED_COMMANDS.has(baseCmd)) {
      return false;
    }

    const dangerous = ['&&', '||', '|', ';', '>', '<', '`', '$', '(', ')'];
    return !dangerous.some(c => command.includes(c));
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const command = params.command as string;
    
    if (!this.sanitizeCommand(command)) {
      return JSON.stringify({
        error: 'Command not allowed',
        allowed: Array.from(ALLOWED_COMMANDS),
      });
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: Math.min(this.context.shellTimeoutMs, COMMAND_TIMEOUT_MS),
        maxBuffer: 1024 * 1024,
      });

      return JSON.stringify({
        success: true,
        stdout: stdout || '(no output)',
        stderr: stderr || null,
      });
    } catch (error) {
      const execError = error as { 
        message?: string; 
        code?: string | number; 
        stdout?: string; 
        stderr?: string 
      };
      
      const errorMessage = execError.message ?? 'Unknown error';
      const exitCode = execError.code !== undefined && execError.code !== null ? execError.code : 'UNKNOWN';

      // Special handling for findstr exit code 1 (no matches) on Windows
      // Note: sometimes exec returns code 1, sometimes null/unknown for shell builtins or specific errors
      if (isWindows && command.toLowerCase().includes('findstr') && (exitCode === 1 || exitCode === 'UNKNOWN')) {
        return JSON.stringify({
          success: true,
          stdout: '(no matches found)',
          stderr: execError.stderr || null,
          code: exitCode,
        });
      }

      // Return error info without the top-level 'error' key to prevent _stopLoop in ToolRegistry
      // This allows the LLM to see the error and decide how to proceed.
      return JSON.stringify({
        success: false,
        errorMessage,
        stderr: execError.stderr || null,
        stdout: execError.stdout || null,
        code: exitCode,
      });

    }

  }
}

export const systemTools = [
  new GetCurrentTimeTool(),
];
