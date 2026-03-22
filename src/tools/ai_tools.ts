import { z } from 'zod';
import type { Tool, ToolDependencies } from './base.js';

export class ImageGenerationTool implements Tool {
  name = 'image_generation';
  description = 'Herramienta EXCLUSIVA para generar o dibujar imágenes. Tú eres texto, esta tool dibuja por ti. Al devolverte la URL, muéstrala exactamente así: [🖼️ Ver Imagen](url).';
  
  schema = z.object({
    prompt: z.string().min(10, "El prompt debe ser descriptivo (mínimo 10 caracteres)").describe('Descripción detallada en inglés de la imagen a generar'),
  });

  private hfToken?: string;

  constructor(deps: ToolDependencies) {
    this.hfToken = deps.config.vision.hfToken;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          prompt: {
            type: 'string',
            description: 'Descripción detallada en inglés de la imagen a generar (sujeto, fondo, estilo, iluminación).'
          }
        },
        required: ['prompt']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { prompt } = params as { prompt: string };
    
    if (!this.hfToken) {
      return JSON.stringify({
        success: false,
        error: "FALTA CONFIGURACIÓN: HF_TOKEN no está definido. Carga el Access Token de Hugging Face.",
        _stopLoop: true
      });
    }

    try {
      console.log(`[ImageGeneration] Generating: "${prompt}"`);
      
      const hfResponse = await fetch(
        "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
        {
          headers: {
            "Authorization": `Bearer ${this.hfToken}`,
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify({ inputs: prompt }),
        }
      );

      if (!hfResponse.ok) {
        throw new Error(`HF API Error: ${hfResponse.status}`);
      }

      const imageBuffer = await hfResponse.arrayBuffer();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('fileToUpload', blob, 'image.jpg');

      const catboxResponse = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData
      });

      if (!catboxResponse.ok) throw new Error('Catbox Upload Error');

      const imageUrl = await catboxResponse.text();

      return JSON.stringify({
        success: true,
        url: imageUrl,
        prompt: prompt,
        _llm_instruction: `MUESTRA ESTA IMAGEN: [🖼️ Imagen generada](${imageUrl})`
      });

    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message, _stopLoop: true });
    }
  }
}

export class GoogleSearchTool implements Tool {
  name = 'google_search';
  description = 'Busca información en tiempo real en la web.';

  schema = z.object({
    query: z.string().min(3, "La búsqueda es muy corta").describe('Término de búsqueda'),
  });

  private apiKey?: string;

  constructor(deps: ToolDependencies) {
    this.apiKey = deps.config.research.tavilyApiKey;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Término de búsqueda en internet.' }
        },
        required: ['query']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { query } = params as { query: string };

    if (!this.apiKey) {
      return JSON.stringify({ success: false, error: 'TAVILY_API_KEY missing', _stopLoop: true });
    }

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth: 'basic',
          include_answer: true,
          max_results: 5,
        }),
      });

      if (!response.ok) throw new Error(`Tavily Error: ${response.status}`);

      const data = await response.json() as any;
      return JSON.stringify({
        success: true,
        query,
        answer: data.answer,
        results: (data.results || []).map((r: any) => ({ title: r.title, url: r.url, content: r.content })),
      });

    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message, _stopLoop: true });
    }
  }
}

export class GithubTool implements Tool {
  name = 'github_tool';
  description = 'Accede a repositorios de GitHub.';

  schema = z.object({
    action: z.enum(['read_file', 'list_commits', 'list_issues']).describe('Acción a realizar'),
    owner: z.string().describe('Propietario del repo'),
    repo: z.string().describe('Nombre del repositorio'),
    path: z.string().optional().describe('Ruta del archivo (solo para read_file)'),
  });

  private token?: string;

  constructor(deps: ToolDependencies) {
    this.token = deps.config.dev.githubToken;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: { type: 'string', enum: ['read_file', 'list_commits', 'list_issues'], description: 'Acción de GitHub.' },
          owner: { type: 'string', description: 'Dueño del repositorio.' },
          repo: { type: 'string', description: 'Nombre del repo.' },
          path: { type: 'string', description: 'Ruta del archivo.' }
        },
        required: ['action', 'owner', 'repo']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { action, owner, repo, path } = params as { action: string; owner: string; repo: string; path?: string };

    if (!this.token) {
      return JSON.stringify({ success: false, error: 'GITHUB_TOKEN missing', _stopLoop: true });
    }

    const headers = { 'Authorization': `token ${this.token}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'OpenGravity-Bot' };

    try {
      let url = `https://api.github.com/repos/${owner}/${repo}`;
      if (action === 'read_file') url += `/contents/${path}`;
      else if (action === 'list_commits') url += `/commits?per_page=5`;
      else if (action === 'list_issues') url += `/issues?per_page=5`;

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error(`GitHub Error: ${response.status}`);

      const data = await response.json() as any;

      if (action === 'read_file') {
        const content = data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : JSON.stringify(data);
        return JSON.stringify({ success: true, path, content: content.substring(0, 5000) });
      }

      if (action === 'list_commits') {
        return JSON.stringify({ success: true, commits: data.map((c: any) => ({ sha: c.sha.substring(0, 7), message: c.commit.message })) });
      }

      return JSON.stringify({ success: true, issues: data.map((i: any) => ({ number: i.number, title: i.title })) });

    } catch (error) {
      return JSON.stringify({ success: false, error: (error as Error).message, _stopLoop: true });
    }
  }
}
