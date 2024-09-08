import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProto } from "./bot/mtproto";

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    try {
        const { payload, env } = context;
        const chatName = payload.issue.title;

        const mtProto = new MtProto(context);
        await mtProto.initialize();

        context.logger.info("Creating chat with name: ", { chatName });
        await mtProto.client.invoke(
            new mtProto.api.messages.CreateChat({
                title: chatName,
                users: [...env.BOT_ADMINS,],
            })
        );

        return { status: 200, reason: "chat_created" };
    } catch (er) {
        context.logger.error("Failed to create chat", { er });
        return { status: 500, reason: "chat_creation_failed", content: { error: er } };
    }
}
