import { z } from 'zod';
import type { Tool, ToolDependencies } from '../base.js';

export default class SelfHealingTool implements Tool {
  name = 'self_healing';
  description = 'Analiza fallos pasados del agente (errores, loops, fallos de herramientas) y propone mejoras técnicas o de prompt.';

  schema = z.object({
    action: z.enum(['analyze_failures', 'propose_fix']).describe('Acción a realizar'),
    limit: z.number().optional().default(5).describe('Cantidad de fallos a analizar'),
  });

  constructor(private deps: ToolDependencies) {}

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          action: {
            type: 'string',
            enum: ['analyze_failures', 'propose_fix'],
            description: 'Acción a realizar.'
          },
          limit: {
            type: 'number',
            description: 'Cantidad de fallos recientes a analizar.'
          }
        },
        required: ['action']
      }
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { action, limit } = params as { action: string; limit: number };
    const { firestore } = this.deps;

    if (!firestore || !firestore.initialized) {
      return JSON.stringify({ error: 'Firestore no está disponible para análisis de trazas.', _toolError: true });
    }

    try {
      switch (action) {
        case 'analyze_failures':
          // Usamos una cuenta hardcoded para Pablo por ahora o pasamos el userId si lo tuviéramos en deps
          // Como ToolDependencies no suele tener userId, el agente debería proveerlo si fuera necesario,
          // pero aquí usaremos el del contexto si estuviera, o el de Pablo por defecto.
          const userId = '855084566'; 
          const failures = await (firestore as any).getErrorTraces(userId, limit);
          
          if (failures.length === 0) {
            return "No se encontraron fallos recientes en las trazas. El sistema está flama, fiera.";
          }

          return JSON.stringify({
            success: true,
            total_failures: failures.length,
            failures: failures.map((f: any) => ({
              id: f.id,
              content: f.content.substring(0, 200),
              date: f.createdAt
            })),
            analysis_suggestion: "Analizá estos errores y buscá patrones en el uso de herramientas o en la interpretación del prompt."
          });

        case 'propose_fix':
          return "Fiera, mandame el análisis de lo que encontraste y yo te ayudo a parchear el código con 'developer_tool'.";

        default:
          return JSON.stringify({ error: 'Acción no soportada' });
      }
    } catch (error: any) {
      return JSON.stringify({ error: error.message, _toolError: true });
    }
  }
}
