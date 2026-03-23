import type { Config } from '../../config.js';
import type { LLMMessage, LLMResponse, ProviderError } from '../../types/index.js';
import type { LLMProvider } from './provider.js';
import { GroqProvider } from './groq.js';
import { OpenRouterProvider } from './openrouter.js';

interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export class LLMOrchestrator {
  private providers: LLMProvider[];
  private currentProviderIndex: number;
  private tools: ToolDef[];

  constructor(config: Config) {
    this.providers = [];
    this.currentProviderIndex = 0;
    this.tools = [];

    if (config.llm.groqApiKey) {
      this.providers.push(new GroqProvider(config.llm.groqApiKey, config.llm.groqModel));
    }

    if (config.llm.openrouterApiKey) {
      this.providers.push(new OpenRouterProvider(config.llm.openrouterApiKey, config.llm.openrouterModel));
    }

    if (this.providers.length === 0) {
      throw new Error('No LLM providers configured. Provide at least GROQ_API_KEY.');
    }
  }

  registerTools(tools: ToolDef[]): void {
    this.tools = tools;
  }

  async generate(messages: LLMMessage[], forceNoTools = false): Promise<LLMResponse> {
    let lastError: ProviderError | null = null;
    
    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[this.currentProviderIndex];
      const useTools = this.tools.length > 0 && !forceNoTools;
      
      try {
        const response = await provider.generate(messages, useTools ? this.tools : undefined);
        return response;
      } catch (error) {
        lastError = error as ProviderError;
        
        if (provider.isRateLimited(lastError) || provider.isToolUseFailed(lastError)) {
          const reason = provider.isRateLimited(lastError) ? 'Rate limited' : 'Tool use failed';
          console.log(`[LLM] ${reason}, trying next provider...`);
          this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
          
          if (this.currentProviderIndex === 0 && i === this.providers.length - 1) {
            throw new Error(`All LLM providers failed (including ${reason}).`);
          }
          continue;
        }
        
        throw error;
      }
    }

    throw lastError ?? new Error('No LLM providers available');
  }

  async generateWithTools(messages: LLMMessage[]): Promise<LLMResponse> {
    const toolResponse = await this.generate(messages, false);
    
    if (toolResponse.toolCalls && toolResponse.toolCalls.length > 0) {
      return toolResponse;
    }
    
    return toolResponse;
  }

  async generateFinalResponse(messages: LLMMessage[]): Promise<LLMResponse> {
    console.log('[LLM] Generating final response (no tools)...');
    return this.generate(messages, true);
  }

  get currentProvider(): string {
    return this.providers[this.currentProviderIndex]?.name ?? 'none';
  }
}
