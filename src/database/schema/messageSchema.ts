import { type WAMessageKey } from "@whiskeysockets/baileys";
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import EType from "./messageTypeEnum";

export default pgTable("messages", {
  id: uuid().primaryKey().defaultRandom(),

  key: jsonb().$type<WAMessageKey>().notNull(),
  type: EType("type").notNull(),
  filePath: varchar("file_path", { length: 255 }),
  fileLength: integer("file_length"),
  mimeType: varchar("mime_type", { length: 50 }),
  height: integer(),
  width: integer(),
  isViewOnce: boolean().default(false),
  bot: boolean().default(false),
  seconds: integer(),
  ptt: boolean().default(false),
  contactName: varchar("contact_name", { length: 100 }),
  contactNumber: varchar("contact_number", { length: 15 }),
  text: text(),
  status: integer().default(0),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// key: jsonb("key").notNull(),
// filePath: varchar("file_path", { length: 255 }),
// mimeType: varchar("mime_type", { length: 255 }),
// text: text("text"),
