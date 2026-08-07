import crypto from "crypto";
import { db } from "../database/client.js";

const clean=v=>String(v??"").replace(/\s*\/\s*/g,"/").replace(/\s+/g," ").trim();

function displayTeamName(category,externalName){
  const c=clean(category);
  const e=clean(externalName);
  return c?`${c} - ${e}`:e;
}

export async function ensureImportedTeam(clubId,{category,externalName}){
  const normalizedExternal=clean(externalName);
  const displayName=displayTeamName(category,normalizedExternal);

  // WICHTIG: Erst Altersklasse + Mannschaftsname (displayName) prüfen.
  // Derselbe externe Name kann bei mehreren Altersklassen vorkommen,
  // z.B. JSG Gemmingen/Stebbach bei B- und C-Junioren.
  let r=await db(`select * from cp5_teams where club_id=$1 and lower(replace(name,' / ','/'))=lower($2) limit 1`,
    [clubId,displayName]);
  if(r.rowCount){
    await db(`update cp5_teams set external_name=$2,active=true,updated_at=now() where id=$1`,
      [r.rows[0].id,normalizedExternal]);
    return {...r.rows[0],external_name:normalizedExternal};
  }

  // Nur wenn keine Altersklasse geliefert wird, darf der externe Name allein
  // zur Wiedererkennung verwendet werden.
  if(!clean(category)){
    r=await db(`select * from cp5_teams where club_id=$1 and lower(external_name)=lower($2) limit 1`,
      [clubId,normalizedExternal]);
    if(r.rowCount)return r.rows[0];
  }

  const id=crypto.randomUUID();
  await db(`insert into cp5_teams(id,club_id,name,external_name,active) values($1,$2,$3,$4,true)`,
    [id,clubId,displayName,normalizedExternal]);
  return {id,club_id:clubId,name:displayName,external_name:normalizedExternal,active:true};
}

export async function getClub(){
  const r=await db(`select * from cp5_clubs where active=true order by created_at limit 1`);
  if(!r.rowCount)throw new Error("Kein aktiver Club in cp5_clubs gefunden");
  return r.rows[0];
}
