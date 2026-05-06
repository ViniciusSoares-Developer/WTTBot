import {
  makeWASocket,
  fetchLatestBaileysVersion,
  DisconnectReason,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import BraileysAuth from "../lib/baileysAuthLib";
import type { ILogger } from "@whiskeysockets/baileys/lib/Utils/logger";
import qrcode from "qrcode-terminal";
import type { Boom } from "@hapi/boom";
import { processMessage } from "../lib/messageLib";
import database from "../database/database";
import messageSchema from "../database/schema/messageSchema";

export default class BaileysService {
  private sock?: ReturnType<typeof makeWASocket>;

  constructor(private session: string) {}

  private baileysLogger(
    levelFilter: string = "debug",
    enable: boolean = false,
  ): ILogger {
    const levels: Record<string, number> = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60,
      silent: Infinity,
    };

    const minLevel: number = levels[levelFilter] ?? levels["debug"]!;

    const fmt = (level: string, data: unknown, msg: string) => {
      if ((levels[level] ?? 0) < minLevel) return;

      const time = new Date().toISOString();
      const extra =
        data && typeof data === "object" && Object.keys(data).length
          ? " " + JSON.stringify(data)
          : "";

      console.log(`[${time}] [${level.toUpperCase()}] ${msg}${extra}`);
    };

    const logger = {
      level: levelFilter,
      trace: (data: unknown, msg: string = "") =>
        enable ? fmt("trace", data, msg) : null,
      debug: (data: unknown, msg: string = "") =>
        enable ? fmt("debug", data, msg) : null,
      info: (data: unknown, msg: string = "") =>
        enable ? fmt("info", data, msg) : null,
      warn: (data: unknown, msg: string = "") =>
        enable ? fmt("warn", data, msg) : null,
      error: (data: unknown, msg: string = "") =>
        enable ? fmt("error", data, msg) : null,
      fatal: (data: unknown, msg: string = "") =>
        enable ? fmt("fatal", data, msg) : null,
      child: () => this.baileysLogger(levelFilter),
    } as unknown as ILogger;

    return logger;
  }

  async initialize() {
    const baileysAuth = new BraileysAuth(this.session);
    const { saveCreds, state } = await baileysAuth.getState();

    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      auth: state,
      version,
      logger: this.baileysLogger("info"),
      syncFullHistory: true,
    });

    this.sock.ev.on("creds.update", saveCreds);
    this.sock.ev.on("connection.update", (arg) =>
      this.connectionUpdate(arg, baileysAuth),
    );
    this.sock.ev.on("messaging-history.set", this.messagingHistorySet);
    this.sock.ev.on("messages.upsert", this.messagesUpsert);
    this.sock.ev.on("messages.update", this.messagesUpdate);
  }

  async disconnect() {
    if (this.sock) {
      this.sock.ev.removeAllListeners("creds.update");
      this.sock.ev.removeAllListeners("connection.update");
      this.sock.ev.removeAllListeners("messaging-history.set");
      this.sock.ev.removeAllListeners("messages.update");
      this.sock.ev.removeAllListeners("messages.upsert");
      this.sock.end(undefined);
      this.sock = undefined;
      console.log("[Socket closed]");
    }
  }

  private async connectionUpdate(
    arg: BaileysEventMap["connection.update"],
    baileysAuth: BraileysAuth,
  ) {
    if (arg.qr) {
      qrcode.generate(arg.qr, { small: true });
      return;
    }

    if (arg.connection === "close") {
      const statusCode = (arg.lastDisconnect?.error as Boom)?.output
        ?.statusCode;

      if (
        statusCode === DisconnectReason.loggedOut ||
        statusCode === DisconnectReason.badSession
      ) {
        console.log("[CONNECTION LOST] [STATUS CODE]", statusCode);
        console.log("[CONNECTION LOST] [NAME]", DisconnectReason[statusCode]);
        await baileysAuth.clearSession();
        this.initialize();
      } else {
        this.initialize();
      }
    } else if (arg.connection === "open") {
      console.log("[SmarthPhone conected]");
    }
  }

  private messagingHistorySet(arg: BaileysEventMap["messaging-history.set"]) {}

  private async messagesUpsert(arg: BaileysEventMap["messages.upsert"]) {
    for (const message of arg.messages) {
      try {
        const handler = processMessage(message);
        const messageHandler = await handler();
        if (!messageHandler.key || !messageHandler.type) continue;
        await database.insert(messageSchema).values({
          key: messageHandler.key,
          type: messageHandler.type,
          bot: messageHandler.bot,
          contactName: messageHandler.contactName,
          contactNumber: messageHandler.contactNumber,
          text: messageHandler.text,
          filePath: messageHandler.filePath,
          fileLength: messageHandler.fileLength,
          mimeType: messageHandler.mimeType,
          height: messageHandler.height,
          width: messageHandler.width,
          isViewOnce: messageHandler.isViewOnce,
          seconds: messageHandler.seconds,
          ptt: messageHandler.ptt,
          createdAt:
            typeof messageHandler.createdAt === "string"
              ? new Date(messageHandler.createdAt)
              : messageHandler.createdAt,
        });
        console.log("[MESSAGE]", messageHandler.text);
        if (
          messageHandler.key.fromMe &&
          messageHandler.text?.toLowerCase() === "ping"
        ) {
          await this.sock?.sendMessage(messageHandler.key.remoteJid!, {
            text: "pong",
          });
        }
      } catch (error) {
        console.error(
          "[ERROR PROCESSING MESSAGE]",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  private messagesUpdate(arg: BaileysEventMap["messages.update"]) {
    for (const message of arg) {
      // console.log(`[MESSAGE UPDATED]:`, message.update);
      // console.log(`[MESSAGE KEY]:`, message.key);
      console.log();
    }
  }
}
