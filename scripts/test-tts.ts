import { TTSInterface } from '../src/services/audio/tts_interface.js';
import { parseConfig } from '../src/config.js';
import fs from 'fs';
import path from 'path';

async function test() {
  console.log('--- Testing TTS Fallback ---');
  
  const dummyConfig = parseConfig({
    TELEGRAM_BOT_TOKEN: '123:abc',
    TELEGRAM_ALLOWED_USER_IDS: '123',
    GROQ_API_KEY: 'gsk_123',
  });

  const tts = new TTSInterface(dummyConfig);

  try {
    console.log('1. Testing Google TTS (Plan B)...');
    const buffer = await tts.generateWithGoogle('Hola Pablo, esto es una prueba del sistema de voz de respaldo de OpenGravity. Protocolo Antigravity activado.');
    
    const outputPath = path.join(process.cwd(), 'temp_google_tts.mp3');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Success! Audio saved to: ${outputPath}`);
    console.log(`Buffer size: ${buffer.length} bytes`);
  } catch (error) {
    console.error('❌ Google TTS failed:', error);
  }

  process.exit(0);
}

test();
