import { db } from "../database/client.js";

export async function listTeams(){
  const q=await db(`select id,name,external_name,coach,contact,note,active
    from cp5_teams where active=true order by name`);
  return q.rows;
}
