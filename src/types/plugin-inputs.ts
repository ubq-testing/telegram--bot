import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: PluginSettings;
  authToken: string;
  ref: string;
}

export const pluginSettingsSchema = T.Object({
  /**
   * The bot ID, NOT the ID of the personal account.
   */
  botId: T.Transform(T.Unknown({ default: 7543249164, description: "The ID given to you when creating a Telegram Bot via @TheBotFather." }))
    .Decode((value) => Number(value))
    .Encode((value) => value.toString()),
  shouldUseGithubStorage: T.Boolean({ default: false, description: "Activates the GitHub storage module." }),
  storageOwner: T.String({ default: "ubiquity-os-marketplace", description: "Determines where the storage location of this plugin should be." }),
  fuzzySearchThreshold: T.Number({ default: 0.2, description: "The threshold for fuzzy search when invoking the `/newtask` command (0 is a perfect match)." }),
  aiConfig: T.Union(
    [
      T.Object({
        kind: T.Literal("OpenAi", { description: "The API provider you wish to use.", examples: ["OpenAi", "OpenRouter"] }),
        model: T.String({ default: "o1-mini", description: "The model to use.", examples: ["o1-mini", "gpt-4o"] }),
        baseUrl: T.String({
          default: "https://api.openai.com/v1",
          description: "The base URL of the API.",
          examples: ["https://api.openai.com/v1", "https://api.openai.com/v2"],
        }),
        similarityThreshold: T.Number({ default: 0.9, description: "The similarity threshold for when fetching embeddings-based context." }),
      }),
      T.Object({
        kind: T.Literal("OpenRouter", { description: "The API provider you wish to use.", examples: ["OpenAi", "OpenRouter"] }),
        model: T.String({ default: "openai/o1-mini", description: "The model to use.", examples: ["openai/o1-mini", "openai/gpt-4o"] }),
        baseUrl: T.String({
          default: "https://openrouter.ai/api/v1",
          description: "The base URL of the API.",
          examples: ["https://openrouter.ai/api/v1", "https://openrouter.ai/api/v2"],
        }),
        similarityThreshold: T.Number({ default: 0.9, description: "The similarity threshold for when fetching embeddings-based context." }),
      }),
    ],
    { default: { kind: "OpenAi", model: "o1-mini", baseUrl: "https://api.openai.com/v1" } }
  ),
});

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
