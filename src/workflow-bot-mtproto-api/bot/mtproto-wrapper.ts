import { Api } from "telegram";
import { BaseMtProto } from "./scripts/sms-auth/base-mtproto";
import { Context } from "../../types";
import { SessionManager, SessionManagerFactory } from "./session/session-manager";
import bigInt from "big-integer";
import dotenv from "dotenv";
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

  constructor(context: Context) {
    super();
    this._context = context;
    this._sessionManager = SessionManagerFactory.createSessionManager(context);
  }

  async initialize() {
    const session = await this._sessionManager.getSession();
    await super.initialize(this._context.env.TELEGRAM_BOT_ENV.mtProtoSettings, session);
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
}
