/**
 * Run async tasks with a max in-flight limit (pool). Preserves submission order for logging;
 * results align with `items` order.
 */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;

  async function slot() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        const value = await worker(items[i]!, i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => slot()));
  return results;
}
