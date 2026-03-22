import fs from 'fs';
import path from 'path';
import type { Tool, ToolConstructor, ToolDependencies } from './base.js';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Inicializa el registro descubriendo y cargando herramientas dinámicamente.
   */
  async initialize(deps: ToolDependencies): Promise<void> {
    console.log('[ToolRegistry] Starting dynamic tool discovery...');
    
    // Directorios donde buscar herramientas
    const toolDirs = [
      path.join(__dirname, 'core'), // Herramientas individuales (un tool por archivo, export default)
      path.join(__dirname)          // Herramientas legacy/agrupadas (múltiples tools, named exports)
    ];

    for (const dir of toolDirs) {
      if (!fs.existsSync(dir)) continue;
      
      const files = fs.readdirSync(dir).filter(f => 
        (f.endsWith('.ts') || f.endsWith('.js')) && 
        !f.includes('base') && 
        !f.includes('registry') &&
        !f.includes('system_tools') // Ignorar el archivo viejo
      );

      for (const file of files) {
        try {
          const filePath = path.join(dir, file);
          const fileUrl = pathToFileURL(filePath).href;
          const module = await import(fileUrl);
          
          // 1. Intentar cargar export default (Clase individual)
          if (module.default && typeof module.default === 'function') {
            const ToolClass = module.default as ToolConstructor;
            const toolInstance = new ToolClass(deps);
            this.register(toolInstance);
          } 
          
          // 2. Intentar cargar named exports (Clases de herramientas)
          for (const key in module) {
            if (key !== 'default' && typeof module[key] === 'function' && key.endsWith('Tool')) {
              const ToolClass = module[key] as ToolConstructor;
              try {
                const toolInstance = new ToolClass(deps);
                this.register(toolInstance);
              } catch (e) {
                // Si falla al instanciar (ej: no es una clase de tool), lo ignoramos
              }
            }
          }
        } catch (error) {
          console.error(`[ToolRegistry] Error loading tools from ${file}:`, error);
        }
      }
    }

    console.log(`[ToolRegistry] Initialized ${this.tools.size} tools:`);
    for (const name of this.tools.keys()) {
      console.log(`  - ${name}`);
    }
  }

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting tool: ${tool.name}`);
    }
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
