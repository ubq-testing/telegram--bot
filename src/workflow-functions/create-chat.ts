import { Context, SupportedEvents } from "#root/types/context";
import { CallbackResult } from "#root/types/proxy.js";
import { MtProtoSingleton } from "./bot/mtproto-single";

export async function createChat(context: Context<"issues.labeled", SupportedEvents["issues.labeled"]>): Promise<CallbackResult> {
    console.log("Creating chat");
    try {
        const { payload, env } = context;
        const chatName = payload.issue.title;

        const mtProto = await MtProtoSingleton.getInstance(env);
        const client = mtProto.getClient();
        const api = mtProto.getApi();
        console.log("Creating chat with name: ", chatName);
        const chat = await client.invoke(
            new api.channels.CreateChannel({
                title: chatName,
                broadcast: true,
                about: payload.issue.body || "No description provided",
            })
        );

        console.log("Chat created: ", chat);

        return { status: 200, reason: "chat_created" };
    } catch (er) {
        context.logger.error("Failed to create chat", { er });
        return { status: 500, reason: "chat_creation_failed", content: { error: er } };
    }

}
