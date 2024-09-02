import { Value } from "@sinclair/typebox/value";
import { plugin } from "../plugin";
import { pluginSettingsSchema, pluginSettingsValidator, PluginInputs, Env } from "../types";

export async function handleGithubWebhook(request: Request, env: Env): Promise<Response> {
    try {
        const webhookPayload = await request.json() as PluginInputs
        const settings = Value.Decode(pluginSettingsSchema, Value.Default(pluginSettingsSchema, webhookPayload.settings));

        if (!pluginSettingsValidator.test(settings)) {
            const errors: string[] = [];
            for (const error of pluginSettingsValidator.errors(settings)) {
                console.error(error);
                errors.push(`${error.path}: ${error.message}`);
            }
            return new Response(JSON.stringify({ error: `Error: "Invalid settings provided. ${errors.join("; ")}"` }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }

        webhookPayload.settings = settings;
        await plugin(webhookPayload, env);
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
        });
    } catch (error) {
        console.log("Error in handleGithubWebhook", error);
        throw new Error("Error in handleGithubWebhook");
    }
}