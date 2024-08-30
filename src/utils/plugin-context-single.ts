import { Context, Env, PluginInputs } from "#root/types";
import { Octokit } from "@octokit/rest";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";

export class PluginContext {
    private static instance: PluginContext;

    private constructor(
        public readonly inputs: PluginInputs,
        public readonly env: Env,
    ) { }

    static initialize(inputs: PluginInputs, env: Env): Context {
        if (!PluginContext.instance) {
            PluginContext.instance = new PluginContext(inputs, env);
        }
        return PluginContext.instance.getContext();
    }

    static getInstance(): PluginContext {
        if (!PluginContext.instance) {
            throw new Error("PluginContext is not initialized. Call initialize() first.");
        }
        return PluginContext.instance;
    }

    getContext(): Context {
        const octokit = new Octokit({ auth: this.inputs.authToken });

        return {
            eventName: this.inputs.eventName,
            payload: this.inputs.eventPayload,
            config: this.inputs.settings,
            octokit,
            env: this.env,
            logger: new Logs("info"),
        };
    }
}