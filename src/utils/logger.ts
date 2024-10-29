import { Logs, LogReturn, Metadata, LogLevel } from "@ubiquity-dao/ubiquibot-logger";

function createLogReturn(method: (log: string, ...args: unknown[]) => void, ...args: Parameters<typeof method>): LogReturn {
  method(...args);
  return {
    logMessage: {
      diff: `\`\`\`diff\n! ${args[0]}\n\`\`\``,
      raw: args[0],
      level: method.name as LogLevel,
      type: method.name as LogLevel,
    },
  };
}

const consoleLogger = {
  info: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.info, log, metadata);
  },
  error: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.error, log, metadata);
  },
  ok: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.log, log, metadata);
  },
  debug: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.debug, log, metadata);
  },
  fatal: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.error, log, metadata);
  },
  verbose: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.debug, log, metadata);
  },
  warn: (log: string, metadata?: Metadata) => {
    return createLogReturn(console.warn, log, metadata);
  },
};

type ConsoleLogger = typeof consoleLogger;

/**
 * CF Workers have an env prop that is set to "browser" which I don't
 * expect to appear in actions. Simply we are removing all formatting from
 * our PrettyLogs and using the console instead.
 */
export const logger: Logs | ConsoleLogger = process.title === "browser" ? consoleLogger : new Logs("debug");

export type Logger = typeof logger;
