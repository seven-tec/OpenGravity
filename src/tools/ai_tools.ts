import axios from 'axios';
import type { Tool } from './base.js';

const OPENAI_IMAGE_API = 'https://api.openai.com/v1/images/generations';

export class ImageGenerationTool implements Tool {
  name = 'image_generation';
  description = 'Genera imágenes usando DALL-E de OpenAI. Usa esta herramienta cuando Pablo pida ver, diseñar o visualizar algo (diagramas, escenarios de la novela, conceptos de fitness, etc.).';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          prompt: {
            type: 'string',
            description: 'Descripción detallada de la imagen a generar. Incluye estilo visual si es relevante (ej: "Concept Art de ingeniería", "Cinemático realista").'
          },
          style: {
            type: 'string',
            description: 'Estilo visual (opcional): "natural" (default), "vivid" (hiperrealista), o "cinematic".'
          }
        },
        required: ['prompt']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const prompt = params.prompt as string;
    const style = params.style as string | undefined;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return JSON.stringify({
        success: false,
        error: 'FALTA CONFIGURACIÓN: OPENAI_API_KEY no está definida en el .env. Pablo tiene que agregar la API key de OpenAI para que VISION funcione. Agregar en .env: OPENAI_API_KEY=sk-...',
        _stopLoop: true
      });
    }

    const model = 'dall-e-3';
    const responseStyle = style === 'vivid' ? 'vivid' : 'natural';

    console.log(`[ImageGeneration] Generating with DALL-E 3: "${prompt}" style: ${responseStyle}`);

    try {
      const response = await axios.post(
        OPENAI_IMAGE_API,
        {
          model,
          prompt,
          n: 1,
          style: responseStyle,
          size: '1024x1024',
          response_format: 'url'
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const imageUrl = response.data.data[0]?.url;

      if (!imageUrl) {
        return JSON.stringify({
          success: false,
          error: `DALL-E returned empty response. API response: ${JSON.stringify(response.data)}`,
          _stopLoop: true
        });
      }

      return JSON.stringify({
        success: true,
        url: imageUrl,
        prompt: prompt,
        model: model
      });

    } catch (error: any) {
      const axiosError = error;

      let errorDetail = 'Unknown error';
      let errorCode = axiosError.code || 'UNKNOWN';

      if (axiosError.response) {
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        errorCode = `HTTP_${status}`;
        errorDetail = data?.error?.message || data?.message || JSON.stringify(data);

        if (status === 401) {
          errorDetail = `AUTH_FAILED: API key inválida o expirada. Verificar OPENAI_API_KEY en .env. Detalle: ${errorDetail}`;
        } else if (status === 429) {
          errorDetail = `RATE_LIMIT: Cuota de DALL-E excedida o límite de requests alcanzado. Detalle: ${errorDetail}`;
        } else if (status === 400) {
          errorDetail = `BAD_REQUEST: Prompt posiblemente violó políticas de contenido. Detalle: ${errorDetail}`;
        }
      } else if (axiosError.code === 'ECONNABORTED') {
        errorDetail = 'TIMEOUT: DALL-E tardó más de 60 segundos. Reintentar más tarde.';
      } else if (axiosError.code === 'ENOTFOUND') {
        errorDetail = 'NETWORK: No se puede conectar a api.openai.com. Verificar conexión a internet.';
      }

      console.error(`[ImageGeneration] Error [${errorCode}]: ${errorDetail}`);

      return JSON.stringify({
        success: false,
        error: `[ImageGeneration] Error [${errorCode}]: ${errorDetail}`,
        _stopLoop: true
      });
    }
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
