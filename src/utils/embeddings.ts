export async function getEmbedding(text: string, hfToken: string): Promise<number[]> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
      {
        headers: { Authorization: `Bearer ${hfToken}` },
        method: "POST",
        body: JSON.stringify({ inputs: text }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HF Embedding Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    
    // El modelo MiniLM devuelve un array simple de números (384 dimensiones)
    if (Array.isArray(result) && typeof result[0] === 'number') {
      return result;
    }
    
    // A veces devuelve un array de arrays si enviamos múltiples inputs
    if (Array.isArray(result) && Array.isArray(result[0])) {
      return result[0];
    }

    throw new Error("Formato de embedding inesperado");
  } catch (error) {
    console.error("[Embeddings] Failed to get embedding:", error);
    throw error;
  }
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
