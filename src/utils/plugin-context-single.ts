import { Context, Env, envValidator, PluginInputs } from "#root/types";
import { Octokit } from "@octokit/rest";
import { Value } from "@sinclair/typebox/value";
import { Logs } from "@ubiquity-dao/ubiquibot-logger";
import { createAdapters } from "../adapters";
import { createClient } from "@supabase/supabase-js";

export class PluginContext {
    private static instance: PluginContext;

    private constructor(
        public readonly inputs: PluginInputs,
        public _env: Env,
    ) { }

    get env() {
        return Value.Decode(envValidator.schema, Value.Default(envValidator.schema, this._env));
    }
    set env(env: Env) {
        this._env = env;
    }

    static initialize(inputs: PluginInputs, env: Env): Context {
        if (!PluginContext.instance) {
            PluginContext.instance = new PluginContext(inputs, env);
        }
        return PluginContext.instance.getContext();
    }

    static getInstance(): PluginContext {
        if (!PluginContext.instance) {
            throw new Error("PluginContext not initialized");
        }
        return PluginContext.instance;
    }

    getInputs(): PluginInputs {
        return this.inputs;
    }

    getContext(): Context {
        const octokit = new Octokit({ auth: this.inputs.authToken });
        const ctx: Context = {
            eventName: this.inputs.eventName,
            payload: this.inputs.eventPayload,
            config: this.inputs.settings,
            octokit,
            env: this.env,
            logger: new Logs("verbose"),
            adapters: {} as ReturnType<typeof createAdapters>,
        };

        ctx.adapters = createAdapters(createClient(ctx.env.SUPABASE_URL, ctx.env.SUPABASE_SERVICE_KEY), ctx);

        return ctx;
    }
}