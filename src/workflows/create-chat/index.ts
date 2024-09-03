import { Context } from "#root/types/context";
import { MtProtoSingleton } from "../bot";

export async function createChat(env: Context["env"], chatName: string) {
    const mtProto = await MtProtoSingleton.getInstance(env);
    const client = mtProto.getClient();
    const api = mtProto.getApi();
    console.log("Creating chat with name: ", chatName);
    const chat = await client.invoke(
        new api.channels.CreateChannel({
            title: chatName,
            broadcast: false,
        })
    );

    console.log("Chat created: ", chat);

    return chat;
}
