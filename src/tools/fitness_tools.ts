import type { Tool } from './base.js';
import type { FirestoreService } from '../services/database/firestore.js';

let firestore: FirestoreService;

export function setFirestore(service: FirestoreService) {
  firestore = service;
}

export class RegistrarEntrenamientoTool implements Tool {
  name = 'registrar_entrenamiento';
  description = 'Guarda una serie de ejercicio en la base de datos de fitness de Pablo.';

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          ejercicio: { type: 'string', description: 'Nombre del ejercicio (ej: Press de banca)' },
          series: { type: 'number', description: 'Cantidad de series realizadas' },
          repeticiones: { type: 'number', description: 'Repeticiones por serie' },
          peso: { type: 'number', description: 'Peso en kilogramos' }
        },
        required: ['ejercicio', 'series', 'repeticiones', 'peso'],
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    if (!firestore || !firestore.initialized) {
      return JSON.stringify({ error: 'Firestore no está inicializado. No puedo guardar el entrenamiento.', _stopLoop: true });
    }

    const { ejercicio, series, repeticiones, peso } = params as any;
    
    // Usamos el ID de Pablo como pidió el usuario por defecto
    const targetUserId = '855084566';

    try {
      await firestore.addWorkout(targetUserId, {
        ejercicio,
        series,
        repeticiones,
        peso
      });

      return `Listo Pablo, anoté ${series}x${repeticiones} de ${ejercicio} con ${peso}kg. ¡Dale que vos podés! 💪`;
    } catch (error: any) {
      return JSON.stringify({ error: `Fallo al guardar: ${error.message}`, _stopLoop: true });
    }
  }
}
