import type { Tool } from './base.js';
import { GetCurrentTimeTool, GetRecentMessagesTool, ExecuteShellTool, setDatabase } from './system_tools.js';
import type { Config } from '../config.js';
import type { DatabaseManager } from '../core/database.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  initialize(config: Config, db?: DatabaseManager): void {
    this.register(new GetCurrentTimeTool());
    this.register(new GetRecentMessagesTool());
    this.register(new ExecuteShellTool({
      userId: '',
      shellTimeoutMs: config.shell.timeoutMs,
    }));

    if (db) {
      setDatabase(db);
    }

    console.log(`[ToolRegistry] Initialized ${this.tools.size} tools:`);
    for (const name of this.tools.keys()) {
      console.log(`  - ${name}`);
    }
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getDefinitions() {
    return Array.from(this.tools.values()).map(t => t.getDefinition());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  async execute(name: string, params: Record<string, unknown> | null): Promise<string> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return JSON.stringify({ error: `Tool '${name}' not found`, _stopLoop: true });
    }

    const safeParams = params ?? {};

    try {
      const result = await tool.execute(safeParams);
      const resultObj = tryParseJson(result);
      if (resultObj && resultObj.error) {
        return JSON.stringify({
          ...resultObj,
          _toolError: true,
          _stopLoop: true,
        });
      }
      return result;
    } catch (error) {
      const err = error as Error;
      return JSON.stringify({
        error: err.message,
        _toolError: true,
        _stopLoop: true,
      });
    }
  }

  get names(): string[] {
    return Array.from(this.tools.keys());
  }
}

function tryParseJson(str: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
