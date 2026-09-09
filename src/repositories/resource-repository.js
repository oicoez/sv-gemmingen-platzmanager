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


export async function findCabinsForLocation(locationId){
  if(!locationId)return [];
  const q=await db(`select * from cp5_resources
    where location_id=$1 and resource_type='cabin' and active=true
    order by case base_name when 'Heimkabine' then 1 when 'Gastkabine' then 2 else 9 end, display_name`,
    [locationId]);
  return q.rows;
}

export async function getResourceById(id){
  if(!id)return null;
  const q=await db(`select * from cp5_resources where id=$1 and active=true limit 1`,[id]);
  return q.rows[0]||null;
}


export async function getLocation(locationId){
  if(!locationId)return null;
  const q=await db(`select * from cp5_locations where id=$1 and active=true limit 1`,[locationId]);
  return q.rows[0]||null;
}

export async function getPitchDefinition(locationId,baseName){
  if(!locationId||!baseName)return null;
  const q=await db(`select r.*,l.name as location_name,l.address as location_address
    from cp5_resources r join cp5_locations l on l.id=r.location_id
    where r.location_id=$1 and r.resource_type='pitch' and r.base_name=$2
      and r.section='whole' and r.active=true and l.active=true limit 1`,[locationId,baseName]);
  return q.rows[0]||null;
}
