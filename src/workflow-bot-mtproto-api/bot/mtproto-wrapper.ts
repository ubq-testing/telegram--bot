import { Api } from "telegram";
import { BaseMtProto } from "./scripts/sms-auth/base-mtproto";
import { Context } from "../../types";
import { SessionManager, SessionManagerFactory } from "./session/session-manager";
import bigInt from "big-integer";
import dotenv from "dotenv";
import { addCommentToIssue } from "../../utils/add-comment-to-issues";
import { CommentHandler } from "@ubiquity-os/plugin-sdk";
dotenv.config();

/**
 * This class MUST ONLY be used in the context of workflows as
 * it requires a Node.js environment which is not available with Cloudflare Workers.
 *
 * An extension of the BaseMtProto class that integrates with the GitHub
 * storage based session management.
 */
export class MtProtoWrapper extends BaseMtProto {
  private _context: Context;
  private _sessionManager: SessionManager;
  private _botIdString: string | null = null;

  constructor(context: Context) {
    super();
    this._context = context;
    this._sessionManager = SessionManagerFactory.createSessionManager(context);
  }

  async initialize() {
    const session = await this._sessionManager.getSession();
    const initialized = await super.initialize(this._context.env.TELEGRAM_BOT_ENV.mtProtoSettings, session);
    await initialized.client.getDialogs();
    this._botIdString = await initialized.client.getPeerId(this._context.config.botId, true);
    return initialized;
  }

  async fetchTelegramChat(
    dbChat: { chat_id: number }
  ): Promise<Api.messages.ChatFull> {
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

  async updateChatArchiveStatus({ dbChat, archive }: { dbChat: { chat_id: number }, archive: boolean }) {
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

  async getChatParticipants(dbChat: { chat_id: number }, tgChat?: Api.messages.ChatFull) {
    const fetchedChat = tgChat ?? await this.fetchTelegramChat(dbChat);

    if ("participants" in fetchedChat.fullChat) {
      return fetchedChat.fullChat.participants;
    } else {
      throw new Error("Failed to fetch chat participants");
    }
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

  async getChatCreatorFromParticipants(
    participants: Api.TypeChatParticipant[]
  ) {
    let creator: Api.ChatParticipantCreator | undefined;
    participants.forEach((participant) => {
      if (participant.className === "ChatParticipantCreator") {
        creator = participant
      }
    })

    if (!creator) {
      throw new Error("Failed to get chat creator");
    }

    return creator
  }

  async createChat(
    chatName: string,
  ) {
    const api = this.getMtProtoApi();
    if (!this._botIdString) {
      throw new Error("Bot ID is not available when creating chat");
    }

    return await this.getMtProtoClient().invoke(
      new api.messages.CreateChat({
        title: chatName,
        users: [this._botIdString],
      })
    );
  }

  async createChatInviteLink(
    chat: Api.messages.InvitedUsers,
  ) {
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
      chatIdBigInt
    }
  }

  async editChatDescription(
    chatIdBigInt: bigInt.BigInteger,
    description: string
  ) {
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
      throw new Error("Failed to edit chat description");
    }
  }

  async postChatInviteLinkToIssue(
    payload: { issue: { html_url: string, number: number, node_id: string }, repository: { full_name: string } },
    chatIdBigInt: bigInt.BigInteger,
    inviteLink: Api.TypeExportedChatInvite | undefined,
    chatName: string
  ) {
    const mtProtoClient = this.getMtProtoClient();
    const mtProtoApi = this.getMtProtoApi();
    const logger = this._context.logger;

    if (inviteLink) {
      const [owner, repo] = payload.repository.full_name.split("/");
      if ("link" in inviteLink) {
        await addCommentToIssue(
          this._context,
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

  getBotIdString() {
    if (!this._botIdString) {
      throw new Error("Bot ID is not available");
    }
    return this._botIdString;
  }
}
