import app from "./app";
import { env } from "./config/env";
import { db, initDatabase } from "./db";

async function start() {
  try {
    await initDatabase();
  } catch (error) {
    console.error(`Database initialization failed: ${error instanceof Error ? error.name : "UnknownError"}`);
    process.exit(1);
  }
  app.listen(Number(env.PORT), () => console.log(`API listening on ${env.PORT} (${db.provider})`));
  if (env.NODE_ENV !== "production") {
    console.log(`Database connected (${db.provider})`);
  }
}

start().catch((error) => {
  console.error(`Failed to start API: ${error instanceof Error ? error.name : "UnknownError"}`);
  process.exit(1);
});
