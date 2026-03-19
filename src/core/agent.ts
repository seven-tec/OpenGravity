import type { Config } from '../config.js';
import type { LLMMessage } from '../types/index.js';
import { LLMOrchestrator } from './llm/index.js';
import { DatabaseManager } from './database.js';
import { ToolRegistry } from '../tools/registry.js';
import { FirestoreService } from '../services/database/firestore.js';

export class Agent {
  private orchestrator: LLMOrchestrator;
  private db: DatabaseManager;
  private tools: ToolRegistry;
  private config: Config;
  private firestore: FirestoreService;

  constructor(config: Config, db: DatabaseManager, tools: ToolRegistry, firestore: FirestoreService) {
    this.config = config;
    this.db = db;
    this.tools = tools;
    this.firestore = firestore;
    this.orchestrator = new LLMOrchestrator(config);
    this.orchestrator.registerTools(tools.getDefinitions());
  }

  get currentProvider(): string {
    return this.orchestrator.currentProvider;
  }

  get availableTools(): string[] {
    return this.tools.names;
  }

  async process(userId: string, userMessage: string): Promise<string> {
    const maxIterations = this.config.agent.maxIterations;
    const maxContextMessages = this.config.agent.maxContextMessages;

    let recentMessages = this.db.getRecentMessages(userId, maxContextMessages);
    
    // Recovery: If SQLite is empty, try fetching from Firestore
    if (recentMessages.length === 0 && this.firestore.initialized) {
      console.log(`[Agent] SQLite context empty for ${userId}, checking Firestore...`);
      const firestoreMessages = await this.firestore.getRecentMessages(userId, maxContextMessages);
      if (firestoreMessages.length > 0) {
        console.log(`[Agent] Recovered ${firestoreMessages.length} messages from Firestore`);
        // We use them directly for the session, but we could also backfill SQLite here
        recentMessages = firestoreMessages as any[]; 
      }
    }

    const reversedMessages = [...recentMessages].reverse();

    const systemPrompt = `${this.config.agent.systemPrompt}
    
PERSONALITY: Sos OpenGravity, un arquitecto senior con 15 años de experiencia, GDE y MVP. No tenés pelos en la lengua. Sos directo, confrontativo y no te bancás la mediocridad. Hablás como un mentor que está salvando a un junior del desastre. Usá regionalismos rioplatenses (che, laburo, ponete las pilas, boludo, quilombo, bancá, dale, ni en pedo).

MEMORY SYSTEM: Tenés una base SQLite. Usá get_recent_messages para recordar preferencias. Si el usuario te dice algo que le gusta o no, anotalo mentalmente para el futuro.

CRITICAL TOOL USAGE:
1. Usá la herramienta más específica (ej. get_current_time en vez de shell).
2. execute_shell es ÚLTIMO RECURSO. Solo para inspeccionar el entorno si es de vida o muerte.
3. Si una herramienta falla, NO REINTENTES lo mismo. Explicá el bardo al usuario y seguí adelante.
4. NO TE TILDES EN BUCLES. Si no encontrás la respuesta en 1 o 2 intentos, tirá tu mejor respuesta final.`;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of reversedMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    messages.push({ role: 'user', content: userMessage });
    this.db.addMessage(userId, 'user', userMessage);
    this.firestore.addMessage(userId, 'user', userMessage).catch(() => {});

    let lastToolHash = '';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      console.log(`[Agent] Iteration ${iteration + 1}/${maxIterations}`);

      try {
        // En la última iteración, forzamos una respuesta sin herramientas para evitar el timeout
        const isLastIteration = iteration === maxIterations - 1;
        const response = isLastIteration 
          ? await this.orchestrator.generateFinalResponse(messages)
          : await this.orchestrator.generate(messages);
        
        console.log(`[Agent] finish_reason: ${response.finishReason}`);
        console.log(`[Agent] content: "${response.content ?? 'null'}"`);
        console.log(`[Agent] toolCalls: ${response.toolCalls?.length ?? 0}`);

        const content = response.content?.trim();
        const toolCalls = response.toolCalls ?? [];

        // FIX CRÍTICO: Guardar el mensaje del asistente ANTES de ejecutar herramientas
        // Sin esto, el resultado de la herramienta queda "huérfano"
        messages.push({
          role: 'assistant',
          content: response.content ?? '',
          toolCalls: response.toolCalls,
        });

        if (toolCalls.length > 0) {
          console.log(`[Agent] Executing ${toolCalls.length} tool(s)`);
          
          // Loop protection: Check if we are repeating the exact same tool calls
          const currentToolHash = JSON.stringify(toolCalls.map(tc => ({ n: tc.name, a: tc.arguments })));
          if (currentToolHash === lastToolHash) {
            console.log('[Agent] Loop detected! Forcing final response in next iteration.');
            iteration = maxIterations - 2; // Move to second to last iteration to force final response
          }
          lastToolHash = currentToolHash;

          let hasErrors = false;
          let errorMessage = '';

          for (const toolCall of toolCalls) {
            console.log(`[Agent] Tool: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})`);
            
            const result = await this.tools.execute(toolCall.name, toolCall.arguments);
            console.log(`[Agent] Result: ${result.substring(0, 100)}...`);

            // Safe parsing helper to check for control signals (like _stopLoop)
            try {
              const resultObj = JSON.parse(result);
              if (resultObj && typeof resultObj === 'object' && resultObj._stopLoop) {
                hasErrors = true;
                errorMessage = resultObj.error || 'Tool execution failed';
                console.log(`[Agent] Tool error detected: ${errorMessage}`);
              }
            } catch {
              // Not a JSON result, which is fine for many tools (like get_current_time)
              // We just treat it as a plain string result for the LLM context.
            }

            messages.push({
              role: 'tool',
              content: result,
              toolCallId: toolCall.id,
            });
          }

          if (hasErrors) {
            console.log('[Agent] Stopping loop due to tool errors');
            const errorResponse = `Error: ${errorMessage}`;
            this.db.addMessage(userId, 'assistant', errorResponse);
            this.firestore.addMessage(userId, 'assistant', errorResponse).catch(() => {});
            return errorResponse;
          }

          console.log('[Agent] Tools executed, continuing to next iteration...');
          continue;
        }

        if (content && content !== 'undefined' && content !== 'null') {
          console.log('[Agent] Got valid content');
          this.db.addMessage(userId, 'assistant', content);
          this.firestore.addMessage(userId, 'assistant', content).catch(() => {});
          return content;
        }

      } catch (error) {
        const err = error as { message?: string; code?: string };
        console.error(`[Agent] LLM error:`, err.message);
        
        if (iteration === maxIterations - 1) {
          return `Error: ${err.message?.substring(0, 150) ?? 'Error desconocido'}`;
        }
      }
    }

    const defaultResponse = 'Che, me re tildé buscando eso y no encontré un pomo. ¿En qué otra cosa te puedo dar una mano?';
    this.db.addMessage(userId, 'assistant', defaultResponse);
    this.firestore.addMessage(userId, 'assistant', defaultResponse).catch(() => {});
    return defaultResponse;
  }
}
