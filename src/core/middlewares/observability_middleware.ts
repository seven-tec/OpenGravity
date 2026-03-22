import type { LLMResponse } from '../../types/index.js';
import type { ObservabilityService } from '../../services/observability.js';
import type { AgentMiddleware, MiddlewareContext } from '../middleware.js';

export class ObservabilityMiddleware implements AgentMiddleware {
  name = 'observability';

  constructor(private obs: ObservabilityService) {}

  async postGenerate(context: MiddlewareContext, response: LLMResponse): Promise<void> {
    if (response.content) {
      this.obs.emit(context.userId, 'thought', response.content, context.traceId);
    }
    
    if (response.toolCalls && response.toolCalls.length > 0) {
      this.obs.emit(context.userId, 'tool_call', { 
        calls: response.toolCalls.map(tc => ({ name: tc.name, args: tc.arguments }))
      }, context.traceId);
    }
  }

  async postToolExecute(context: MiddlewareContext, toolName: string, result: string): Promise<void> {
    this.obs.emit(context.userId, 'tool_result', { 
      name: toolName, 
      result: result.substring(0, 500) 
    }, context.traceId);
  }

  async onError(context: MiddlewareContext, error: Error): Promise<void> {
    this.obs.emit(context.userId, 'error', error.message, context.traceId);
  }
}
