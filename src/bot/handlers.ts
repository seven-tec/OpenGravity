import type { AppContext } from './middleware/whitelist.js';
import type { Agent } from '../core/agent.js';
import type { DatabaseManager } from '../core/database.js';

export function createHandlers(agent: Agent, db: DatabaseManager) {
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
      await ctx.reply('🎤 Mensajes de voz detectados. Usa /help para más info sobre STT.');
    },
  };
}
