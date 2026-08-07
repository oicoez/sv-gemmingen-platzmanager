import crypto from "crypto";
import { db } from "../database/client.js";

export async function ensureImportedTeam(clubId,{category,externalName}){
  let r=await db(`select * from cp5_teams where club_id=$1 and lower(external_name)=lower($2) limit 1`,[clubId,externalName]);
  if(r.rowCount)return r.rows[0];
  const displayName=category?`${category} - ${externalName}`:externalName;
  r=await db(`select * from cp5_teams where club_id=$1 and lower(name)=lower($2) limit 1`,[clubId,displayName]);
  if(r.rowCount){
    await db(`update cp5_teams set external_name=$2,active=true,updated_at=now() where id=$1`,[r.rows[0].id,externalName]);
    return {...r.rows[0],external_name:externalName};
  }
  const id=crypto.randomUUID();
  await db(`insert into cp5_teams(id,club_id,name,external_name,active) values($1,$2,$3,$4,true)`,[id,clubId,displayName,externalName]);
  return {id,club_id:clubId,name:displayName,external_name:externalName,active:true};
}

export async function getClub(){
  const r=await db(`select * from cp5_clubs where active=true order by created_at limit 1`);
  if(!r.rowCount)throw new Error("Kein aktiver Club in cp5_clubs gefunden");
  return r.rows[0];
}
