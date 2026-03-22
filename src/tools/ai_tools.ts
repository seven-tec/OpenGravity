import type { Tool } from './base.js';

export class ImageGenerationTool implements Tool {
  name = 'image_generation';
  description = 'Herramienta EXCLUSIVA para generar o dibujar imágenes. Úsala SIEMPRE que Pablo pida "genera una imagen", "dibuja", "muestrame una foto", etc. Tú eres texto, esta tool dibuja por ti. Al devolverte la URL, muéstrala exactamente así: [🖼️ Ver Imagen](url).';
  
  private hfToken?: string;

  constructor(hfToken?: string) {
    this.hfToken = hfToken;
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
    const prompt = params.prompt as string;
    
    if (!this.hfToken) {
      console.log(`[ImageGeneration] Failed: HF_TOKEN is missing`);
      return JSON.stringify({
        success: false,
        error: "FALTA CONFIGURACIÓN: HF_TOKEN no está definido en el .env. Carga el Access Token de Hugging Face para poder generar imágenes con FLUX.1.",
        _stopLoop: true
      });
    }

    try {
      console.log(`[ImageGeneration] Generating image with Hugging Face (FLUX.1-schnell): "${prompt}"`);
      
      // 1. Generar la imagen con Hugging Face Inference API
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
        const errorText = await hfResponse.text();
        throw new Error(`Hugging Face API Error: ${hfResponse.status} - ${errorText}`);
      }

      console.log(`[ImageGeneration] Image generated. Uploading to Catbox for Telegram...`);
      const imageBuffer = await hfResponse.arrayBuffer();
      const blob = new Blob([imageBuffer], { type: 'image/jpeg' });

      // 2. Subir la imagen a Catbox.moe (host temporal/gratuito) para que Telegram la pueda mostrar
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      formData.append('fileToUpload', blob, 'image.jpg');

      const catboxResponse = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData
      });

      if (!catboxResponse.ok) {
        throw new Error(`Catbox Upload Error: ${catboxResponse.status}`);
      }

      const imageUrl = await catboxResponse.text();
      console.log(`[ImageGeneration] Uploaded successfully: ${imageUrl}`);

      return JSON.stringify({
        success: true,
        url: imageUrl,
        prompt: prompt,
        provider: 'huggingface+catbox',
        _llm_instruction: `MUESTRA ESTA IMAGEN AHORA MISMO copiando exactamente este texto en una sola línea: [🖼️ Imagen generada](${imageUrl})`
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[ImageGeneration] Hubo un error crítico: ${msg}`);
      return JSON.stringify({
        success: false,
        error: `Error al generar la imagen: ${msg}`,
        _stopLoop: true
      });
    }
  }
}

export class GoogleSearchTool implements Tool {
  name = 'google_search';
  description = 'Busca información en tiempo real en la web. Úsala para responder preguntas sobre eventos recientes, noticias, o datos que no conoces.';

  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Término de búsqueda.'
          }
        },
        required: ['query']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { query } = params;

    if (!this.apiKey) {
      console.log(`[GoogleSearch] Failed: TAVILY_API_KEY is missing`);
      return JSON.stringify({
        success: false,
        error: 'La herramienta de búsqueda (RESEARCH) está offline. Pablo tiene que configurar la TAVILY_API_KEY en el .env.',
        _stopLoop: true
      });
    }

    console.log(`[GoogleSearch] Searching Tavily for: "${query}"`);

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query,
          search_depth: 'basic',
          include_answer: true,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;
      
      // Tavily devuelve un "answer" si include_answer es true, lo cual es genial para el LLM
      const results = data.results.map((r: any) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      }));

      return JSON.stringify({
        success: true,
        query: query,
        answer: data.answer,
        results: results,
      });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[GoogleSearch] Error crítico: ${msg}`);
      return JSON.stringify({
        success: false,
        error: `Error al buscar en internet: ${msg}`,
        _stopLoop: true
      });
    }
  }
}

export class GithubTool implements Tool {
  name = 'github_tool';
  description = 'Accede a repositorios de GitHub. Permite leer archivos, ver commits o issues. Úsala para analizar código de Pablo.';

  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['read_file', 'list_commits', 'list_issues'],
            description: 'Acción a realizar.'
          },
          owner: {
            type: 'string',
            description: 'Propietario del repo (ej: seven-tec).'
          },
          repo: {
            type: 'string',
            description: 'Nombre del repositorio (ej: OpenGravity).'
          },
          path: {
            type: 'string',
            description: 'Ruta del archivo (solo para read_file).'
          }
        },
        required: ['action', 'owner', 'repo']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { action, owner, repo, path } = params as any;

    if (!this.token) {
      console.log(`[GithubTool] Failed: GITHUB_TOKEN is missing`);
      return JSON.stringify({
        success: false,
        error: 'Falta GITHUB_TOKEN en el .env. Pablo tiene que configurarlo para leer repos privados.',
        _stopLoop: true
      });
    }

    const headers: Record<string, string> = {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OpenGravity-Bot'
    };

    try {
      let url = `https://api.github.com/repos/${owner}/${repo}`;
      
      if (action === 'read_file') {
        url += `/contents/${path}`;
        console.log(`[GithubTool] Reading file: ${owner}/${repo}/${path}`);
      } else if (action === 'list_commits') {
        url += `/commits?per_page=5`;
        console.log(`[GithubTool] Listing commits: ${owner}/${repo}`);
      } else if (action === 'list_issues') {
        url += `/issues?per_page=5`;
        console.log(`[GithubTool] Listing issues: ${owner}/${repo}`);
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as any;

      if (action === 'read_file') {
        if (data.encoding === 'base64') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          const isTooLarge = content.length > 5000;
          return JSON.stringify({ 
            success: true, 
            path, 
            content: isTooLarge ? content.substring(0, 5000) + '... (RECORTADO por tamaño)' : content 
          });
        }
        return JSON.stringify({ success: true, path, data });
      }

      if (action === 'list_commits') {
        const commits = data.map((c: any) => ({
          sha: c.sha.substring(0, 7),
          author: c.commit.author.name,
          message: c.commit.message,
          date: c.commit.author.date
        }));
        return JSON.stringify({ success: true, commits });
      }

      if (action === 'list_issues') {
        const issues = data.map((i: any) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          user: i.user.login
        }));
        return JSON.stringify({ success: true, issues });
      }

      return JSON.stringify({ success: false, error: 'Acción no soportada' });

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[GithubTool] Error: ${msg}`);
      return JSON.stringify({
        success: false,
        error: `Error en GitHub: ${msg}`,
        _stopLoop: true
      });
    }
  }
}
