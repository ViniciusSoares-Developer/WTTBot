import { drizzle } from "drizzle-orm/node-postgres";
import "dotenv/config";

export default drizzle(process.env.DATABASE_URL!);
