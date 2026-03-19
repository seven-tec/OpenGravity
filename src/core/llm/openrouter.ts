import type { LLMMessage, LLMResponse, ToolCall, ProviderError } from '../../types/index.js';
import type { LLMProvider, ToolDefinition } from './provider.js';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter' as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async generate(messages: LLMMessage[], tools?: ToolDefinition[]): Promise<LLMResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://opengravity.dev',
      'X-Title': 'OpenGravity',
    };

    const requestBody: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(msg => {
        const base: any = {
          role: msg.role,
          content: msg.content,
        };
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw {
        code: response.status.toString(),
        message: errorBody,
        provider: 'openrouter' as const,
      } as ProviderError;
    }

    const data = await response.json() as { choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason: string }> };
    const choice = data.choices[0];

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map(tc => ({
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
           error.message.includes('rate_limit') ||
           error.message.includes('quota exceeded') ||
           error.message.includes('limit exceeded');
  }
}
