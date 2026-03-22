import { z } from 'zod';
import type { Tool, ToolDependencies } from './base.js';
import type { FirestoreService } from '../services/database/firestore.js';

export default class SyncProjectsTool implements Tool {
  name = 'sync_projects';
  description = 'Sincroniza los metadatos de los proyectos de GitHub con el Omni-Brain (Firestore) para permitir la búsqueda semántica.';

  schema = z.object({
    source: z.enum(['github']).describe('Fuente de los proyectos a sincronizar'),
  });

  private firestore: FirestoreService | undefined;
  private githubToken?: string;

  constructor(deps: ToolDependencies) {
    this.firestore = deps.firestore;
    this.githubToken = deps.config.dev.githubToken;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          source: { type: 'string', enum: ['github'], description: 'Fuente de sincronización.' }
        },
        required: ['source']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    if (!this.firestore || !this.firestore.initialized) {
      return JSON.stringify({ error: 'Firestore no está inicializado.', _stopLoop: true });
    }

    if (!this.githubToken) {
      return JSON.stringify({ error: 'GITHUB_TOKEN missing', _stopLoop: true });
    }

    const { source } = params as { source: string };
    const targetUserId = '855084566'; // ID de Pablo

    try {
      console.log(`[SyncProjects] Starting sync from ${source}...`);
      
      const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=50', {
        headers: { 
          'Authorization': `token ${this.githubToken}`, 
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'OpenGravity-Bot'
        }
      });

      if (!response.ok) throw new Error(`GitHub Error: ${response.status}`);

      const repos = await response.json() as any[];
      let syncedCount = 0;

      for (const repo of repos) {
        const repoData = {
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description || 'Sin descripción',
          url: repo.html_url,
          language: repo.language,
          topics: repo.topics || [],
          content: `Proyecto GitHub: ${repo.name}. Descripción: ${repo.description || 'N/A'}. Owner: ${repo.owner.login}. Full name: ${repo.full_name}`,
        };

        // Guardar cada repo como un ítem de conocimiento
        await this.firestore.saveKnowledge(targetUserId, 'github_projects', 'store', repoData);
        syncedCount++;
      }

      return JSON.stringify({ 
        success: true, 
        message: `Sincronización completada. Se indexaron ${syncedCount} proyectos en el Omni-Brain.`,
        projects: repos.map(r => r.full_name)
      });

    } catch (error: any) {
      return JSON.stringify({ error: `Fallo en la sincronización: ${error.message}`, _stopLoop: true });
    }
  }
}
