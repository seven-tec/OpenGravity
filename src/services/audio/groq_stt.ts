import axios from 'axios';
import FormData from 'form-data';
import { createReadStream } from 'fs';
import type { Config } from '../../config.js';
import type { ISTTService, STTResult } from './stt_interface.js';

export class GroqSTT implements ISTTService {
  private apiKey: string | undefined;

  constructor(config: Config) {
    this.apiKey = config.audio.whisperApiKey;
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }

  async transcribeFile(audioPath: string, language?: string): Promise<STTResult> {
    if (!this.isEnabled()) {
      return { error: 'Groq API Key not configured' };
    }

    try {
      const form = new FormData();
      form.append('file', createReadStream(audioPath));
      form.append('model', 'whisper-large-v3');
      if (language) {
        form.append('language', language);
      }
      form.append('response_format', 'json');

      const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`,
        },
        timeout: 30000,
      });

      return { text: response.data.text };
    } catch (error: any) {
      console.error('[GroqSTT] Error details:', error.response?.data || error.message);
      const message = error.response?.data?.error?.message || error.message;
      return { error: `Groq STT error: ${message}` };
    }
  }
}
