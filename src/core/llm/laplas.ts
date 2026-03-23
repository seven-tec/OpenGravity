import type { LLMMessage, LLMResponse, ToolCall, ProviderError } from '../../types/index.js';
import type { LLMProvider, ToolDefinition } from './provider.js';

export class LaplasProvider implements LLMProvider {
  name = 'laplas' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'meta-llama/Llama-Vision-Free') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(msg => {
        const base: any = {
          role: msg.role,
          content: msg.content,
        };
        
        // Handle tool calls for assistant role
        if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
          base.tool_calls = msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }));
        }
        
        // Handle tool result role
        if (msg.role === 'tool') {
          base.tool_call_id = msg.toolCallId;
        }
        
        return base;
      }),
      temperature: 0.7,
      max_tokens: 4096,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    const response = await fetch('https://api.apilaplas.com/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Laplas] Error response: ${errorBody}`);
      throw {
        code: response.status.toString(),
        message: errorBody,
        provider: 'laplas' as any, // We should add 'laplas' to ProviderError type if possible
      } as ProviderError;
    }

    const data = await response.json() as any;
    const choice = data.choices[0];

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: choice.message.content ?? '',
      toolCalls,
      finishReason: choice.finish_reason as LLMResponse['finishReason'],
    };
  }

  isRateLimited(error: ProviderError): boolean {
    return error.code === '429' ||
           error.message.toLowerCase().includes('rate limit') ||
           error.message.toLowerCase().includes('quota exceeded');
  }

  isToolUseFailed(error: ProviderError): boolean {
    return error.code === '400';
  }
}
