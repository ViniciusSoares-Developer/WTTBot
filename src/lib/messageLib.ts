import {
  BufferJSON,
  downloadMediaMessage,
  getContentType,
  normalizeMessageContent,
  type proto,
  type WAMessage,
} from "@whiskeysockets/baileys";
import type { messageDTO } from "../dto/messageDTO";
import fsPromises from "node:fs/promises";
import Long from "long";
import path from "node:path";
import { v7 } from "uuid";

type TFutureProofMessage =
  | "documentWithCaptionMessage"
  | "ephemeralMessage"
  | "viewOnceMessage"
  | "viewOnceMessageV2"
  | "viewOnceMessageV2Extension"
  | "botForwardedMessage"
  | "commentMessage"
  | "editedMessage";

export function processMessage(
  message: WAMessage,
): () => Promise<Partial<messageDTO>> {
  const key = message.key;
  const normalized = normalizeMessageContent(message.message);
  const type = getContentType(normalized);
  const timestamp = message.messageTimestamp;
  if (!key || !normalized || !type || !timestamp) return async () => ({});
  const keyParse = JSON.parse(JSON.stringify(key, BufferJSON.replacer));
  const defaultData: Partial<messageDTO> = {
    key: keyParse,
    type,
    status: message.status || undefined,
    createdAt: new Date(
      Long.isLong(timestamp) ? timestamp.toNumber() : Number(timestamp) * 1000,
    ),
  };

  async function download(
    fileName: string,
    mimeType?: string,
  ): Promise<{ filePath: string; mimeType?: string }> {
    let filePath = "";
    try {
      const buffer = await downloadMediaMessage(message, "buffer", {});
      filePath = path.join("whatsapp", "files", fileName);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      await fsPromises.writeFile(filePath, buffer);
    } catch (e) {
      console.log("[DOWNLOAD ERROR]", e instanceof Error ? e.message : e);
    } finally {
      return {
        filePath: filePath,
        mimeType,
      };
    }
  }

  const futureProofMessage = async (): Promise<Partial<messageDTO>> => {
    const inner: proto.Message.IFutureProofMessage =
      normalized[type as TFutureProofMessage]!;
    const innerNormalized = normalizeMessageContent(inner.message);
    const innerType = getContentType(innerNormalized);
    return !innerType || !handlers[innerType]
      ? {}
      : {
          bot: type === "botForwardedMessage",
          ...handlers[innerType](),
        };
  };

  const handlers: Partial<
    Record<keyof proto.IMessage, () => Promise<Partial<messageDTO>>>
  > = {
    extendedTextMessage: async () => {
      const extMessage: proto.Message.IExtendedTextMessage =
        normalized["extendedTextMessage"]!;
      return {
        ...defaultData,
        text: extMessage.text || extMessage.description || undefined,
      };
    },
    conversation: async () => {
      return {
        ...defaultData,
        text: normalized["conversation"] || undefined,
      };
    },
    imageMessage: async () => {
      const imgMessage: proto.Message.IImageMessage =
        normalized["imageMessage"]!;
      const fileLength = imgMessage.fileLength;
      const mimeType = imgMessage.mimetype;
      return {
        ...defaultData,
        fileLength: fileLength
          ? Long.isLong(fileLength)
            ? fileLength.toNumber()
            : Number(fileLength)
          : undefined,
        width: imgMessage.width || undefined,
        height: imgMessage.height || undefined,
        isViewOnce: imgMessage.viewOnce || false,
        text: imgMessage.caption || undefined,
        ...(await download(
          v7() + (mimeType ? "." + mimeType.split("/")[1] : ".jpg"),
          mimeType || undefined,
        )),
      };
    },
    videoMessage: async () => {
      const vdMessage: proto.Message.IVideoMessage =
        normalized["videoMessage"]!;
      const fileLength = vdMessage.fileLength;
      const mimeType = vdMessage.mimetype;
      return {
        ...defaultData,
        fileLength: fileLength
          ? Long.isLong(fileLength)
            ? fileLength.toNumber()
            : Number(fileLength)
          : undefined,
        height: vdMessage.height || undefined,
        width: vdMessage.width || undefined,
        isViewOnce: vdMessage.viewOnce || false,
        text: vdMessage.caption || undefined,
        ...(await download(
          v7() + (mimeType ? "." + mimeType.split("/")[1] : ".mp4"),
          mimeType || undefined,
        )),
      };
    },
    audioMessage: async () => {
      const audMessage: proto.Message.IAudioMessage =
        normalized["audioMessage"]!;
      const fileLength = audMessage.fileLength;
      const mimeType = audMessage.mimetype;
      return {
        ...defaultData,
        fileLength: fileLength
          ? Long.isLong(fileLength)
            ? fileLength.toNumber()
            : Number(fileLength)
          : undefined,
        ptt: audMessage.ptt || false,
        seconds: audMessage.seconds || undefined,
        isViewOnce: audMessage.viewOnce || false,
        ...(await download(
          v7() + (mimeType ? "." + mimeType.split("/")[1] : ".ogg"),
          mimeType || undefined,
        )),
      };
    },
    stickerMessage: async () => {
      const stkMessage: proto.Message.IStickerMessage =
        normalized["stickerMessage"]!;
      return {
        ...defaultData,
        height: stkMessage.height || undefined,
        width: stkMessage.width || undefined,
        ...(await download(v7() + ".webp", stkMessage.mimetype || undefined)),
      };
    },
    contactMessage: async () => {
      const cttMessage: proto.Message.IContactMessage =
        normalized["contactMessage"]!;
      return {
        ...defaultData,
        contactName: cttMessage.displayName || undefined,
        contactNumber: cttMessage.vcard || undefined,
      };
    },
    documentWithCaptionMessage: futureProofMessage,
    botForwardedMessage: futureProofMessage,
  };

  if (!handlers[type]) {
    console.log(`[HANDLER NOT CONFIGURABLE]`, `TYPE -> ${type}`);
  }

  return !handlers[type] ? async () => ({}) : handlers[type];
}
