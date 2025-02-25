import { PluginEnvContext } from "../types/plugin-env-context";
import { BotFatherInitializer } from "../types/botfather-initializer";
import { logger } from "../utils/logger";

export async function initializeBotFatherInstance(pluginEnvCtx: PluginEnvContext) {
    try {
        const botFatherInitializer = new BotFatherInitializer(pluginEnvCtx);
        return await botFatherInitializer.initialize();
    } catch (er) {
        const errorInfo = {
            message: "initializeBotInstance Error",
            error: er instanceof Error ? er.message : String(er),
            stack: er instanceof Error ? er.stack : undefined,
        };
        logger.error(errorInfo.message, { error: er as Error });
        return null;
    }
}
