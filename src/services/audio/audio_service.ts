import axios from 'axios';
import { createWriteStream, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Config } from '../../config.js';
import { AudioConverter } from './audio_converter.js';
import { GroqSTT } from './groq_stt.js';
import { OpenAISTT } from './openai_stt.js';
import type { ISTTService, STTResult } from './stt_interface.js';

export class AudioService {
  private stt: ISTTService;
  private converter: AudioConverter;
  private botToken: string;

  constructor(config: Config) {
    this.botToken = config.telegram.botToken;
    this.converter = new AudioConverter();
    
    if (config.audio.whisperProvider === 'groq') {
      this.stt = new GroqSTT(config);
    } else {
      this.stt = new OpenAISTT(config);
    }
  }

  async processVoice(fileId: string, telegramFilePath: string): Promise<STTResult> {
    const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${telegramFilePath}`;
    const tempDir = join(tmpdir(), 'opengravity_audio');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const ogaPath = join(tempDir, `${fileId}.oga`);
    let convertedPath: string | undefined;

    try {
      // 1. Download
      const response = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream',
      });

      const writer = createWriteStream(ogaPath);
      response.data.pipe(writer);

      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', (err) => reject(err));
      });

      // 2. Convert
      console.log(`[AudioService] Converting ${ogaPath}...`);
      convertedPath = await this.converter.convertToWav(ogaPath);

      // 3. Transcribe
      console.log(`[AudioService] Transcribing ${convertedPath}...`);
      const result = await this.stt.transcribeFile(convertedPath);

      return result;
    } catch (error: any) {
      console.error('[AudioService] Error processing voice:', error);
      return { error: error.message };
    } finally {
      // Cleanup
      try {
        if (existsSync(ogaPath)) unlinkSync(ogaPath);
        if (convertedPath && existsSync(convertedPath)) unlinkSync(convertedPath);
      } catch (e) {
        console.warn('[AudioService] Cleanup error:', e);
      }
    }
  }
}
