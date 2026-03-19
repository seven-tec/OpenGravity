import type { Config } from '../../config.js';

export interface TTSOptions {
  text: string;
  voiceId?: string;
  model?: string;
}

export interface TTSResult {
  audioBase64?: string;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

export class TTSInterface {
  private apiKey: string | undefined;
  private defaultVoiceId: string;

  constructor(config: Config) {
    this.apiKey = config.audio.elevenlabsApiKey;
    this.defaultVoiceId = config.audio.elevenlabsVoiceId;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async synthesize(options: TTSOptions): Promise<TTSResult> {
    if (!this.isEnabled()) {
      return { error: 'TTS not configured. Set ELEVENLABS_API_KEY in .env' };
    }

    try {
      const voiceId = options.voiceId ?? this.defaultVoiceId;
      const model = options.model ?? 'eleven_monolingual_v1';

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.apiKey!,
          },
          body: JSON.stringify({
            text: options.text,
            model_id: model,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        return { error: `ElevenLabs API error: ${error}` };
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString('base64');

      return {
        audioBase64,
        duration: audioBuffer.byteLength / (44100 * 2),
      };
    } catch (error) {
      const err = error as Error;
      return { error: err.message };
    }
  }

  async synthesizeAndSave(options: TTSOptions, outputPath: string): Promise<TTSResult> {
    const result = await this.synthesize(options);
    
    if (result.audioBase64 && !result.error) {
      const { writeFile } = await import('fs/promises');
      const audioBuffer = Buffer.from(result.audioBase64, 'base64');
      await writeFile(outputPath, audioBuffer);
    }
    
    return result;
  }
}
