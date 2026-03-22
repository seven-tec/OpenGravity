import { exec } from 'child_process';
import { promisify } from 'util';
import type { Tool, ToolDependencies } from '../base.js';

const execAsync = promisify(exec);

const isWindows = process.platform === 'win32';

const ALLOWED_COMMANDS = isWindows
  ? new Set(['dir', 'pwd', 'whoami', 'type', 'echo', 'node', 'npm', 'git', 'curl', 'cls', 'cd', 'findstr', 'where', 'gog'])
  : new Set(['ls', 'pwd', 'whoami', 'date', 'cat', 'echo', 'node', 'npm', 'git', 'curl', 'clear', 'cd', 'find', 'grep', 'head', 'tail']);

const COMMAND_TIMEOUT_MS = 30000;

export default class ExecuteShellTool implements Tool {
  name = 'execute_shell';
  description = `Execute a safe shell command with whitelisted commands only. Platform: ${isWindows ? 'Windows' : 'Unix/Linux'}.`;

  private shellTimeoutMs: number;

  constructor(deps: ToolDependencies) {
    this.shellTimeoutMs = deps.config.shell.timeoutMs;
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
        timeout: Math.min(this.shellTimeoutMs, COMMAND_TIMEOUT_MS),
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

      if (isWindows && command.toLowerCase().includes('findstr') && (exitCode === 1 || exitCode === 'UNKNOWN')) {
        return JSON.stringify({
          success: true,
          stdout: '(no matches found)',
          stderr: execError.stderr || null,
          code: exitCode,
        });
      }

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
