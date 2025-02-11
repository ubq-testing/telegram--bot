import { EmitterWebhookEvent as WebhookEvent, EmitterWebhookEventName as WebhookEventName } from "@octokit/webhooks";
import { Context as _Context } from "@ubiquity-os/plugin-sdk";
import { PluginSettings } from "./plugin-inputs";
import { Env } from "./env";
import { createAdapters } from "../adapters";

export type SupportedEventsU = WebhookEventName;

export type SupportedEvents = {
  [K in SupportedEventsU]: K extends WebhookEventName ? WebhookEvent<K> : never;
};

interface ExtendedContext<T extends SupportedEventsU> extends _Context<PluginSettings, Env, null, T> {
  adapters: ReturnType<typeof createAdapters>;
}

export type Context<T extends SupportedEventsU = SupportedEventsU> = ExtendedContext<T>;
