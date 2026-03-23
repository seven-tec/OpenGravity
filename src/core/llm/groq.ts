import Groq from 'groq-sdk';
import type { LLMMessage, LLMResponse, ToolCall, ProviderError } from '../../types/index.js';
import type { LLMProvider } from './provider.js';

interface ToolDef {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

export class GroqProvider implements LLMProvider {
  name: string;
  private client: Groq;
  private model: string;

  constructor(apiKey: string, model: string, name: string = 'groq') {
    this.client = new Groq({ apiKey });
    this.model = model;
    this.name = name;
  }

  async generate(
    messages: LLMMessage[],
    tools?: ToolDef[]
  ): Promise<LLMResponse> {
    const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = messages.map(msg => {
      const content = msg.content;

      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId ?? '',
          content: typeof content === 'string' ? content : JSON.stringify(content),
        };
      }
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        return {
          role: 'assistant' as const,
          content: (typeof content === 'string' ? content : null) as string | null,
          tool_calls: msg.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }

      // Para el rol user/system, Groq soporta ChatCompletionContentPart[] si es necesario (vision)
      const groqContent: any = Array.isArray(content) 
        ? content.map(part => {
            if (part.type === 'image_url') {
              return {
                type: 'image_url',
                image_url: { url: part.image_url.url }
              };
            }
            return { type: 'text', text: part.text };
          })
        : content || '';

      return {
        role: msg.role as 'system' | 'user' | 'assistant',
        content: groqContent,
      };
    });

    const toolsPayload = tools && tools.length > 0 ? tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.parameters.properties,
          required: tool.parameters.required ?? [],
        },
      },
    })) : undefined;

    console.log(`[Groq] ${groqMessages.length} messages, tools: ${toolsPayload?.length ?? 0}`);
    groqMessages.forEach((m, i) => {
      const logContent = Array.isArray(m.content) 
        ? `[MULTI-MODAL: ${m.content.length} parts]` 
        : String(m.content).substring(0, 80);
      console.log(`[Groq] msg[${i}] role=${m.role} content="${logContent}..."`);
    });
    if (toolsPayload) {
      console.log(`[Groq] Tools:`, JSON.stringify(toolsPayload.map(t => t.function.name)));
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: groqMessages,
      tools: toolsPayload,
      tool_choice: toolsPayload ? 'auto' : undefined,
      temperature: 0.7,
      max_tokens: 4096,
    });

    const choice = completion.choices[0];
    console.log(`[Groq] finish_reason: ${choice.finish_reason}`);
    console.log(`[Groq] content: "${choice.message.content ?? 'null'}"`);
    console.log(`[Groq] tool_calls count: ${choice.message.tool_calls?.length ?? 0}`);

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: choice.message.content ?? null,
      toolCalls,
      finishReason: choice.finish_reason as LLMResponse['finishReason'],
    };
  }

  isRateLimited(error: ProviderError): boolean {
    return error.code === '429' || 
           error.message.includes('rate_limit') ||
           error.message.includes('quota exceeded');
  }

  isToolUseFailed(error: ProviderError): boolean {
    return error.code === '400' && error.message.includes('tool_use_failed');
  }
}
