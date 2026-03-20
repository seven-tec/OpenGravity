import type { Tool } from './base.js';
import type { FirestoreService } from '../services/database/firestore.js';

let firestore: FirestoreService;

export function setFirestore(service: FirestoreService) {
  firestore = service;
}

export class ManagePersonalKnowledgeTool implements Tool {
  name = 'manage_personal_knowledge';
  description = 'Guarda, clasifica o actualiza información en el cerebro de largo plazo de Pablo.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          category: { 
            type: 'string', 
            description: "Categoría de la info (ej: 'fitness', 'logistica_roberto', 'novela_lore', 'finanzas'). Si no existe una adecuada, crea una nueva." 
          },
          data: { 
            type: 'object', 
            description: "Objeto con los datos estructurados (ej: {ejercicio: 'Prensa', peso: 200} o {personaje: 'Erick', nota: 'Perdió un brazo'})." 
          },
          action: { 
            type: 'string', 
            description: "Acción a realizar",
            enum: ["store", "update", "query"] 
          }
        },
        required: ['category', 'data', 'action'],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    if (!firestore || !firestore.initialized) {
      return JSON.stringify({ error: 'Firestore no está inicializado. No puedo gestionar el conocimiento.', _stopLoop: true });
    }

    const { category, data, action } = params as any;
    const targetUserId = '855084566';

    try {
      await firestore.saveKnowledge(targetUserId, category, action, data);

      if (action === 'store') {
        return `Entendido, Pablo. Clasificado en '${category}' y guardado con éxito en el Omni-Brain.`;
      }
      
      return `Acción '${action}' ejecutada en '${category}'.`;
    } catch (error: any) {
      return JSON.stringify({ error: `Fallo al gestionar conocimiento: ${error.message}`, _stopLoop: true });
    }
  }
}
