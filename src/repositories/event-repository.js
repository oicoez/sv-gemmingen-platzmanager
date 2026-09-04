import crypto from "crypto";
import { db } from "../database/client.js";

async function resolveGameCabins(locationId){
  if(!locationId)return {homeCabinId:null,guestCabinId:null};
  const q=await db(`select id,base_name from cp5_resources
    where location_id=$1 and resource_type='cabin' and active=true`,[locationId]);
  return {
    homeCabinId:q.rows.find(x=>x.base_name==="Heimkabine")?.id||null,
    guestCabinId:q.rows.find(x=>x.base_name==="Gastkabine")?.id||null
  };
}

export function eventHash(input){
  return crypto.createHash("sha256").update(JSON.stringify({
    teamId:input.teamId,date:input.date,kickoff:input.kickoff,opponent:input.opponent,
    competition:input.competition,status:input.status,locationId:input.locationId,venueName:input.venueName,
    resourceId:input.resourceId,address:input.address,gameNumber:input.gameNumber
  })).digest("hex");
}

export async function findExternalEvent(externalId){
  const r=await db(`select * from cp5_events where source='fussballde' and external_id=$1 limit 1`,[externalId]);
  return r.rows[0]||null;
}

export async function upsertImportedEvent(input){
  const hash=eventHash(input);
  const cabins=input.status==="cancelled"?{homeCabinId:null,guestCabinId:null}:await resolveGameCabins(input.locationId);
  const existing=await findExternalEvent(input.externalId);
  if(existing&&existing.source_hash===hash){
    await db(`update cp5_events set last_synced_at=now() where id=$1`,[existing.id]);
    return {action:"unchanged",id:existing.id};
  }
  const id=existing?.id||crypto.randomUUID();
  if(existing){
    await db(`update cp5_events set
      club_id=$2,team_id=$3,event_type='home_match',event_date=$4,kickoff_time=$5,start_time=$5,end_time=$6,
      title=$7,opponent=$8,competition=$9,status=$10,location_id=$11,venue_name=$12,resource_id=$13,
      home_cabin_id=$18,guest_cabin_id=$19,allocation_mode='exclusive',requested_section='whole',address=$14,note='',source='fussballde',external_url=$15,
      game_number=$16,source_hash=$17,last_synced_at=now(),updated_at=now()
      where id=$1`,[
        id,input.clubId,input.teamId,input.date,input.kickoff,input.endTime,input.title,input.opponent,
        input.competition,input.status,input.locationId,input.venueName||"",input.resourceId,input.address,
        input.externalUrl,input.gameNumber,hash,cabins.homeCabinId,cabins.guestCabinId
      ]);
    return {action:"updated",id};
  }
  await db(`insert into cp5_events(
    id,club_id,team_id,event_type,event_date,kickoff_time,start_time,end_time,title,opponent,competition,status,
    location_id,venue_name,resource_id,home_cabin_id,guest_cabin_id,allocation_mode,requested_section,address,note,source,external_id,external_url,
    game_number,source_hash,last_synced_at
  ) values($1,$2,$3,'home_match',$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$13,$19,$20,'exclusive','whole',$14,'','fussballde',$15,$16,$17,$18,now())`,
  [
    id,input.clubId,input.teamId,input.date,input.kickoff,input.endTime,input.title,input.opponent,input.competition,
    input.status,input.locationId,input.venueName||"",input.resourceId,input.address,input.externalId,input.externalUrl,
    input.gameNumber,hash,cabins.homeCabinId,cabins.guestCabinId
  ]);
  return {action:"inserted",id};
}

export async function listImportedEvents({includePast=false}={}){
  const pastFilter=includePast ? "" : `and (e.event_date > (now() at time zone 'Europe/Berlin')::date
      or (e.event_date = (now() at time zone 'Europe/Berlin')::date
          and coalesce(e.kickoff_time,time '23:59') >= (now() at time zone 'Europe/Berlin')::time))`;
  const r=await db(`select e.id,e.event_date,e.kickoff_time,e.opponent,e.competition,e.status,e.address,e.external_id,e.game_number,
      t.name as team,coalesce(l.name,nullif(e.venue_name,'')) as location,r.display_name as resource
    from cp5_events e
    left join cp5_teams t on t.id=e.team_id
    left join cp5_locations l on l.id=e.location_id
    left join cp5_resources r on r.id=e.resource_id
    where e.source='fussballde'
      and (e.location_id in ('gemmingen','stebbach') or e.status='cancelled')
      ${pastFilter}
    order by e.event_date,e.kickoff_time nulls last`);
  return r.rows;
}


export async function deleteConfirmedExternalEvents(externalRows=[]){
  const rows=(externalRows||[]).filter(Boolean);
  if(!rows.length)return 0;

  let removed=0;
  for(const row of rows){
    const externalId=row.externalId||"";
    const date=row.date||"";
    const home=row.home||"";
    const away=row.away||"";

    // Primary match: stable FUSSBALL.DE external id.
    // Migration fallback: old imports may have a different external_id.
    // Then identify the stale local booking by date + stored opponent + team name.
    const res=await db(`delete from cp5_events e
      using cp5_teams t
      where e.team_id=t.id
        and e.source='fussballde'
        and e.event_type='home_match'
        and (
          ($1<>'' and e.external_id=$1)
          or (
            $2<>'' and e.event_date=$2::date
            and lower(trim(e.opponent))=lower(trim($4))
            and lower(trim(t.name))=lower(trim($3))
          )
        )
      returning e.id`,[externalId,date,home,away]);

    removed += res.rowCount||0;
  }
  return removed;
}
