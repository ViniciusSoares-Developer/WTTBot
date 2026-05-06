import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export default pgTable(
  "session_whatsapp",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    session: varchar("session", { length: 100 }).notNull(),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updateAt: timestamp("update_at").defaultNow(),
  },
  (t) => [unique("session_whatsapp_session_key_unique").on(t.session, t.key)],
);
