import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import ms, { StringValue } from "ms";
import { StandardValidator } from "typebox-validators";
import { logger } from "../utils/logger";

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: PluginSettings;
  ref: string;
  command: string;
  signature: string;
  authToken: string;
}

const rfcFollowUpPriorityScale = T.Record(
  T.Number(),
  T.Transform(T.Union([T.String(), T.Number()]))
    .Decode((v) => {
      try {
        return ms(v as StringValue);
      } catch (er) {
        throw logger.error(`Invalid duration format`, { er: String(er) });
      }
    })
    .Encode((v) => ms(v, { long: true })),
  {
    description: "The duration before follow-up notifications are sent for RFC comments based on priority.",
    default: { 0: "2 minute", 1: "1 Week", 2: "5 Days", 3: "3 Days", 4: "1 Day", 5: "12 Hours" },
  }
);

export const pluginSettingsSchema = T.Object({
  /**
   * The bot ID, NOT the ID of the personal account.
   */
  botId: T.Transform(T.Unknown({ default: 7543249164, description: "The ID given to you when creating a Telegram Bot via @TheBotFather." }))
    .Decode((value) => Number(value))
    .Encode((value) => value.toString()),
  storageOwner: T.String({
    default: "ubq-testing",
    description:
      "Determines the correct UbiquityOS install-authenticated Octokit instance to use and the storage location for this plugin (Required: GitHub Storage layer).",
  }),
  fuzzySearchThreshold: T.Number({ default: 0.2, description: "The threshold for fuzzy search when invoking the `/newtask` command (0 is a perfect match)." }),
  aiConfig: T.Object(
    {
      model: T.String({ default: "openai/o1-mini", description: "The model to use.", examples: ["openai/o1-mini", "openai/gpt-4o"] }),
      baseUrl: T.String({
        default: "https://openrouter.ai/api/v1",
        description: "The base URL of the API.",
        examples: ["https://openrouter.ai/api/v1", "https://openrouter.ai/api/v2"],
      }),
      similarityThreshold: T.Number({ default: 0.9, description: "The similarity threshold for when fetching embeddings-based context." }),
    },
    { default: { model: "o1-mini", baseUrl: "https://api.openai.com/v1" } }
  ),
  privateNotifications: T.Object(
    {
      rfcFollowUpPriorityScale,
    },
    { default: {} }
  ),
});

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
