export interface Message {
  id: number;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls: string | null;
  createdAt: Date;
}

export interface LongTermMemory {
  id: number;
  userId: string;
  key: string;
  value: string;
  importance: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
  error?: string;
}

export interface AgentState {
  userId: string;
  messages: Message[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  iterations: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface LLMResponse {
  content: string | null;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface ProviderError {
  code: string;
  message: string;
  provider: 'groq' | 'openrouter';
}
