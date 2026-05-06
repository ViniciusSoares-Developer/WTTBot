import { proto, type WAMessageKey } from "@whiskeysockets/baileys";

export type MessageType = keyof proto.IMessage;

export interface messageDTO {
  id: string;
  key: WAMessageKey;
  type: MessageType;
  filePath: string;
  fileLength: number;
  mimeType: string;
  height: number;
  width: number;
  isViewOnce: boolean;
  bot: boolean;
  seconds: number;
  ptt: boolean;
  contactName: string;
  contactNumber: string;
  text: string;
  status: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
