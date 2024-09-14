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
  botId: T.Transform(T.Unknown())
    .Decode((value) => Number(value))
    .Encode((value) => value.toString()),
  /**
   * The target branch to run the workflows on. Will default to the `development` branch.
   */
  targetBranch: T.Optional(T.String({ default: "development" })),
});

export const pluginSettingsValidator = new StandardValidator(pluginSettingsSchema);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
