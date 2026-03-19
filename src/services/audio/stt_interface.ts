import type { Config } from '../../config.js';
import { readFile } from 'fs/promises';

export interface STTResult {
  text?: string;
  language?: string;
  error?: string;
}

export class STTInterface {
  private apiKey: string | undefined;

  constructor(config: Config) {
    this.apiKey = config.audio.whisperApiKey;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async transcribeFile(audioPath: string, language?: string): Promise<STTResult> {
    if (!this.isEnabled()) {
      return { error: 'STT not configured. Set WHISPER_API_KEY in .env' };
    }

    try {
      const audioBuffer = await readFile(audioPath);
      const base64Audio = audioBuffer.toString('base64');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'whisper-1',
          file: `data:audio/mp3;base64,${base64Audio}`,
          language: language,
          response_format: 'json',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { error: `Whisper API error: ${error}` };
      }

      const result = await response.json() as { text: string };
      return { text: result.text };
    } catch (error) {
      const err = error as Error;
      return { error: err.message };
    }
  }

  async transcribeBase64(base64Audio: string, mimeType = 'audio/mp3'): Promise<STTResult> {
    if (!this.isEnabled()) {
      return { error: 'STT not configured. Set WHISPER_API_KEY in .env' };
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'whisper-1',
          file: `data:${mimeType};base64,${base64Audio}`,
          response_format: 'json',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { error: `Whisper API error: ${error}` };
      }

      const result = await response.json() as { text: string };
      return { text: result.text };
    } catch (error) {
      const err = error as Error;
      return { error: err.message };
    }
  }
}
