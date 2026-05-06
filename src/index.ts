import dotenv from "dotenv";
import baileysService from "./services/baileysService";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: ".env",
  });
}

(() => {
  const baileys = new baileysService("session1");
  baileys.initialize();

  async function shutdown() {
    await baileys.disconnect();
    process.exit(0);
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();
