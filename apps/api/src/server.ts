import app from "./app";
import { env } from "./config/env";
import { db, initDatabase } from "./db";

async function start() {
  await initDatabase();
  app.listen(Number(env.PORT), () => console.log(`API listening on ${env.PORT} (${db.provider})`));
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
