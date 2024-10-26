import { Logs } from "@ubiquity-dao/ubiquibot-logger";

export const logger = new Logs("debug");

export type Logger = typeof logger;
