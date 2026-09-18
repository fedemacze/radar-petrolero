import { loadEnv } from "./config/env.js";
import { Database } from "./db/database.js";

const env = loadEnv();
const database = new Database(env.DATABASE_URL);
try {
  await database.migrate();
  console.log("Migraciones aplicadas correctamente.");
} finally {
  await database.close();
}
