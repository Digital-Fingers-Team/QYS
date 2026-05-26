import app from "./app";
import { env } from "./config/env";
import { db, initDatabase } from "./db";

async function start() {
  app.listen(Number(env.PORT), () => console.log(`API listening on ${env.PORT} (${db.provider})`));
  try {
    await initDatabase();
    console.log(`Database connected (${db.provider})`);
  } catch (error) {
    console.error("Database initialization failed; API is still listening", error);
  }
}

start().catch((error) => {
  console.error("Failed to start API", error);
  process.exit(1);
});
