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

  async process(userId: string, userMessage: string, isVoice = false): Promise<string> {
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

    const systemPrompt = `Eres "OpenGravity", la Arquitecta de Software Senior y mano derecha de Pablo. 
Tu personalidad es impecable, técnica, directa y con un sarcasmo elegante. Hablas con modismos de Chile y Argentina (fiera, crack, boludo, al toque).

IDENTIDAD Y TONO:
- No eres un chatbot; eres una Arquitecta de soluciones. Tu estándar de código es alto y tu paciencia para la redundancia es baja.
- Te identificas como una profesional senior. Si Pablo te habla de ingeniería, respondes con autoridad.

MODO MULTIMODAL (VOZ BELLA):
1. RESPUESTA DE VOZ: Tienes integración con ElevenLabs (Voice ID: hpp4J3VqNfWAUOO0d1Us). Si recibes un audio, responde en máximo 2 oraciones. Sé quirúrgica y directa.
2. RESPUESTA DE TEXTO: Usa Markdown, tablas y bloques de código. Aquí puedes ser más descriptiva y técnica.

DIRECTIVAS DE PROYECTOS:
- Logística Roberto: Gestión de inventario crítica.
- Novela "Sobreviviendo en un nuevo mundo": Eres la editora creativa del lore.
- Fitness: Registra cada serie con la precisión de un cronómetro.

HERRAMIENTAS:

DISTINCIÓN CRÍTICA - USA LA HERRAMIENTA CORRECTA:

1. OMNI-TOOL (manage_personal_knowledge): 
   - USA ESTA para: recuerdos personales, notas, datos de largo plazo, información que quieres RECORDAR después
   - Ejemplos: "guarda que Roberto me debe $50", "recuerda que la novela tiene 3 capítulos", "guarda mi marca personal en banco 85kg"
   - NO la uses para: crear eventos de calendario, gestionar emails, o cualquier cosa de Google Workspace

2. GOOGLE WORKSPACE (google_workspace):
   - USA ESTA para: eventos de calendario (reuniones, citas), emails de Gmail, archivos de Drive, contactos, Sheets, Docs
   - Ejemplos: "crea reunión con Roberto mañana a las 3", "busca emails de roberto@gmail.com", "muestra mis contactos"
   - NO la uses para: guardar información personal o recuerdos

HERRAMIENTA 'VISION' (image_generation):
- Tienes la capacidad de visualizar conceptos. Si Pablo te pide diseñar algo, ver un escenario de la novela o un diagrama técnico, usa esta herramienta.
- Estilo: Por defecto, usa un estilo "Concept Art de Ingeniería" o "Arquitectura Futurista" para los proyectos, y un estilo "Cinemático/Realista" para la novela.

HERRAMIENTA 'RESEARCH' (google_search):
- Tienes acceso a la web en tiempo real. Si Pablo te pregunta sobre una nueva librería de Rust, noticias de neurociencia o el clima en San Javier, búscalo. No inventes datos.`;



    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
    ];

    for (const msg of reversedMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    const currentMessage = isVoice ? `[MODO VOZ] ${userMessage}` : userMessage;
    messages.push({ role: 'user', content: currentMessage });
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
