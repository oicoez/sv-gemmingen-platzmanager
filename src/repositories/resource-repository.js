import { db } from "../database/client.js";

export async function findWholePitch(locationId,pitchBase="Hauptplatz"){
  if(!locationId)return null;
  let r=await db(`select * from cp5_resources where location_id=$1 and resource_type='pitch' and base_name=$2 and section='whole' and active=true limit 1`,[locationId,pitchBase||"Hauptplatz"]);
  if(!r.rowCount&&pitchBase!=="Hauptplatz")r=await db(`select * from cp5_resources where location_id=$1 and resource_type='pitch' and base_name='Hauptplatz' and section='whole' and active=true limit 1`,[locationId]);
  return r.rows[0]||null;
}


export async function findPitchResource(locationId,baseName="Hauptplatz",section="whole"){
  if(!locationId)return null;
  const q=await db(`select * from cp5_resources
    where location_id=$1 and resource_type='pitch' and base_name=$2 and section=$3 and active=true
    limit 1`,[locationId,baseName,section]);
  return q.rows[0]||null;
}
