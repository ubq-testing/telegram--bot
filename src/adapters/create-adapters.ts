import { Context } from "../types";
import { SessionManagerFactory } from "../workflow-bot-mtproto-api/bot/session/session-manager";
import { Completions } from "./completions";
import { Embeddings } from "./embeddings";
import { VoyageAIClient } from "voyageai";

export function createAdapters(ctx: Context) {
  const sessionManager = SessionManagerFactory.createSessionManager(ctx);
  return {
    storage: sessionManager.getStorageHandler(),
    ai: new Completions(ctx),
    embeddings: new Embeddings(sessionManager.getClient(), new VoyageAIClient({ apiKey: ctx.env.VOYAGEAI_API_KEY })),
  };
}
