import crypto from "crypto";
import { db } from "../database/client.js";

export async function createTraining(input){
  const id=crypto.randomUUID();
  await db(`insert into cp5_events(
    id,club_id,team_id,event_type,event_date,kickoff_time,start_time,end_time,title,
    opponent,competition,status,location_id,venue_name,resource_id,allocation_mode,requested_section,
    address,note,source,created_at,updated_at
  ) values(
    $1,$2,$3,'training',$4,$5,$5,$6,'Training','','Training','planned',$7,'',$8,$9,$10,$11,$12,'manual',now(),now()
  )`,[
    id,input.clubId,input.teamId,input.date,input.start,input.end,input.locationId,input.resourceId,
    input.allocationMode,input.requestedSection,input.address||"",input.note||""
  ]);
  return id;
}
export async function deleteTraining(id){
  const q=await db(`delete from cp5_events where id=$1 and event_type='training' returning id`,[id]);
  return q.rowCount>0;
}
export async function listTrainings({from,to}){
  const q=await db(`select e.id,e.event_date,e.start_time,e.end_time,e.title,e.note,
      e.location_id,e.resource_id,e.allocation_mode,e.requested_section,
      t.name as team,r.base_name,r.section,r.display_name as resource,l.name as location
    from cp5_events e
    join cp5_teams t on t.id=e.team_id
    left join cp5_resources r on r.id=e.resource_id
    left join cp5_locations l on l.id=e.location_id
    where e.event_type='training' and e.event_date between $1 and $2
    order by e.event_date,e.start_time,t.name`,[from,to]);
  return q.rows;
}
