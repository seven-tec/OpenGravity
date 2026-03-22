import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import type { Tool, ToolDependencies } from '../base.js';

const execAsync = promisify(exec);

export default class TestRunnerTool implements Tool {
  name = 'test_runner';
  description = 'Ejecuta tests del proyecto usando Vitest. Permite correr todos los tests o filtrar por archivo.';

  schema = z.object({
    file: z.string().optional().describe('Ruta opcional al archivo de test específico'),
    watch: z.boolean().optional().default(false).describe('Si se debe ejecutar en modo watch (no recomendado para el agente)'),
  });

  constructor(_deps: ToolDependencies) {}

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          file: {
            type: 'string',
            description: 'Optional file path to run specific tests',
          },
          watch: {
            type: 'boolean',
            description: 'Run in watch mode',
          },
        },
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { file, watch } = params as { file?: string; watch?: boolean };
    
    // El agente no debería usar --watch porque bloquea el loop
    const command = `npm run test -- ${file || ''} ${watch ? '--watch' : ''}`.trim();

    try {
      console.log(`[TestRunner] Ejecutando: ${command}`);
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

      return JSON.stringify({
        success: true,
        stdout,
        stderr: stderr || null,
        message: 'Tests completados exitosamente.'
      });
    } catch (error: any) {
      // Vitest devuelve exit code 1 si fallan los tests, lo cual es esperado
      return JSON.stringify({
        success: false,
        stdout: error.stdout || null,
        stderr: error.stderr || null,
        error: error.message,
        _isTestFailure: true,
        message: 'Algunos tests fallaron o hubo un error en la ejecución.'
      });
    }
  }
}
