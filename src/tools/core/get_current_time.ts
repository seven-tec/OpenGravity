import type { Tool, ToolDependencies } from '../base.js';

export default class GetCurrentTimeTool implements Tool {
  name = 'get_current_time';
  description = 'Get the current date and time in ISO format.';

  constructor(_deps: ToolDependencies) {
    // No dependencies needed for this tool
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          timezone: {
            type: 'string' as const,
            description: 'Optional IANA timezone like UTC, America/New_York, Europe/London',
          },
        },
        required: [] as string[],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const timezone = params.timezone as string | undefined;
    const now = new Date();
    
    if (timezone) {
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          dateStyle: 'full',
          timeStyle: 'long',
        });
        return formatter.format(now);
      } catch {
        return `Invalid timezone: ${timezone}. Using local time: ${now.toISOString()}`;
      }
    }
    
    return now.toISOString();
  }
}
