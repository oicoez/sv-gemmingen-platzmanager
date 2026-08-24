import { createApp } from "./src/app.js";
import { config } from "./src/config/index.js";
import { initSchema } from "./src/database/schema.js";
import { logger } from "./src/utils/logger.js";

async function start(){
  await initSchema();
  const app=createApp();
  app.listen(config.port,"0.0.0.0",()=>{
    logger.info(`ClubPlanner 5.0 Sprint 2.4 läuft auf Port ${config.port}`);
  });
}

start().catch(error=>{
  logger.error("Start fehlgeschlagen",{message:error.message,stack:error.stack});
  process.exit(1);
});
