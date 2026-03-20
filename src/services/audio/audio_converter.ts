import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname, basename, extname } from 'path';

const execAsync = promisify(exec);

export class AudioConverter {
  /**
   * Converts any audio format to WAV (pcm_s16le, 16kHz, mono)
   */
  async convertToWav(inputPath: string): Promise<string> {
    const outputDir = dirname(inputPath);
    const outputBase = basename(inputPath, extname(inputPath));
    const outputPath = join(outputDir, `${outputBase}_converted.wav`);

    try {
      // Use ffmpeg to convert to a standard format compatible with most STT providers
      // loudnorm=I=-16:TP=-1.5:LRA=11: Normalizes audio perceived loudness
      await execAsync(`ffmpeg -i "${inputPath}" -filter:a "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 16000 -ac 1 -c:a pcm_s16le "${outputPath}" -y`);
      return outputPath;
    } catch (error) {
      console.error('[AudioConverter] Error converting file:', error);
      throw new Error(`Failed to convert audio: ${(error as Error).message}`);
    }
  }
}
