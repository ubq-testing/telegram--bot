import { Value } from "@sinclair/typebox/value";
import { Env, envValidator } from "../types";
import { logger } from "./logger";

export async function decodeEnvSettings(env: Env): Promise<Env> {
  try {
    return Value.Decode(envValidator.schema, Value.Default(envValidator.schema, env));
  } catch (err) {
    logger.error("Could not decode env", { err });
    throw new Error("Invalid env provided");
  }
}
