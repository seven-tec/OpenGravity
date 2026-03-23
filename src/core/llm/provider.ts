import type { LLMMessage, LLMResponse, ProviderError } from '../../types/index.js';

export interface LLMProvider {
  name: string;
  
  generate(
    messages: LLMMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse>;
  
  isRateLimited(error: ProviderError): boolean;
  isToolUseFailed(error: ProviderError): boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParamDefinition>;
    required?: string[];
  };
}

export interface ToolParamDefinition {
  type: string;
  description: string;
  enum?: string[];
  items?: {
    type: string;
  };
}
