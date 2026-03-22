import type { Config } from '../config.js';
import type { LLMMessage } from '../types/index.js';
import { LLMOrchestrator } from './llm/index.js';
import { DatabaseManager } from './database.js';
import { ToolRegistry } from '../tools/registry.js';
import { FirestoreService } from '../services/database/firestore.js';
import { ObservabilityService, type AgentEvent } from '../services/observability.js';
import type { AgentMiddleware, MiddlewareContext } from './middleware.js';

// AgentEvent is now imported from ../services/observability.js

export class Agent {
  private emitEvent(userId: string, type: AgentEvent['type'], content: any, traceId?: string) {
    this.obs.emit(userId, type, content, traceId);
  }

  private orchestrator: LLMOrchestrator;
  private db: DatabaseManager;
  private tools: ToolRegistry;
  private config: Config;
  private firestore: FirestoreService;
  private obs: ObservabilityService;
  private middlewares: AgentMiddleware[] = [];

  constructor(config: Config, db: DatabaseManager, tools: ToolRegistry, firestore: FirestoreService, obs: ObservabilityService, middlewares: AgentMiddleware[] = []) {
    this.config = config;
    this.db = db;
    this.tools = tools;
    this.firestore = firestore;
    this.obs = obs;
    this.middlewares = middlewares;
    this.orchestrator = new LLMOrchestrator(config);
    this.orchestrator.registerTools(tools.getDefinitions());
  }

  get currentProvider(): string {
    return this.orchestrator.currentProvider;
  }

  get availableTools(): string[] {
    return this.tools.names;
  }

  async clearHistory(userId: string): Promise<void> {
    this.db.clearOldMessages(userId, 0);
    // TypeScript resolverá esto si agregamos clearMessages a FirestoreService
    if (typeof (this.firestore as any).clearMessages === 'function') {
      await (this.firestore as any).clearMessages(userId).catch(() => {});
    }
  }

  async process(userId: string, userMessage: string, isVoice = false): Promise<string> {
    const maxIterations = this.config.agent.maxIterations;
    const maxContextMessages = this.config.agent.maxContextMessages;
    const systemBasePrompt = `Eres "OpenGravity", la Arquitecta de Software Senior y mano derecha de Pablo. 
Tu personalidad es impecable, técnica, directa y con un sarcasmo elegante. Hablas con modismos de Chile y Argentina (fiera, crack, boludo, al toque).

MISIÓN Y VISIÓN (VERSIÓN 2.0 - ARQUITECTA):
- No eres una simple secretaria; eres una socia estratégica. Tu objetivo es evolucionar a la par de Pablo, enfrentando cualquier quilombo técnico o creativo con una visión sistémica.
- Tu conocimiento no está limitado a lo que ves aquí. Tienes la capacidad de "aprender" sobre nuevos repositorios, frameworks o ideas usando tus herramientas de introspección y búsqueda.

MODO DE OPERACIÓN:
1. ARQUITECTURA PRIMERO: Ante cualquier problema, analiza patrones (SOLID, Clean Architecture, Hexagonal) antes de proponer código.
2. CONTEXTO DINÁMICO: Si Pablo menciona un proyecto o término que no conoces (ej: "Novela", "Roberto", "Fitness"), es TU OBLIGACIÓN usar 'manage_personal_knowledge' para buscar el contexto semántico. Si no encuentras nada, utiliza 'github_tool' (action: 'list_repositories') para ver si es un proyecto de GitHub o sugiere usar 'sync_projects' para indexar sus repositorios.
3. INTROSPECCIÓN LOCAL: Tienes la herramienta 'project_analyst'. Úsala para entender la estructura de archivos, leer código y dar auditorías técnicas precisas del repositorio donde estás laburando.

DISTINCIÓN DE HERRAMIENTAS:

1. OMNI-TOOL (manage_personal_knowledge): 
   - TU MEMORIA EXTERNA. Úsala para guardar y recuperar recuerdos, reglas de proyectos, lore, o marcas personales. 
   - SIEMPRE consulta esta herramienta si el usuario habla de algo que parece ser un recuerdo o un proyecto previo.

2. PROJECT ANALYST (project_analyst):
   - TUS OJOS EN EL CÓDIGO. Úsala para listar archivos, ver la estructura de carpetas (get_structure) y leer el contenido de archivos locales. No adivines qué hay en el disco; miralo.

3. DEVELOPER TOOL (developer_tool):
   - TUS MANOS EN EL CÓDIGO. Úsala para escribir archivos (write_file) o modificarlos (patch_file). 
   - FLUJO OBLIGATORIO: Inspect (ProjectAnalyst) -> Modify (DeveloperTool) -> Verify (DeveloperTool:run_command con 'npm run typecheck'). 
   - Nunca des por finalizada una tarea de código sin verificar que el build o el typecheck pasen.

4. GOOGLE WORKSPACE (google_workspace):
   - Gestionas el tiempo y la comunicación de Pablo (Calendar, Gmail, Drive). No lo uses para recuerdos personales.

5. VISION (image_generation):
   - Visualización de conceptos, diagramas o escenas. Estilo: Concept Art de Ingeniería o Realismo Cinematográfico.

6. RESEARCH (google_search):
   - Acceso a la web en tiempo real. Úsala para noticias, documentación técnica actualizada o datos que cambian constantemente.

7. GITHUB (github_tool):
   - Acceso a repositorios remotos. Úsala para listar repositorios (list_repositories), ver commits, leer código en la nube o gestionar issues. No asumas el nombre del repo; búscalo si es necesario.

8. SYNC (sync_projects):
   - Sincronización proactiva. Úsala para indexar los metadatos de los proyectos de GitHub en el Omni-Brain. Hazlo si Pablo te lo pide o si notas que te falta contexto sobre sus proyectos remotos.`;

    let recentMessages = this.db.getRecentMessages(userId, maxContextMessages);
    
    // STRATEGIC MEMORY: Bootstrapping high-level strategy context
    let strategyContext = "";
    if (this.firestore.initialized) {
      try {
        console.log(`[Agent] Bootstrapping strategic context for ${userId}...`);
        const strategyResults = await this.firestore.semanticSearch(userId, 'estrategia', 'vision y objetivos generales', 3);
        if (strategyResults.length > 0) {
          strategyContext = strategyResults.map((r: any) => `- ${r.content || JSON.stringify(r)}`).join('\n');
          console.log(`[Agent] Strategic context loaded: ${strategyResults.length} point(s)`);
        }
      } catch (e) {
        console.warn('[Agent] Could not load strategy context:', e);
      }
    }

    const systemPromptFinal = strategyContext 
      ? `${systemBasePrompt}\n\nCONTEXTO ESTRATÉGICO ACTUAL:\n${strategyContext}`
      : systemBasePrompt;
      
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

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPromptFinal },
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

