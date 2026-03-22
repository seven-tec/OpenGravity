import type { LLMMessage, LLMResponse } from '../types/index.js';

export interface MiddlewareContext {
  userId: string;
  traceId: string;
  iteration: number;
  maxIterations: number;
  messages: LLMMessage[];
}

export interface AgentMiddleware {
  name: string;
  
  /**
   * Se ejecuta antes de llamar al LLM.
   * Puede modificar los mensajes o el contexto.
   */
  preExecute?: (context: MiddlewareContext) => Promise<void>;

  /**
   * Se ejecuta después de recibir la respuesta del LLM, pero antes de procesar herramientas.
   */
  postGenerate?: (context: MiddlewareContext, response: LLMResponse) => Promise<void>;

  /**
   * Se ejecuta después de que una herramienta ha sido ejecutada.
   */
  postToolExecute?: (context: MiddlewareContext, toolName: string, result: string) => Promise<void>;

  /**
   * Se ejecuta cuando ocurre un error en el loop.
   */
  onError?: (context: MiddlewareContext, error: Error) => Promise<void>;
}
