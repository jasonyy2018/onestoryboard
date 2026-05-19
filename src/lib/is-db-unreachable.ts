import { PrismaClientInitializationError } from "@prisma/client/runtime/client";

/** True when Prisma cannot open a TCP connection to Postgres (dev: DB / Docker not running). */
export function isPrismaDbUnreachable(err: unknown): boolean {
  if (err instanceof PrismaClientInitializationError) return true;
  if (err instanceof Error && /Can't reach database server|P1001/i.test(err.message)) {
    return true;
  }
  return false;
}
