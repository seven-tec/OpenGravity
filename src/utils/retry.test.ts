import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry.js';

describe('withRetry', () => {
  it('should return result if first attempt succeeds', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { initialDelayMs: 10 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw after max attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    await expect(withRetry(fn, { maxAttempts: 2, initialDelayMs: 10 }))
      .rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry if shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('critical'));
    const shouldRetry = (err: any) => err.message !== 'critical';
    
    await expect(withRetry(fn, { shouldRetry, initialDelayMs: 10 }))
      .rejects.toThrow('critical');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
