import pRetry, { AbortError, type Options } from "p-retry";
import { logger } from "@/lib/logger";

export interface AIRetryOptions extends Options {
  context: string;
}

/**
 * Generic exponential-backoff retry for any AI provider call.
 * Default: 3 attempts (initial + 2 retries), 1s → 4s → 9s.
 * Throw `AbortError` from inside `fn` to stop retrying immediately.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { context, retries = 2, ...rest }: AIRetryOptions,
): Promise<T> {
  return pRetry(async (attempt) => {
    try {
      return await fn();
    } catch (err) {
      logger.warn(
        { err, context, attempt },
        `[ai] ${context} failed (attempt ${attempt}/${retries + 1})`,
      );
      throw err;
    }
  }, {
    retries,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 15000,
    randomize: true,
    ...rest,
  });
}

export { AbortError };
