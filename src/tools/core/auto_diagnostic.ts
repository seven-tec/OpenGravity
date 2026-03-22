import { z } from 'zod';
import type { Tool, ToolDependencies } from '../base.js';
import { getEmbedding } from '../../utils/embeddings.js';

export default class AutoDiagnosticTool implements Tool {
  name = 'auto_diagnostic';
  description = 'Realiza un chequeo de salud integral del agente (Conectividad, APIs, Base de Datos, Variables de Entorno).';

  schema = z.object({
    full: z.boolean().optional().default(false).describe('Realizar un escaneo profundo (incluye reintentos de red)'),
  });

  private deps: ToolDependencies;

  constructor(deps: ToolDependencies) {
    this.deps = deps;
  }

  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object' as const,
        properties: {
          full: { type: 'boolean', description: 'Deep scan (includes network retries)' },
        },
      },
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    const { full } = params as { full: boolean };
    const health: any = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    // 1. Check Env Vars
    const requiredEnv = ['GROQ_API_KEY', 'HUGGINGFACE_TOKEN', 'TELEGRAM_BOT_TOKEN'];
    const missingEnv = requiredEnv.filter(e => !process.env[e]);
    health.checks.push({
      name: 'Variables de Entorno',
      status: missingEnv.length === 0 ? 'OK' : 'FAIL',
      message: missingEnv.length === 0 ? 'Todas las variables críticas están presentes.' : `Faltan variables: ${missingEnv.join(', ')}`
    });

    // 2. Check Database (SQLite)
    health.checks.push({
      name: 'SQLite Database',
      status: this.deps.db ? 'OK' : 'FAIL',
      message: this.deps.db ? 'Conectado a la base de datos local.' : 'Error: DatabaseManager no inyectado.'
    });

    // 3. Check Firestore
    health.checks.push({
      name: 'Firestore',
      status: this.deps.firestore?.initialized ? 'OK' : 'WARN',
      message: this.deps.firestore?.initialized ? 'Conectado a Firebase Cloud Firestore.' : '⚠️ Firestore no inicializado o en modo offline.'
    });

    // 4. Check GitHub Auth
    const ghToken = process.env.GITHUB_TOKEN;
    const ghUser = process.env.GITHUB_USERNAME;
    if (ghToken) {
      health.checks.push({ 
        name: 'GitHub API', 
        status: (ghUser && ghUser !== '$GITHUB_USERNAME') ? 'OK' : 'WARN', 
        message: (ghUser && ghUser !== '$GITHUB_USERNAME') ? `Autenticado como ${ghUser}.` : '⚠️ GITHUB_TOKEN presente pero GITHUB_USERNAME falta o es placeholder.'
      });
    } else {
      health.checks.push({ name: 'GitHub API', status: 'FAIL', message: 'Falta GITHUB_TOKEN. Las herramientas de GitHub no funcionarán.' });
    }

    // 5. Check HF Connectivity (if full)
    if (full && process.env.HUGGINGFACE_TOKEN) {
      try {
        await getEmbedding('test', process.env.HUGGINGFACE_TOKEN, 1);
        health.checks.push({ name: 'Hugging Face API', status: 'OK', message: 'Conectividad verificada y latencia aceptable.' });
      } catch (e: any) {
        const isIndexError = e.message.includes('FAILED_PRECONDITION') || e.message.includes('index');
        health.checks.push({ 
          name: 'Hugging Face / Firestore Index', 
          status: 'FAIL', 
          message: isIndexError ? '❌ FALTA ÍNDICE VECTORIAL EN FIRESTORE. Corre el comando gcloud provisto.' : `No se pudo conectar: ${e.message}` 
        });
      }
    }

    const allOk = health.checks.every((c: any) => c.status !== 'FAIL');
    
    return JSON.stringify({
      success: allOk,
      summary: allOk ? "SISTEMAS OPERATIVOS. Jarvis está al 100%." : "ADVERTENCIA: Algunos sistemas reportan fallos cruciales.",
      health,
      remediation: !allOk ? "Revisa los mensajes de FALLO arriba para las instrucciones de corrección." : undefined,
      _stopLoop: true // Detener el loop después del diagnóstico
    });
  }
}
