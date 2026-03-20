import * as googleTTS from 'google-tts-api';
import type { Config } from '../../config.js';

export interface TTSOptions {
  text: string;
  voiceId?: string;
  model?: string;
}

export interface TTSResult {
  audioBuffer?: Buffer;
  audioBase64?: string;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

export class TTSInterface {
  private apiKey: string | undefined;
  private defaultVoiceId: string;

  constructor(config: Config) {
    this.apiKey = config.audio.elevenlabsApiKey?.trim();
    this.defaultVoiceId = config.audio.elevenlabsVoiceId;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * PLAN A: ElevenLabs Synthesis
   */
  async generateWithEleven(text: string, options?: Partial<TTSOptions>): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API Key not configured');
    }

    const voiceId = options?.voiceId ?? this.defaultVoiceId;
    const model = options?.model ?? 'eleven_multilingual_v1';


    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error (${response.status}): ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * PLAN B: Google TTS Synthesis (Backup)
   */
  async generateWithGoogle(text: string, lang = 'es'): Promise<Buffer> {
    try {
      // google-tts-api returns a URL or base64. Base64 is easier for us.
      // For long texts, it might need chunking, but the library handles it if we use getAllAudioBase64
      // However, for short responses, getAudioBase64 is enough.
      const results = await googleTTS.getAllAudioBase64(text, {
        lang,
        slow: false,
        host: 'https://translate.google.com',
      });

      const buffers = results.map(res => Buffer.from(res.base64, 'base64'));
      return Buffer.concat(buffers);
    } catch (error) {
      const err = error as Error;
      throw new Error(`Google TTS error: ${err.message}`);
    }
  }

  /**
   * legacy/generic method (deprecated in favor of generateWithX)
   */
  async synthesize(options: TTSOptions): Promise<TTSResult> {
    try {
      const buffer = await this.generateWithEleven(options.text, options);
      return {
        audioBuffer: buffer,
        audioBase64: buffer.toString('base64'),
        duration: buffer.length / (44100 * 2),
      };
    } catch (error) {
      const err = error as Error;
      return { error: err.message };
    }
  }

  async synthesizeAndSave(options: TTSOptions, outputPath: string): Promise<TTSResult> {
    const result = await this.synthesize(options);
    
    if (result.audioBuffer && !result.error) {
      const { writeFile } = await import('fs/promises');
      await writeFile(outputPath, result.audioBuffer);
    }
    
    return result;
  }
}

