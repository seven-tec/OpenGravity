import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import type { Tool, ToolDependencies } from '../base.js';
import type { FirestoreService } from '../../services/database/firestore.js';

export default class CodeSearchTool implements Tool {
  name = 'code_search';
  description = 'Sincroniza y busca semánticamente en el código fuente del proyecto actual.';

  schema = z.object({
    action: z.enum(['index', 'search']).describe('Acción a realizar'),
    query: z.string().optional().describe('Término de búsqueda (solo para search)'),
  });

  private firestore: FirestoreService | undefined;

  constructor(deps: ToolDependencies) {
    this.firestore = deps.firestore;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: { type: 'string', enum: ['index', 'search'], description: 'Acción de búsqueda de código.' },
          query: { type: 'string', description: 'Término de búsqueda para encontrar archivos o lógica.' }
        },
        required: ['action']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { action, query } = params as { action: 'index' | 'search'; query?: string };
    const targetUserId = '855084566'; // Default Pablo

    if (!this.firestore || !this.firestore.initialized) {
      return JSON.stringify({ error: 'Firestore no está inicializado.', _stopLoop: true });
    }

    if (action === 'search') {
      if (!query) return JSON.stringify({ error: 'Se requiere query para buscar.', _stopLoop: true });
      const results = await this.firestore.semanticSearch(targetUserId, 'code-base', query, 5);
      return JSON.stringify({ success: true, query, results });
    }

    // Action: Index
    try {
      console.log(`[CodeSearch] Starting codebase indexing...`);
      const srcDir = path.join(process.cwd(), 'src');
      const files = this.getAllFiles(srcDir);
      let indexedCount = 0;

      for (const filePath of files) {
        const relativePath = path.relative(process.cwd(), filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const summary = `Archivo: ${relativePath}\nContenido Parcial:\n${content.substring(0, 500)}`;

        await this.firestore.saveKnowledge(targetUserId, 'code-base', 'store', {
          path: relativePath,
          content: summary,
          full_path: filePath
        });
        indexedCount++;
      }

      return JSON.stringify({ 
        success: true, 
        message: `Indexación completada. Se procesaron ${indexedCount} archivos en la categoría 'code-base'.` 
      });

    } catch (error: any) {
      return JSON.stringify({ error: `Fallo en la indexación: ${error.message}`, _stopLoop: true });
    }
  }

  private getAllFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getAllFiles(filePath));
      } else if (file.endsWith('.ts') || file.endsWith('.js')) {
        results.push(filePath);
      }
    });
    return results;
  }
}
