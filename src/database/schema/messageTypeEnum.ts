import { proto, type MessageType } from "@whiskeysockets/baileys";
import { pgEnum } from "drizzle-orm/pg-core";

const keys = [
  "extendedTextMessage",
  "conversation",
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "stickerMessage",
  "contactMessage",
  "documentWithCaptionMessage",
  "botForwardedMessage",
] as [string, ...string[]];
export default pgEnum("message_type", keys);
