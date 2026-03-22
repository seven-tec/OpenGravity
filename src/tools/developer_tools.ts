import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import type { Tool, ToolDependencies } from './base.js';

const execAsync = promisify(exec);

export default class DeveloperTool implements Tool {
  name = 'developer_tool';
  description = 'Herramienta para que el Agente Arquitecto pueda modificar su propio código y verificar cambios. Permite escribir archivos, parcharlos y ejecutar comandos de construcción.';

  schema = z.object({
    action: z.enum(['write_file', 'patch_file', 'run_command']).describe('Acción de desarrollo a realizar'),
    path: z.string().optional().describe('Ruta relativa al archivo'),
    content: z.string().optional().describe('Contenido completo (para write_file)'),
    search: z.string().optional().describe('Texto a buscar (para patch_file)'),
    replace: z.string().optional().describe('Texto de reemplazo (para patch_file)'),
    command: z.enum(['npm run build', 'npm run typecheck', 'npm test']).optional().describe('Comando a ejecutar'),
  });

  constructor(_deps: ToolDependencies) {}

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['write_file', 'patch_file', 'run_command'],
            description: 'Acción de desarrollo a realizar.'
          },
          path: {
            type: 'string',
            description: 'Ruta relativa al archivo (para write_file y patch_file).'
          },
          content: {
            type: 'string',
            description: 'Contenido completo del archivo (para write_file).'
          },
          search: {
            type: 'string',
            description: 'Texto a buscar para reemplazar (para patch_file).'
          },
          replace: {
            type: 'string',
            description: 'Texto de reemplazo (para patch_file).'
          },
          command: {
            type: 'string',
            enum: ['npm run build', 'npm run typecheck', 'npm test'],
            description: 'Comando whitelisted a ejecutar.'
          }
        },
        required: ['action']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { action, path: filePath, content, search, replace, command } = params as any;
    const baseDir = process.cwd();

    try {
      switch (action) {
        case 'write_file':
          return await this.writeFile(baseDir, filePath, content);
        case 'patch_file':
          return await this.patchFile(baseDir, filePath, search, replace);
        case 'run_command':
          return await this.runCommand(command);
        default:
          return JSON.stringify({ error: 'Acción no soportada' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ success: false, error: msg });
    }
  }

  private async writeFile(baseDir: string, relPath: string, content: string): Promise<string> {
    if (!relPath) throw new Error('Se requiere una ruta para write_file');
    const fullPath = path.resolve(baseDir, relPath);
    // Verificar que no se salga del directorio del proyecto
    const normalizedFullPath = path.normalize(fullPath);
    const normalizedBaseDir = path.normalize(baseDir);
    
    if (!normalizedFullPath.startsWith(normalizedBaseDir)) {
      throw new Error('Seguridad: No se permite escribir fuera del proyecto');
    }

    const dir = path.dirname(normalizedFullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(normalizedFullPath, content, 'utf-8');
    return JSON.stringify({ success: true, file: relPath, action: 'written' });
  }

  private async patchFile(baseDir: string, relPath: string, search: string, replace: string): Promise<string> {
    if (!relPath || search === undefined || replace === undefined) {
      throw new Error('patch_file requiere path, search y replace');
    }
    const fullPath = path.resolve(baseDir, relPath);
    const normalizedFullPath = path.normalize(fullPath);
    const normalizedBaseDir = path.normalize(baseDir);

    if (!normalizedFullPath.startsWith(normalizedBaseDir)) {
      throw new Error('Seguridad: No se permite modificar fuera del proyecto');
    }

    if (!fs.existsSync(normalizedFullPath)) {
      throw new Error(`Archivo no encontrado: ${relPath}`);
    }

    const content = fs.readFileSync(normalizedFullPath, 'utf8');
    if (!content.includes(search)) {
      return JSON.stringify({ success: false, error: `No se encontró el texto exacto buscado en ${relPath}` });
    }

    const newContent = content.replace(search, replace);
    fs.writeFileSync(normalizedFullPath, newContent, 'utf8');
    return JSON.stringify({ success: true, file: relPath, action: 'patched' });
  }

  private async runCommand(command: string): Promise<string> {
    const allowed = ['npm run build', 'npm run typecheck', 'npm test'];
    if (!allowed.includes(command)) {
      throw new Error(`Comando no permitido: ${command}. Permitidos: ${allowed.join(', ')}`);
    }

    try {
      console.log(`[DeveloperTool] Executing command: ${command}`);
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 120000, // 2 minutos para builds pesados
        maxBuffer: 1024 * 1024 * 5 // 5MB buffer
      });
      return JSON.stringify({
        success: true,
        command,
        stdout: stdout.substring(0, 5000), // Devolvemos más contexto para builds
        stderr: stderr.substring(0, 2000)
      });
    } catch (error: any) {
      console.error(`[DeveloperTool] Command failed: ${command}`, error.message);
      return JSON.stringify({
        success: false,
        command,
        error: error.message,
        stdout: error.stdout?.substring(0, 5000),
        stderr: error.stderr?.substring(0, 2000)
      });
    }
  }
}
