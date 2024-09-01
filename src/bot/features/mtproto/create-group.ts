import { MtProtoSingleton } from "#root/bot/auth/bot-auth.js"
import { Context } from "#root/types/context.js"
import { Api } from "telegram"

export async function createGroup(env: Context["env"]) {
    const client = (await MtProtoSingleton.initialize(env)).getClient()

    const me = await client.getMe()

    console.log("got me details: ", me)
    const newChat = await client.invoke(new Api.messages.CreateChat({
        title: "Test Chat",
        users: [me.id]
    }))

    console.log("newChat", newChat)
    return newChat
}