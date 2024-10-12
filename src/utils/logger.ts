import { Logs } from "@ubiquity-dao/ubiquibot-logger";

export const logger = new Logs("verbose");

export type Logger = typeof logger;
