import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEmbedding, cosineSimilarity } from './embeddings.js';

// Mock de fetch global
global.fetch = vi.fn();

describe('Embeddings Utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEmbedding', () => {
    it('should return an embedding array on success', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockEmbedding,
      });

      const result = await getEmbedding('hola', 'fake-token');
      expect(result).toEqual(mockEmbedding);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 503 error', async () => {
      const mockEmbedding = [0.5, 0.6];
      // Primero falla con 503, luego funciona
      (fetch as any)
        .mockResolvedValueOnce({ status: 503, ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockEmbedding,
        });

      const result = await getEmbedding('reintento', 'fake-token');
      expect(result).toEqual(mockEmbedding);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw fatar error after exhaustion of retries', async () => {
      (fetch as any).mockResolvedValue({ status: 503, ok: false });

      await expect(getEmbedding('falla', 'fake-token', 2))
        .rejects.toThrow(/Servicio de Embeddings no disponible/);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity correctly', () => {
      const a = [1, 0];
      const b = [1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1);

      const c = [0, 1];
      expect(cosineSimilarity(a, c)).toBe(0);
    });

    it('should return 0 for zero vectors', () => {
      expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    });
  });
});
