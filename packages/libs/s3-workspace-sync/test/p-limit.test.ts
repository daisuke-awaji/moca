import { describe, it, expect } from 'vitest';
import { pLimit } from '../src/utils/p-limit.js';

describe('pLimit', () => {
  it('should limit concurrent executions', async () => {
    const limit = pLimit(2);
    let running = 0;
    let maxRunning = 0;

    const task = () =>
      limit(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
      });

    await Promise.all(Array.from({ length: 10 }, task));

    expect(maxRunning).toBe(2);
  });

  it('should return the result of the function', async () => {
    const limit = pLimit(3);
    const result = await limit(async () => 42);
    expect(result).toBe(42);
  });

  it('should propagate errors', async () => {
    const limit = pLimit(1);
    await expect(
      limit(async () => {
        throw new Error('test error');
      })
    ).rejects.toThrow('test error');
  });

  it('should execute all tasks even with concurrency of 1', async () => {
    const limit = pLimit(1);
    const results: number[] = [];

    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        limit(async () => {
          results.push(n);
        })
      )
    );

    expect(results).toHaveLength(5);
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('should throw on invalid concurrency', () => {
    expect(() => pLimit(0)).toThrow();
    expect(() => pLimit(-1)).toThrow();
  });

  it('should handle high concurrency correctly', async () => {
    const limit = pLimit(100);
    const results = await Promise.all(
      Array.from({ length: 200 }, (_, i) => limit(async () => i))
    );
    expect(results).toHaveLength(200);
  });
});