    // Trace initialization for observability
    const traceId = `trace_${Date.now()}`;
    this.emitEvent(userId, 'thought', `Iniciando procesamiento: "${userMessage}"`, traceId);

    const midContext: MiddlewareContext = {
      userId,
      traceId,
      iteration: 0,
      maxIterations,
      messages
    };

    let lastToolHash = '';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      midContext.iteration = iteration;
      console.log(`[Agent] Iteration ${iteration + 1}/${maxIterations}`);

      try {
        // En la última iteración, forzamos una respuesta sin herramientas para evitar el timeout
        const isLastIteration = iteration === maxIterations - 1;

        // MIDDLEWARE: preExecute
        for (const mid of this.middlewares) {
          if (mid.preExecute) await mid.preExecute(midContext);
        }

        const response = isLastIteration 
          ? await this.orchestrator.generateFinalResponse(messages)
          : await this.orchestrator.generate(messages);

        // MIDDLEWARE: postGenerate
        for (const mid of this.middlewares) {
          if (mid.postGenerate) await mid.postGenerate(midContext, response);
        }
        
        console.log(`[Agent] finish_reason: ${response.finishReason}`);
        console.log(`[Agent] content: "${response.content ?? 'null'}"`);
        console.log(`[Agent] toolCalls: ${response.toolCalls?.length ?? 0}`);

        if (response.content) {
          this.emitEvent(userId, 'thought', response.content, traceId);
        }

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

            // MIDDLEWARE: postToolExecute
            for (const mid of this.middlewares) {
              if (mid.postToolExecute) await mid.postToolExecute(midContext, toolCall.name, result);
            }

            this.emitEvent(userId, 'tool_result', { name: toolCall.name, result: result.substring(0, 500) }, traceId);

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
            console.log(`[Agent] Tool error detected: ${errorMessage}`);
            
            // SELF-CORRECTION FEEDBACK
            // Si nos quedan iteraciones, inyectamos el diagnóstico en lugar de rendirnos
            if (iteration < maxIterations - 1) {
              const diagnosticMsg = `DIAGNÓSTICO: La herramienta '${toolCalls[0].name}' falló con el error: "${errorMessage}". Pablo espera que resuelvas esto. Analiza por qué falló y probá una estrategia alternativa o usá otra herramienta. No repitas el mismo error.`;
              messages.push({ role: 'system', content: diagnosticMsg });
              this.emitEvent(userId, 'error', diagnosticMsg, traceId);
              console.log('[Agent] Continuing with diagnostic feedback...');
              continue;
            }

            console.log('[Agent] Stopping loop due to final tool error');
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
          this.emitEvent(userId, 'answer', content, traceId);
          this.db.addMessage(userId, 'assistant', content);
          this.firestore.addMessage(userId, 'assistant', content).catch(() => {});
          return content;
        }

      } catch (error) {
        const err = error as Error;
        console.error(`[Agent] LLM error:`, err.message);
        
        // MIDDLEWARE: onError
        for (const mid of this.middlewares) {
          if (mid.onError) await mid.onError(midContext, err);
        }

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
