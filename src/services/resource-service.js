import { db } from "../database/client.js";

export async function listResources(){
  const q=await db(`select r.id,r.location_id,l.name location_name,r.resource_type,r.base_name,r.section,r.display_name
    from cp5_resources r join cp5_locations l on l.id=r.location_id
    where r.active=true and l.active=true
    order by l.name,r.resource_type,r.base_name,r.section`);
  return q.rows;
}
