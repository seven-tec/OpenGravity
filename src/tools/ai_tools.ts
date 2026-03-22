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
