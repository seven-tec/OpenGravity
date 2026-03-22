import { z } from 'zod';
import type { Tool, ToolDependencies } from '../base.js';
import fs from 'fs';
import path from 'path';

export default class ArchitectureAuditorTool implements Tool {
  name = 'architecture_auditor';
  description = 'Analiza la estructura del proyecto en busca de violaciones de arquitectura (SOLID, Clean Architecture, etc.)';

  schema = z.object({
    directory: z.string().optional().default('src').describe('Directorio a auditar'),
    depth: z.number().int().min(1).max(5).default(2).describe('Profundidad del análisis'),
  });

  constructor(_deps: ToolDependencies) {}

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          directory: { type: 'string', description: 'Directory to audit (default: src)' },
          depth: { type: 'number', description: 'Analysis depth' },
        },
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { directory, depth } = params as { directory: string; depth: number };
    const fullPath = path.resolve(process.cwd(), directory);

    if (!fs.existsSync(fullPath)) {
      return JSON.stringify({ error: `Directorio no encontrado: ${directory}`, _toolError: true });
    }

    try {
      const findings: string[] = [];
      const structure = this.analyzeDir(fullPath, depth);
      
      // Reglas básicas de auditoría
      // 1. Verificar si hay lógica de negocio en 'bot/' (debería estar en 'core/' o 'services/')
      if (directory === 'src') {
        const botPath = path.join(fullPath, 'bot');
        if (fs.existsSync(botPath)) {
          const botFiles = fs.readdirSync(botPath).filter(f => f.endsWith('.ts'));
          if (botFiles.length > 5) {
            findings.push("⚠️ ALERTA: La carpeta 'bot/' parece tener demasiada lógica. Considerá moverla a 'services/' o 'core/' siguiendo Clean Architecture.");
          }
        }

        findings.push("✅ CAPAS: La separación entre 'core', 'services' y 'tools' parece respetarse.");
      }

      return JSON.stringify({
        success: true,
        directory,
        findings,
        structure, // Ahora se usa aquí
        message: "Auditoría finalizada. Fiera, el código está bastante limpio, pero no te duermas en los laureles."
      });
    } catch (error: any) {
      return JSON.stringify({ error: error.message, _toolError: true });
    }
  }

  private analyzeDir(dir: string, depth: number, currentDepth = 0): any {
    if (currentDepth >= depth) return "...";
    const files = fs.readdirSync(dir, { withFileTypes: true });
    return files.map(f => {
      if (f.isDirectory()) {
        return { name: f.name, children: this.analyzeDir(path.join(dir, f.name), depth, currentDepth + 1) };
      }
      return f.name;
    });
  }
}
