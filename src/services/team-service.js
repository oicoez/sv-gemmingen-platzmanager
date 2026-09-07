import crypto from "crypto";
import { db } from "../database/client.js";
import { getClub } from "../repositories/team-repository.js";

const clean=v=>String(v??"").replace(/\s+/g," ").trim();

export async function listTeams(){
  const q=await db(`select id,name,external_name,coach,contact,note,active
    from cp5_teams where active=true order by name`);
  return q.rows;
}

export async function addTeam({name}){
  const cleanName=clean(name);
  if(!cleanName)throw new Error("Mannschaftsname fehlt");
  const club=await getClub();

  const existing=await db(`select * from cp5_teams where club_id=$1 and lower(name)=lower($2) limit 1`,
    [club.id,cleanName]);
  if(existing.rowCount){
    await db(`update cp5_teams set active=true,external_name=$2,updated_at=now() where id=$1`,
      [existing.rows[0].id,cleanName]);
    return existing.rows[0].id;
  }

  const id=crypto.randomUUID();
  await db(`insert into cp5_teams(id,club_id,name,external_name,active)
    values($1,$2,$3,$3,true)`,[id,club.id,cleanName]);
  return id;
}

export async function removeTeam(id){
  const q=await db(`update cp5_teams set active=false,updated_at=now() where id=$1 returning id`,[id]);
  if(!q.rowCount)return false;

  await db(`delete from cp5_events
    where team_id=$1 and source='fussballde' and event_date>=current_date`,[id]);

  return true;
}

export async function findActiveTeamForFixture(clubId,{category,externalName}){
  const ext=clean(externalName);
  const cat=clean(category);
  const display=cat?`${cat} - ${ext}`:ext;
  const q=await db(`select * from cp5_teams
    where club_id=$1 and active=true and lower(name)=lower($2)
    limit 1`,[clubId,display]);
  return q.rows[0]||null;
}
