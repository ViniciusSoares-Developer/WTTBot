import { and, eq } from "drizzle-orm";
import db from "../database/database";
import SessionWhatsappSchema from "../database/schema/sessionWhatsappSchema";
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationState,
  type SignalDataTypeMap,
} from "@whiskeysockets/baileys";

export default class BraileysAuth {
  constructor(private sessionId: string) {}

  private async readData(key: string) {
    const result = await db
      .select()
      .from(SessionWhatsappSchema)
      .where((SessionWhatsapp) =>
        and(
          eq(SessionWhatsapp.session, this.sessionId),
          eq(SessionWhatsapp.key, key),
        ),
      );
    if (!result[0]) return null;
    return JSON.parse(JSON.stringify(result[0].value), BufferJSON.reviver);
  }

  private async writeData(key: string, value: unknown) {
    const data = JSON.parse(JSON.stringify(value, BufferJSON.replacer));

    await db
      .insert(SessionWhatsappSchema)
      .values({
        session: this.sessionId,
        key,
        value: data,
      })
      .onConflictDoUpdate({
        target: [SessionWhatsappSchema.session, SessionWhatsappSchema.key],
        set: {
          value: data,
          updateAt: new Date(),
        },
      });
  }

  private async deleteData(key: string) {
    await db
      .delete(SessionWhatsappSchema)
      .where(
        and(
          eq(SessionWhatsappSchema.session, this.sessionId),
          eq(SessionWhatsappSchema.key, key),
        ),
      );
  }

  async getState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const creds = (await this.readData("creds")) || initAuthCreds();

    return {
      state: {
        creds,
        keys: {
          get: async <T extends keyof SignalDataTypeMap>(
            type: string,
            ids: string[],
          ) => {
            const data: { [id: string]: SignalDataTypeMap[T] } = {};
            for (const id of ids) {
              let value = await this.readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            }
            return data;
          },
          set: async (data: {
            [T in keyof SignalDataTypeMap]?: {
              [id: string]: SignalDataTypeMap[T];
            };
          }) => {
            for (const [type, ids] of Object.entries(data)) {
              for (const [id, value] of Object.entries(ids)) {
                if (value) {
                  await this.writeData(`${type}-${id}`, value);
                } else {
                  await this.deleteData(`${type}-${id}`);
                }
              }
            }
          },
        },
      },
      saveCreds: () => this.writeData("creds", creds),
    };
  }

  async clearSession() {
    await db
      .delete(SessionWhatsappSchema)
      .where(eq(SessionWhatsappSchema.session, this.sessionId));
  }
}
