import crypto from "crypto";
import { db } from "../database/client.js";

export function eventHash(input){
  return crypto.createHash("sha256").update(JSON.stringify({
    teamId:input.teamId,date:input.date,kickoff:input.kickoff,opponent:input.opponent,
    competition:input.competition,status:input.status,locationId:input.locationId,
    resourceId:input.resourceId,address:input.address,gameNumber:input.gameNumber
  })).digest("hex");
}

export async function findExternalEvent(externalId){
  const r=await db(`select * from cp5_events where source='fussballde' and external_id=$1 limit 1`,[externalId]);
  return r.rows[0]||null;
}

export async function upsertImportedEvent(input){
  const hash=eventHash(input);
  const existing=await findExternalEvent(input.externalId);
  if(existing&&existing.source_hash===hash){
    await db(`update cp5_events set last_synced_at=now() where id=$1`,[existing.id]);
    return {action:"unchanged",id:existing.id};
  }
  const id=existing?.id||crypto.randomUUID();
  if(existing){
    await db(`update cp5_events set
      club_id=$2,team_id=$3,event_type='home_match',event_date=$4,kickoff_time=$5,start_time=$5,end_time=$6,
      title=$7,opponent=$8,competition=$9,status=$10,location_id=$11,resource_id=$12,
      home_cabin_id=null,guest_cabin_id=null,address=$13,note='',source='fussballde',external_url=$14,
      game_number=$15,source_hash=$16,last_synced_at=now(),updated_at=now()
      where id=$1`,[id,input.clubId,input.teamId,input.date,input.kickoff,input.endTime,input.title,input.opponent,input.competition,input.status,input.locationId,input.resourceId,input.address,input.externalUrl,input.gameNumber,hash]);
    return {action:"updated",id};
  }
  await db(`insert into cp5_events(
    id,club_id,team_id,event_type,event_date,kickoff_time,start_time,end_time,title,opponent,competition,status,
    location_id,resource_id,home_cabin_id,guest_cabin_id,address,note,source,external_id,external_url,game_number,source_hash,last_synced_at
  ) values($1,$2,$3,'home_match',$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,null,null,$13,'','fussballde',$14,$15,$16,$17,now())`,
  [id,input.clubId,input.teamId,input.date,input.kickoff,input.endTime,input.title,input.opponent,input.competition,input.status,input.locationId,input.resourceId,input.address,input.externalId,input.externalUrl,input.gameNumber,hash]);
  return {action:"inserted",id};
}

export async function listImportedEvents(){
  const r=await db(`select e.id,e.event_date,e.kickoff_time,e.opponent,e.competition,e.status,e.address,e.external_id,e.game_number,
      t.name as team,l.name as location,r.display_name as resource
    from cp5_events e
    left join cp5_teams t on t.id=e.team_id
    left join cp5_locations l on l.id=e.location_id
    left join cp5_resources r on r.id=e.resource_id
    where e.source='fussballde'
    order by e.event_date,e.kickoff_time nulls last`);
  return r.rows;
}
