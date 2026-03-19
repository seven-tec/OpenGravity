export interface Tool {
  name: string;
  description: string;
  execute(params: Record<string, unknown>): Promise<string>;
  getDefinition(): {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string; enum?: string[]; items?: { type: string } }>;
      required?: string[];
    };
  };
}

export interface ToolContext {
  userId: string;
  shellTimeoutMs: number;
}
