/**
 * Opciones para la lógica de reintento.
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  shouldRetry: () => true,
};

/**
 * Ejecuta una función con lógica de reintento y backoff exponencial.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (attempt < opts.maxAttempts && opts.shouldRetry!(error)) {
        console.warn(`[Retry] Attempt ${attempt} failed: ${error.message}. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= opts.backoffFactor;
        continue;
      }
      break;
    }
  }

  throw lastError;
}
