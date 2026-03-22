export async function getEmbedding(text: string, hfToken: string, retries = 3): Promise<number[]> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(
        "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction",
        {
          headers: { 
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          body: JSON.stringify({ inputs: text }),
        }
      );

      if (response.status === 503) {
        console.warn(`[Embeddings] HF Model loading (503), retrying in 2s... (${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HF Embedding Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (Array.isArray(result) && typeof result[0] === 'number') return result;
      if (Array.isArray(result) && Array.isArray(result[0])) return result[0];

      throw new Error("Formato de embedding inesperado del proveedor");
    } catch (error) {
      if (i === retries - 1) {
        console.error(`[Embeddings] FATAL: Failed to get embedding after ${retries} attempts. HF might be down.`);
        throw new Error(`Servicio de Embeddings no disponible (HF 503/Error). Pablo, verifica la conexión o el estado de Hugging Face. El sistema de memoria semántica está degradado.`);
      }
      console.warn(`[Embeddings] Attempt ${i + 1} failed, retrying in 1s...`, (error as Error).message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error("Failed to get embedding after retries");
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    mA += a[i] * a[i];
    mB += b[i] * b[i];
  }
  mA = Math.sqrt(mA);
  mB = Math.sqrt(mB);
  if (mA === 0 || mB === 0) return 0;
  return dotProduct / (mA * mB);
}
