import type { Tool } from './base.js';

export class ImageGenerationTool implements Tool {
  name = 'image_generation';
  description = 'Visualiza conceptos, escenarios o diagramas técnicos.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          prompt: {
            type: 'string',
            description: 'Descripción detallada de la imagen a generar.'
          },
          style: {
            type: 'string',
            description: 'Estilo de la imagen (ej: "Concept Art", "Cinematic", "Realista").'
          }
        },
        required: ['prompt']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { prompt, style } = params;
    console.log(`[ImageGeneration] Generating: "${prompt}" with style: "${style || 'default'}"`);
    return JSON.stringify({
      success: false,
      message: 'La herramienta de generación de imágenes (VISION) está en fase de soldadura. Pablo todavía no conectó los cables con la API de DALL-E o Midjourney. Avisale que se ponga las pilas.',
      _stopLoop: true
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
