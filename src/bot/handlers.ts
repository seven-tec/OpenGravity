import { InputFile } from 'grammy';
import type { AppContext } from './middleware/whitelist.js';
import type { Agent } from '../core/agent.js';
import type { DatabaseManager } from '../core/database.js';
import type { AudioService } from '../services/audio/audio_service.js';
import type { TTSInterface } from '../services/audio/tts_interface.js';

export function createHandlers(agent: Agent, db: DatabaseManager, audio: AudioService, tts: TTSInterface) {
  return {
    async onStart(ctx: AppContext): Promise<void> {
      await ctx.reply(`🤖 *OpenGravity v1.0 Activado*

Soy tu agente autónomo con capacidades de IA.
Usa /help para ver comandos disponibles.`, { parse_mode: 'Markdown' });
    },

    async onHelp(ctx: AppContext): Promise<void> {
      await ctx.reply(`📚 *Comandos Disponibles*

• /start - Iniciar el bot
• /help - Mostrar ayuda
• /status - Estado del sistema
• /clear - Limpiar historial
• /memory - Ver memoria de largo plazo
• /time - Consultar hora actual

_Envíame cualquier mensaje y lo procesaré con mi Agent Loop._`, { parse_mode: 'Markdown' });
    },

    async onStatus(ctx: AppContext): Promise<void> {
      const userId = ctx.from!.id.toString();
      const recentMessages = db.getRecentMessages(userId, 100);
      
      await ctx.reply(`🔍 *Estado del Sistema*

• Provider LLM: \`${agent.currentProvider}\`
• Mensajes en contexto: ${recentMessages.length}
• Herramientas disponibles: ${agent.availableTools.join(', ')}

_Todo operacional._`, { parse_mode: 'Markdown' });
    },

    async onClear(ctx: AppContext): Promise<void> {
      const userId = ctx.from!.id.toString();
      db.clearOldMessages(userId, 0);
      
      await ctx.reply('🗑️ Historial limpiado.');
    },

    async onMemory(ctx: AppContext): Promise<void> {
      const userId = ctx.from!.id.toString();
      const memories = db.searchMemory(userId, '');
      
      if (memories.length === 0) {
        await ctx.reply('📝 No hay memorias almacenadas.');
        return;
      }

      const memoryList = memories
        .map(m => `• **${m.key}**: ${m.value}`)
        .join('\n');

      await ctx.reply(`📝 *Memoria de Largo Plazo*\n\n${memoryList}`, { parse_mode: 'Markdown' });
    },

    async onTime(ctx: AppContext): Promise<void> {
      const now = new Date();
      await ctx.reply(`🕐 Hora actual:\n\n${now.toISOString()}\n\nUTC: ${now.toISOString()}`);
    },

    async onMessage(ctx: AppContext): Promise<void> {
      const userId = ctx.from!.id.toString();
      const text = ctx.message?.text;

      if (!text) {
        await ctx.reply('Solo acepto mensajes de texto por ahora. 🎤 (STT en desarrollo)');
        return;
      }

      console.log(`[Handler] Message from ${userId}: ${text.substring(0, 50)}...`);

      try {
        const response = await agent.process(userId, text);
        
        if (!response.trim()) {
          await ctx.reply('⚠️ El agente no devolvió una respuesta válida.');
          return;
        }

        await ctx.reply(response);
      } catch (error) {
        console.error('[Handler] Agent error:', error);
        await ctx.reply('❌ Error procesando tu mensaje. Intenta de nuevo.');
      }
    },

    async onVoice(ctx: AppContext): Promise<void> {
      const voice = ctx.message?.voice;
      if (!voice) return;

      const msg = await ctx.reply('🎤 _Escuchando..._', { parse_mode: 'Markdown' });

      try {
        const file = await ctx.getFile();
        const result = await audio.processVoice(voice.file_id, file.file_path!);

        if (result.error) {
          await ctx.api.editMessageText(ctx.chat!.id, msg.message_id, `❌ Error en transcripción: ${result.error}`);
          return;
        }

        if (!result.text) {
          await ctx.api.editMessageText(ctx.chat!.id, msg.message_id, '⚠️ No se pudo extraer texto del audio.');
          return;
        }

        await ctx.api.editMessageText(ctx.chat!.id, msg.message_id, `📝 _Transcripción:_ "${result.text}"`, { parse_mode: 'Markdown' });
        
        // Process with agent
        const userId = ctx.from!.id.toString();
        const response = await agent.process(userId, result.text, true);
        
        // Output Voice response if TTS is enabled
        if (tts.isEnabled() && response.length < 2000) {
          try {
            // PLAN A: ElevenLabs
            console.log(`[Handler] Plan A: Synthesizing with ElevenLabs...`);
            const audioBuffer = await tts.generateWithEleven(response);
            console.log('[Handler] ElevenLabs Success, sending voice message');
            await ctx.replyWithVoice(new InputFile(audioBuffer, 'response.mp3'));
          } catch (error) {
            // PLAN B: Notification + Google TTS
            console.error("[Handler] Plan A failed, activating fallback:", error);
            
            // Mensaje silencioso para no molestar tanto
            await ctx.reply("⚠️ Cuota de ElevenLabs agotada o error de API. Usando voz de respaldo...", { 
              disable_notification: true 
            });

            try {
              console.log(`[Handler] Plan B: Synthesizing with Google TTS...`);
              const backupAudio = await tts.generateWithGoogle(response);
              await ctx.replyWithVoice(new InputFile(backupAudio, 'backup_response.mp3'));
            } catch (fallbackError) {
              console.error('[Handler] Plan B also failed:', fallbackError);
              await ctx.reply(response);
            }
          }
        } else {
          if (!tts.isEnabled()) console.log('[Handler] TTS is disabled, sending text message');
          await ctx.reply(response);
        }

      } catch (error) {
        console.error('[Handler] Voice error:', error);
        await ctx.api.editMessageText(ctx.chat!.id, msg.message_id, '❌ Error procesando el audio.');
      }
    },
  };
}
