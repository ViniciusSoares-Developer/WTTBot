import dotenv from "dotenv";
import baileysService from "./services/baileysService";
import fs from 'node:fs'
import GoogleApiLib from "./lib/googleApiLib";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: ".env",
  });
}

(async () => {
  await new GoogleApiLib().authorize()

  const baileys = new baileysService("session1");
  baileys.initialize();

  async function shutdown() {
    await baileys.disconnect();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
