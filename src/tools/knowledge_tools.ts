import type { Tool } from './base.js';
import type { FirestoreService } from '../services/database/firestore.js';

let firestore: FirestoreService;

export function setFirestore(service: FirestoreService) {
  firestore = service;
}

export class ManagePersonalKnowledgeTool implements Tool {
  name = 'manage_personal_knowledge';
  description = `Base de conocimiento personal de Pablo (almacenado en Firestore).

USA ESTA HERRAMIENTA PARA:
- Guardar información que quieres RECORDAR después (recuerdos, deudas, preferencias)
- Clasificar notas y aprendizajes por categoría (fitness, finanzas, novela, logística, etc.)
- Consultar información guardada anteriormente
- Actualizar entradas existentes

EJEMPLOS DE USO:
- "guarda que Roberto me debe $50 de la cena" → action: store, category: deudas
- "recuerda que mi hipertrofia es de 3x10" → action: store, category: fitness  
- "qué ejercicios hice la semana pasada?" → action: query, category: fitness
- "actualiza mi peso en hipertrofia a 90kg" → action: update, category: fitness

NO USES ESTA HERRAMIENTA PARA:
- Crear eventos de calendario o reuniones
- Gestionar emails de Gmail
- Buscar archivos en Google Drive
- Cualquier cosa relacionada con Google Workspace
- Para eso, usa 'google_workspace'`;

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
        const queryText = data?.content || data?.query || category; // Priorizamos contenido del query si existe
        const results = await (firestore as any).semanticSearch(targetUserId, category, queryText, 5);
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
