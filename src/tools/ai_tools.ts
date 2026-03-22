import type { Tool } from './base.js';

export class ImageGenerationTool implements Tool {
  name = 'image_generation';
  description = 'Genera imágenes. REGLA DE ORO: La herramienta te devolverá una "url". ESTÁS OBLIGADO a mostrar esa URL en tu respuesta al usuario usando Markdown: ![texto](url). NUNCA preguntes si quiere verla, MOSTRALA INMEDIATAMENTE renderizando el markdown.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          prompt: {
            type: 'string',
            description: 'Descripción detallada de la imagen a generar. Incluye detalles de iluminación, plano, estilo, etc.'
          },
          width: {
            type: 'number',
            description: 'Resolución de ancho (default 1024).'
          },
          height: {
            type: 'number',
            description: 'Resolución de alto (default 1024).'
          }
        },
        required: ['prompt']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const prompt = params.prompt as string;
    const width = (params.width as number) || 1024;
    const height = (params.height as number) || 1024;
    
    // Un seed aleatorio obliga a Pollinations a generar una imagen nueva cada vez
    const seed = Math.floor(Math.random() * 1000000);
    
    // Construimos la URL de Pollinations. Renderizará la imagen on-the-fly.
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    console.log(`[ImageGeneration] Generating free image with Pollinations: "${prompt}"`);

    return JSON.stringify({
      success: true,
      url: imageUrl,
      prompt: prompt,
      provider: 'pollinations.ai',
      _llm_instruction: `MUESTRA ESTA IMAGEN AHORA MISMO en tu respuesta usando el formato: ![${prompt.replace(/"/g, '')}](${imageUrl})`
    });
  }
}

export class GoogleSearchTool implements Tool {
  name = 'google_search';
  description = 'Busca información en tiempo real en la web.';

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
    console.log(`[GoogleSearch] Searching: "${query}"`);
    return JSON.stringify({
      success: false,
      message: 'La herramienta de búsqueda (RESEARCH) está offline. Pablo tiene que configurar la API de Google Search o Tavily para que esto funcione. Tirale la oreja.',
      _stopLoop: true
    });
  }
}
