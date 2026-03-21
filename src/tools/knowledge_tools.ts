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
            description: "Objeto con los datos estructurados (ej: {ejercicio: 'Prensa', peso: 200}). Obligatorio para 'store' y 'update'." 
          },
          action: { 
            type: 'string', 
            description: "Acción a realizar",
            enum: ["store", "update", "query"] 
          }
        },
        required: ['category', 'action'], // data es opcional para query
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
      if (action === 'query') {
        const results = await (firestore as any).queryKnowledge(targetUserId, category, 5);
        if (results.length === 0) {
          return `No encontré nada guardado recientemente en la categoría '${category}'.`;
        }
        
        const context = results.map((item: any) => {
          const { id, createdAt, metadata, ...rest } = item;
          // Si tiene un campo 'content', lo priorizamos, sino stringificamos el objeto
          return rest.content || JSON.stringify(rest);
        }).join("\n");
        
        return `Esto es lo que recordamos de '${category}':\n${context}`;
      }

      if ((action === 'store' || action === 'update') && !data) {
        return `Para la acción '${action}' necesito el objeto 'data' con la información.`;
      }

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
