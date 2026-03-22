import fs from 'fs';
import path from 'path';
import type { Tool } from './base.js';

export class ProjectAnalystTool implements Tool {
  name = 'project_analyst';
  description = 'Herramienta de introspección para analizar la arquitectura y el código de proyectos locales. Permite listar archivos, ver estructuras y leer contenidos de cualquier directorio del sistema.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['list_files', 'read_files', 'get_structure', 'grep'],
            description: 'Acción a realizar sobre el proyecto.'
          },
          directory: {
            type: 'string',
            description: 'Directorio base para la operación (por defecto ".").'
          },
          files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista de archivos a leer (para read_files).'
          },
          query: {
            type: 'string',
            description: 'Patrón de búsqueda (para grep).'
          },
          recursive: {
            type: 'boolean',
            description: 'Si la búsqueda o lista debe ser recursiva.'
          }
        },
        required: ['action']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { action, directory = '.', files = [], query = '', recursive = false } = params as any;
    const baseDir = path.resolve(directory);

    // Seguridad básica: evitar salir de C:\ o directorios sensibles si fuera necesario, 
    // pero para Pablo (Senior) le permitimos explorar su disco.
    
    try {
      switch (action) {
        case 'list_files':
          return await this.listFiles(baseDir, recursive);
        case 'read_files':
          return await this.readFiles(baseDir, files);
        case 'get_structure':
          return await this.getStructure(baseDir, 3); // Límite de profundidad 3 por defecto
        case 'grep':
          return await this.grep(baseDir, query);
        default:
          return JSON.stringify({ error: 'Acción no soportada' });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return JSON.stringify({ success: false, error: msg });
    }
  }

  private async listFiles(dir: string, recursive: boolean): Promise<string> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const result = entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
      path: path.relative(process.cwd(), path.join(dir, e.name))
    }));

    if (recursive) {
      // Implementación simple de recursión si se pide, limitada por seguridad/tokens
      // Para un bot, mejor devolver solo el primer nivel o usar get_structure
    }

    return JSON.stringify({ success: true, directory: dir, entries: result });
  }

  private async readFiles(baseDir: string, files: string[]): Promise<string> {
    const results = [];
    for (const file of files) {
      const filePath = path.join(baseDir, file);
      if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
        const content = fs.readFileSync(filePath, 'utf-8');
        results.push({
          file,
          content: content.length > 5000 ? content.substring(0, 5000) + '... (TRUNCATED)' : content
        });
      } else {
        results.push({ file, error: 'Archivo no encontrado o es un directorio' });
      }
    }
    return JSON.stringify({ success: true, files: results });
  }

  private async getStructure(dir: string, maxDepth: number, currentDepth = 0): Promise<string> {
    if (currentDepth > maxDepth) return '... (MAX DEPTH)';
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let output = '';
    
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
      
      const indent = '  '.repeat(currentDepth);
      output += `${indent}${entry.isDirectory() ? '📂' : '📄'} ${entry.name}\n`;
      
      if (entry.isDirectory()) {
        output += await this.getStructure(path.join(dir, entry.name), maxDepth, currentDepth + 1);
      }
    }
    
    if (currentDepth === 0) {
      return JSON.stringify({ success: true, structure: output });
    }
    return output;
  }

  private async grep(dir: string, query: string): Promise<string> {
    // Implementación liviana de búsqueda de texto
    // En Windows esto podría integrarse con 'findstr' o simplemente leer archivos de texto
    // Por simplicidad y portabilidad, usaremos búsqueda recursiva básica en archivos .ts, .js, .md, .env
    const results: any[] = [];
    const extensions = ['.ts', '.js', '.md', '.env', '.json', '.txt'];
    
    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== 'node_modules' && entry.name !== 'dist' && !entry.name.startsWith('.')) {
            walk(fullPath);
          }
        } else if (extensions.includes(path.extname(entry.name))) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            const lines = content.split('\n');
            const matchingLines = lines
              .map((line, idx) => line.includes(query) ? { line: idx + 1, content: line.trim() } : null)
              .filter(l => l !== null);
            
            results.push({
              file: path.relative(dir, fullPath),
              matches: matchingLines.slice(0, 3) // Solo top 3 matches por archivo
            });
          }
        }
      }
    };
    
    walk(dir);
    return JSON.stringify({ success: true, query, results: results.slice(0, 10) }); // Top 10 archivos
  }
}
