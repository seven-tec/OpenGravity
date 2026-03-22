import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class PromptManager {
  private baseDir: string;
  private kernelPath: string;
  private skinsDir: string;

  constructor() {
    // Apuntamos a src/prompts/ desde src/core/prompts/
    this.baseDir = path.join(__dirname, '..', '..', 'prompts');
    this.kernelPath = path.join(this.baseDir, 'kernel.md');
    this.skinsDir = path.join(this.baseDir, 'skins');
  }

  /**
   * Construye el prompt del sistema final.
   */
  buildPrompt(userMessage: string, strategyContext: string = ''): string {
    let kernel = this.loadTemplate(this.kernelPath);
    
    // 1. Detectar Skin
    const skinContent = this.detectAndLoadSkin(userMessage);
    kernel = kernel.replace('{{SKIN_CONTENT}}', skinContent);

    // 2. Inyectar Contexto Estratégico
    const strategySection = strategyContext 
      ? `\n### CONTEXTO ESTRATÉGICO ACTUAL:\n${strategyContext}`
      : '';
    kernel = kernel.replace('{{STRATEGY_CONTEXT}}', strategySection);

    return kernel;
  }

  private loadTemplate(filePath: string): string {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
    } catch (e) {
      console.error(`[PromptManager] Error loading template ${filePath}:`, e);
    }
    return '';
  }

  private detectAndLoadSkin(message: string): string {
    const msg = message.toLowerCase();
    
    // Lógica simple de detección de keywords
    const coderKeywords = ['escribí', 'modificá', 'patch', 'error', 'bug', 'build', 'npm', 'código', 'repo', 'file', 'archivo'];
    const researchKeywords = ['buscá', 'investigá', 'quién es', 'qué es', 'google', 'search', 'calendario', 'reunión', 'email', 'gmail'];

    if (coderKeywords.some(k => msg.includes(k))) {
      console.log('[PromptManager] Activating CODER skin');
      return this.loadTemplate(path.join(this.skinsDir, 'coder.md'));
    }

    if (researchKeywords.some(k => msg.includes(k))) {
      console.log('[PromptManager] Activating RESEARCH skin');
      return this.loadTemplate(path.join(this.skinsDir, 'research.md'));
    }

    return ''; // No skin or default
  }
}
