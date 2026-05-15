import pino from "pino";
import { env } from "@/lib/env";

export const logger = pino({
  level: "info",
  transport: {
    target: "pino-pretty",
    options: {
      colorize: env.NODE_ENV !== "production",
      translateTime: "yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
      sync: true,
    },
  },
});

export type Logger = typeof logger;
