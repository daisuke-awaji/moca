type LimitFunction = <T>(fn: () => Promise<T>) => Promise<T>;

/**
 * Promise concurrency limiter.
 * Limits the number of concurrent async operations.
 */
export function pLimit(concurrency: number): LimitFunction {
  if (concurrency < 1) {
    throw new RangeError('Concurrency must be at least 1');
  }

  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (queue.length > 0 && active < concurrency) {
      active++;
      queue.shift()!();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn().then(resolve, reject).finally(() => {
          active--;
          next();
        });
      };
      queue.push(run);
      next();
    });
}
