import { db, dbHealth } from "../database/client.js";
import { config } from "../config/index.js";

export async function getSystemStatus(){
  const health=await dbHealth();
  const counts=await db(`select
    (select count(*)::int from cp5_teams where active=true) teams,
    (select count(*)::int from cp5_events) events,
    (select count(*)::int from cp5_resources where active=true) resources,
    (select count(*)::int from cp5_locations where active=true) locations`);
  return {
    ok:true,
    app:config.appName,
    version:config.version,
    database:health,
    ...counts.rows[0]
  };
}
