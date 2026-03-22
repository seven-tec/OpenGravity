import { z } from 'zod';
import type { Tool, ToolDependencies } from '../base.js';

export default class VisionTool implements Tool {
  name = 'vision_analysis';
  description = 'Analiza el contenido de una imagen desde una URL y devuelve una descripción detallada. Úsalo cuando el usuario te mande una imagen o necesites entender un recurso visual.';

  schema = z.object({
    image_url: z.string().url().describe('URL de la imagen a analizar'),
    prompt: z.string().optional().default('Describe esta imagen con detalle técnico y artístico.').describe('Pregunta específica sobre la imagen (opcional)'),
  });

  private apiKey?: string;

  constructor(deps: ToolDependencies) {
    this.apiKey = deps.config.vision.openaiApiKey;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          image_url: { type: 'string', description: 'URL pública de la imagen.' },
          prompt: { type: 'string', description: 'Instrucción o pregunta sobre la imagen.' }
        },
        required: ['image_url']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { image_url, prompt } = params as { image_url: string; prompt: string };

    if (!this.apiKey) {
      return JSON.stringify({
        success: false,
        error: "FALTA CONFIGURACIÓN: OPENAI_API_KEY no está definido en la sección vision.",
        _stopLoop: true
      });
    }

    try {
      console.log(`[Vision] Analyzing image: ${image_url}`);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini', // Económico y capaz para vision
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: image_url }
                }
              ]
            }
          ],
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errData = await response.json() as any;
        throw new Error(errData.error?.message || `OpenAI Error: ${response.status}`);
      }

      const data = await response.json() as any;
      const analysis = data.choices[0].message.content;

      return JSON.stringify({
        success: true,
        analysis,
        image_url
      });

    } catch (error) {
      return JSON.stringify({ 
        success: false, 
        error: (error as Error).message, 
        _stopLoop: true 
      });
    }
  }
}
