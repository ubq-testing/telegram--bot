import { Api } from "telegram";
import { Context } from "../../types";
import bigInt from "big-integer";
import dotenv from "dotenv";
import { addCommentToIssue } from "../../utils/add-comment-to-issues";
import { MtProtoWrapper } from "./scripts/sms-auth/mtproto-wrapper";
dotenv.config();

/**
 * Helper class for handling MTProto API calls
 *
 * This class extends the MtProtoWrapper class and provides additional
 * helper methods for interacting with the Telegram API.
 *
 * Lower level interactions can still be done if need be.
 *
 * further refactoring could possibly be done here but I can't think of any
 * more efficient way to do this at the moment. A couple more methods and
 * break out into smaller classes?
 */
export class MtProtoHelper extends MtProtoWrapper {
  constructor(context: Context) {
    super(context);
  }

  async getChatCreatorFromParticipants(participants: Api.TypeChatParticipant[]) {
    let creator: Api.ChatParticipantCreator | undefined;
    participants.forEach((participant) => {
      if (participant.className === "ChatParticipantCreator") {
        creator = participant;
      }
    });

    if (!creator) {
      throw new Error("Failed to get chat creator");
    }

    return creator;
  }

  async getTelegramChat(dbChat: { chat_id: number }): Promise<Api.messages.ChatFull> {
    const api = this.getMtProtoApi();

    const fetchedChat = await this.getMtProtoClient().invoke(
      new api.messages.GetFullChat({
        chatId: bigInt(dbChat.chat_id),
      })
    );

    if (!fetchedChat || !("fullChat" in fetchedChat)) {
      throw new Error("Failed to fetch chat");
    }

    return fetchedChat;
  }

  async getChatParticipants(dbChat: { chat_id: number }, tgChat?: Api.messages.ChatFull) {
    const fetchedChat = tgChat ?? (await this.getTelegramChat(dbChat));

    if ("participants" in fetchedChat.fullChat) {
      return fetchedChat.fullChat.participants;
    } else {
      throw new Error("Failed to fetch chat participants");
    }
  }

  async createChat(chatName: string) {
    const api = this.getMtProtoApi();
    if (!this.getBotIdString()) {
      throw new Error("Bot ID is not available when creating chat");
    }

    return await this.getMtProtoClient().invoke(
      new api.messages.CreateChat({
        title: chatName,
        users: [this.getBotIdString()],
      })
    );
  }

  async createChatInviteLink(chat: Api.messages.InvitedUsers) {
    let inviteLink, chatId, chatIdBigInt;

    if ("chats" in chat.updates) {
      chatId = chat.updates.chats[0].id.toJSNumber();
      chatIdBigInt = chat.updates.chats[0].id;
    } else {
      throw new Error("Failed to create chat");
    }

    const mtProtoClient = this.getMtProtoClient();
    const mtProtoApi = this.getMtProtoApi();

    if (chat.updates.chats[0].className === "Chat") {
      inviteLink = await mtProtoClient.invoke(
        new mtProtoApi.messages.ExportChatInvite({
          peer: new mtProtoApi.InputPeerChat({ chatId: chatIdBigInt }),
        })
      );
    }

    return {
      inviteLink,
      chatId,
      chatIdBigInt,
    };
  }

  async updateChatArchiveStatus({ dbChat, archive }: { dbChat: { chat_id: number }; archive: boolean }) {
    const api = this.getMtProtoApi();
    await this.getMtProtoClient().invoke(
      new api.folders.EditPeerFolders({
        folderPeers: [
          new api.InputFolderPeer({
            peer: new api.InputPeerChat({ chatId: bigInt(dbChat.chat_id) }),
            folderId: archive ? 1 : 0, // 0 is active, 1 is archived
          }),
        ],
      })
    );
  }

  async sendMessageToChat(dbChat: { chat_id: number }, message: string) {
    const api = this.getMtProtoApi();
    await this.getMtProtoClient().invoke(
      new api.messages.SendMessage({
        message,
        peer: new api.InputPeerChat({ chatId: bigInt(dbChat.chat_id) }),
      })
    );
  }

  async editChatDescription(chatIdBigInt: bigInt.BigInteger, description: string) {
    const mtProtoClient = this.getMtProtoClient();
    const mtProtoApi = this.getMtProtoApi();

    try {
      await mtProtoClient.invoke(
        new mtProtoApi.messages.EditChatAbout({
          peer: new mtProtoApi.InputPeerChat({ chatId: chatIdBigInt }),
          about: description,
        })
      );
    } catch (er) {
      throw new Error(`Failed to edit chat description: \n ${String(er)}`);
    }
  }

  async postChatInviteLinkToIssue(
    payload: { issue: { html_url: string; number: number; node_id: string }; repository: { full_name: string } },
    chatIdBigInt: bigInt.BigInteger,
    inviteLink: Api.TypeExportedChatInvite | undefined,
    chatName: string
  ) {
    const mtProtoClient = this.getMtProtoClient();
    const mtProtoApi = this.getMtProtoApi();
    const logger = this._getContext().logger;

    if (inviteLink) {
      const [owner, repo] = payload.repository.full_name.split("/");
      if ("link" in inviteLink) {
        await addCommentToIssue(
          this._getContext(),
          logger.ok(`A new workroom has been created for this task. [Join chat](${inviteLink.link})`).logMessage.raw,
          owner,
          repo,
          payload.issue.number
        );
      } else {
        throw new Error(logger.error(`Failed to create chat invite link for the workroom: ${chatName}`).logMessage.raw);
      }

      await this.editChatDescription(chatIdBigInt, `${payload.issue.html_url}`);

      const isBotPromotedToAdmin = await mtProtoClient.invoke(
        new mtProtoApi.messages.EditChatAdmin({
          chatId: chatIdBigInt,
          isAdmin: true,
          userId: this.getBotIdString(),
        })
      );

      if (!isBotPromotedToAdmin) {
        throw new Error("Failed to promote bot to admin");
      }
    }
  }

  async addUserToChat(chatIdBigInt: bigInt.BigInteger | null, userId: number) {
    if (!chatIdBigInt) {
      throw new Error("Chat ID is not available");
    }
    const client = this.getMtProtoClient();
    const api = this.getMtProtoApi();
    await client.invoke(
      new api.messages.AddChatUser({
        chatId: chatIdBigInt,
        userId: userId,
        fwdLimit: 50,
      })
    );
  }
}
